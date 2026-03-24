import os
import io
import json
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import torch
import torch.nn.functional as F
from torchvision import models, transforms
import torch.nn as nn
from PIL import Image
import pandas as pd
import numpy as np
import joblib

app = Flask(__name__, template_folder="templets", static_folder=".", static_url_path="")
CORS(app)

CLASSES_FILE     = 'classes.txt'
ENSEMBLE_WEIGHTS = 'ensemble_weights.json'

MODELS_CONFIG = [
    {'name': 'EfficientNet-B3',   'path': 'model_efficientnet.pth'},
    {'name': 'ResNet-50',         'path': 'model_resnet50.pth'},
    {'name': 'MobileNetV3-Large', 'path': 'model_mobilenetv3.pth'},
]

# ─────────────────────────────────────────────
#  Load classes
# ─────────────────────────────────────────────
def load_classes():
    if not os.path.exists(CLASSES_FILE):
        return []
    with open(CLASSES_FILE, 'r') as f:
        return f.read().splitlines()

class_names = load_classes()
num_classes = len(class_names)
device      = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Using device : {device}")
print(f"Classes      : {class_names}")

# ─────────────────────────────────────────────
#  Model builders  (must match train.py exactly)
# ─────────────────────────────────────────────
def build_efficientnet_b3(n):
    m = models.efficientnet_b3(weights=None)
    in_f = m.classifier[1].in_features
    m.classifier = nn.Sequential(nn.Dropout(p=0.4), nn.Linear(in_f, n))
    return m

def build_resnet50(n):
    m = models.resnet50(weights=None)
    m.fc = nn.Sequential(nn.Dropout(p=0.4), nn.Linear(m.fc.in_features, n))
    return m

def build_mobilenetv3(n):
    m = models.mobilenet_v3_large(weights=None)
    in_f = m.classifier[-1].in_features
    m.classifier[-1] = nn.Linear(in_f, n)
    return m

BUILDERS = {
    'EfficientNet-B3':    build_efficientnet_b3,
    'ResNet-50':          build_resnet50,
    'MobileNetV3-Large':  build_mobilenetv3,
}

# ─────────────────────────────────────────────
#  Load all models + ensemble weights
# ─────────────────────────────────────────────
loaded_models  = []   # list of (model, weight)
ensemble_ready = False

if num_classes > 0:
    # Load per-model weights if available
    weight_map = {}
    if os.path.exists(ENSEMBLE_WEIGHTS):
        with open(ENSEMBLE_WEIGHTS, 'r') as f:
            weight_map = json.load(f)

    for cfg in MODELS_CONFIG:
        if not os.path.exists(cfg['path']):
            print(f"⚠️  Skipping {cfg['name']} — {cfg['path']} not found")
            continue
        try:
            m = BUILDERS[cfg['name']](num_classes)
            m.load_state_dict(torch.load(cfg['path'], map_location=device, weights_only=True))
            m = m.to(device)
            m.eval()
            w = weight_map.get(cfg['path'], 1.0)
            loaded_models.append((m, w))
            print(f"✅  Loaded {cfg['name']}  (weight={w:.4f})")
        except Exception as e:
            print(f"❌  Failed to load {cfg['name']}: {e}")

    if loaded_models:
        # Normalise weights
        total = sum(w for _, w in loaded_models)
        loaded_models = [(m, w / total) for m, w in loaded_models]
        ensemble_ready = True
        print(f"\n🎯  Ensemble ready with {len(loaded_models)} model(s)")
    else:
        print("❌  No models loaded — check your .pth files")

# ─────────────────────────────────────────────
#  Load forecast models
# ─────────────────────────────────────────────
forecast_models = {}
MODEL_DIR = "forecast_models"
TARGET_COLUMNS = ["temperature", "dissolved_oxygen", "pH", "conductivity"]

def load_forecast_models():
    for target in TARGET_COLUMNS:
        model_path = os.path.join(MODEL_DIR, f"{target}_model.pkl")
        if os.path.exists(model_path):
            forecast_models[target] = joblib.load(model_path)
            print(f"✅  Loaded forecast model for {target}")

load_forecast_models()

CSV_PATH = "water_quality_with_timestamp.csv"
if os.path.exists(CSV_PATH):
    df_forecast = pd.read_csv(CSV_PATH)
    df_forecast['timestamp'] = pd.to_datetime(df_forecast['timestamp'])
    df_forecast = df_forecast.sort_values('timestamp')
    min_timestamp = df_forecast['timestamp'].min()
    df_forecast['time_index'] = (df_forecast['timestamp'] - min_timestamp).dt.total_seconds()
else:
    df_forecast = None

# ─────────────────────────────────────────────
#  Image transform
# ─────────────────────────────────────────────
transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std =[0.229, 0.224, 0.225])
])

