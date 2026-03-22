import os
import io
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
import torch.nn.functional as F
from torchvision import models, transforms
import torch.nn as nn
from PIL import Image

app = Flask(__name__, static_folder=".", static_url_path="")
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
    return app.send_static_file('First.html')

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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)