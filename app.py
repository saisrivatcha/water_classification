import os
import io
from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)  # Enable CORS to allow requests from the HTML file

MODEL_SAVE_PATH = 'water_classifier.pth'
CLASSES_FILE = 'classes.txt'

def load_classes():
    if not os.path.exists(CLASSES_FILE):
        return []
    with open(CLASSES_FILE, 'r') as f:
        classes = f.read().splitlines()
    return classes

class_names = load_classes()
num_classes = len(class_names)

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Using device: {device}")

# Load model
model = None
if num_classes > 0 and os.path.exists(MODEL_SAVE_PATH):
    print("Loading model...")
    model = models.mobilenet_v2(weights=None)
    model.classifier[1] = torch.nn.Linear(model.last_channel, num_classes)
    model.load_state_dict(torch.load(MODEL_SAVE_PATH, map_location=device, weights_only=True))
    model = model.to(device)
    model.eval()
    print("Model loaded successfully.")
else:
    print(f"Warning: Could not load model. Ensure {MODEL_SAVE_PATH} and {CLASSES_FILE} exist.")

# Define image transformations
transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225])
])

@app.route('/')
def index():
    # Serve the HTML file from the current directory
    return app.send_static_file('First.html')

@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({'error': 'Model not loaded properly.'}), 500

    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    try:
        # Read the image file
        image_bytes = file.read()
        pil_image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        
        # Apply transformations
        input_tensor = transform(pil_image).unsqueeze(0).to(device)
        
        # Make prediction
        with torch.no_grad():
            outputs = model(input_tensor)
            probabilities = F.softmax(outputs, dim=1)
            confidence, predicted_idx = torch.max(probabilities, 1)
            
        predicted_class = class_names[predicted_idx.item()]
        conf_score = confidence.item() * 100
        
        # Return the result
        return jsonify({
            'result': f"{predicted_class} (Confidence: {conf_score:.1f}%)"
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