# ─────────────────────────────────────────────
#  Routes
# ─────────────────────────────────────────────
@app.route('/')
def index():
    return render_template('Home_page.html')

@app.route('/<page_name>')
def serve_page(page_name):
    if page_name.endswith('.html'):
        return render_template(page_name)
    return app.send_static_file(page_name)

@app.route('/predict', methods=['POST'])
def predict():
    if not ensemble_ready:
        return jsonify({'error': 'Ensemble not ready. Run train.py first.'}), 500

    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        pil_image    = Image.open(io.BytesIO(file.read())).convert('RGB')
        input_tensor = transform(pil_image).unsqueeze(0).to(device)

        # Weighted average of softmax probabilities across all models
        avg_probs = None
        with torch.no_grad():
            for model, weight in loaded_models:
                probs = F.softmax(model(input_tensor), dim=1)
                if avg_probs is None:
                    avg_probs = probs * weight
                else:
                    avg_probs += probs * weight

        confidence, predicted_idx = torch.max(avg_probs, 1)
        predicted_class = class_names[predicted_idx.item()]
        conf_score      = confidence.item() * 100

        # Top-3 predictions
        top3_probs, top3_idx = torch.topk(avg_probs, min(3, num_classes), dim=1)
        top3 = [
            {'class': class_names[i.item()], 'confidence': f"{p.item()*100:.1f}%"}
            for p, i in zip(top3_probs[0], top3_idx[0])
        ]

        return jsonify({
            'result':      f"{predicted_class} ({conf_score:.1f}%)",
            'top3':        top3,
            'models_used': len(loaded_models),
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/forecast', methods=['POST'])
def api_forecast():
    data = request.json
    param = data.get('parameter')
    horizon = data.get('horizon', '24h')

    if param not in forecast_models:
        return jsonify({'error': f'No model found for {param}. Run train_predict.py.'}), 400

    if df_forecast is None:
        return jsonify({'error': 'Dataset not found for time reference.'}), 500

    model = forecast_models[param]
    
    last_time = df_forecast['time_index'].iloc[-1]
    
    if horizon == '24h':
        steps = 24
        step_size = 3600
    else:  # 7d
        steps = 7
        step_size = 86400

    future_times = [last_time + (i * step_size) for i in range(1, steps + 1)]
    X_future = np.array(future_times).reshape(-1, 1)

    preds = model.predict(X_future)
    
    slope_per_sec = model.coef_[0]
    slope_per_unit = slope_per_sec * step_size 
    
    X_hist = df_forecast[['time_index']].values
    y_hist = df_forecast[param].values
    r2 = model.score(X_hist, y_hist)
    
    sigma = float(np.std(y_hist))

    fys = []
    for i, p in enumerate(preds):
        noise = np.sin(i * 1.7) * sigma * 0.08
        fys.append(float(p + noise))

    return jsonify({
        'predictions': fys,
        'r2': float(round(r2, 4)),
        'slope_per_unit': float(slope_per_unit),
        'sigma': float(sigma)
    })

@app.route('/api/anomaly_batch', methods=['POST'])
def api_anomaly_batch():
    data = request.json
    param = data.get('parameter')
    threshold = float(data.get('threshold', 2.5))
    
    if not param:
        return jsonify({"error": "Missing parameter"}), 400
        
    try:
        df = pd.read_csv("water_quality_with_timestamp.csv")
    except Exception as e:
        return jsonify({"error": f"Failed to load dataset: {str(e)}"}), 500

    if param not in df.columns:
        return jsonify({"error": f"Parameter '{param}' not found."}), 400

    # Ensure numeric and drop NaNs
    df[param] = pd.to_numeric(df[param], errors='coerce')
    df = df.dropna(subset=[param]).copy()

    vals = df[param].values
    mu = float(np.mean(vals))
    sigma = float(np.std(vals))

    if sigma == 0:
        return jsonify({"error": "Standard deviation is 0."}), 400

    # Calculate z-scores
    df['z'] = (df[param] - mu) / sigma
    
    # Store complete values
    scored_all = []
    for i, (idx, row) in enumerate(df.iterrows()):
        scored_all.append({
            "rowNum": i + 1,
            "value": float(row[param]),
            "z": float(row['z'])
        })

    # Filter anomalies and sort
    anomalies_df = df[df['z'].abs() > threshold].copy()
    anomalies_df['abs_z'] = anomalies_df['z'].abs()
    anomalies_df = anomalies_df.sort_values(by='abs_z', ascending=False)
    
    anomalies_out = []
    for _, row in anomalies_df.iterrows():
        anomalies_out.append({
            # Reconstruct original sequential row number based on index if needed, but it's simpler to just find the index from the first pass
            "rowNum": int(row.name) + 1, 
            "value": float(row[param]),
            "z": float(row['z'])
        })

    return jsonify({
        "mu": mu,
        "sigma": sigma,
        "scored": scored_all,
        "anomalies": anomalies_out
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)