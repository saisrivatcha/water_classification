import cv2
import torch
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image
import os

MODEL_SAVE_PATH = 'water_classifier.pth'
CLASSES_FILE = 'classes.txt'

def load_classes():
    if not os.path.exists(CLASSES_FILE):
        return None
    with open(CLASSES_FILE, 'r') as f:
        classes = f.read().splitlines()
    return classes

def main():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")

    class_names = load_classes()
    if not class_names:
        print(f"Error: {CLASSES_FILE} not found. Please run train.py first.")
        return

    num_classes = len(class_names)
    
    # Load model architecture
    model = models.mobilenet_v2(weights=None)
    model.classifier[1] = torch.nn.Linear(model.last_channel, num_classes)
    
    # Load weights
    if not os.path.exists(MODEL_SAVE_PATH):
        print(f"Error: {MODEL_SAVE_PATH} not found. Please run train.py first.")
        return
        
    model.load_state_dict(torch.load(MODEL_SAVE_PATH, map_location=device, weights_only=True))
    model = model.to(device)
    model.eval()

    # Define transforms for inference
    transform = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225])
    ])

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return

    print("Press 'q' to quit.")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Convert cv2 frame (BGR) to PIL Image (RGB) for torchvision transforms
        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(image_rgb)
        
        # Apply transforms and add batch dimension
        input_tensor = transform(pil_image).unsqueeze(0).to(device)

        with torch.no_grad():
            outputs = model(input_tensor)
            probabilities = F.softmax(outputs, dim=1)
            confidence, predicted_idx = torch.max(probabilities, 1)

        predicted_class = class_names[predicted_idx.item()]
        conf_score = confidence.item() * 100

        # Overlay result on the frame
        text = f"{predicted_class}: {conf_score:.1f}%"
        color = (0, 255, 0) if conf_score > 70 else (0, 0, 255)
        
        cv2.putText(frame, text, (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 
                    1, color, 2, cv2.LINE_AA)

        cv2.imshow('Water Classification', frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    main()
