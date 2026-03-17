import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, models, transforms

# Configuration
DATA_DIR = '.'  # Root directory containing class folders
BATCH_SIZE = 32
EPOCHS = 10
LEARNING_RATE = 0.001
MODEL_SAVE_PATH = 'water_classifier.pth'

# Define standard ImageNet normalization
normalize = transforms.Normalize(mean=[0.485, 0.456, 0.406],
                                 std=[0.229, 0.224, 0.225])

# Data Augmentation for training
train_transforms = transforms.Compose([
    transforms.RandomResizedCrop(224),
    transforms.RandomHorizontalFlip(),
    transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1),
    transforms.ToTensor(),
    normalize,
])

# Transforms for validation
val_transforms = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    normalize,
])

class CustomDataset(torch.utils.data.Dataset):
    def __init__(self, subset, transform=None):
        self.subset = subset
        self.transform = transform
        
    def __getitem__(self, index):
        x, y = self.subset[index]
        if self.transform:
            x = self.transform(x)
        return x, y
        
    def __len__(self):
        return len(self.subset)

def get_dataloaders():
    # We will ignore files/directories that are not part of the dataset, 
    # but ImageFolder expects clean class folders.
    # Note: prepare_data.py should have prepared the folders.
    
    # Let's load all images with a dummy transform first just to get structure
    print("Loading dataset from", DATA_DIR)
    
    # Ensure we only load from the required class folders if possible, or just load all subfolders.
    # We assume prepare_data.py has renamed the subfolders.
    full_dataset = datasets.ImageFolder(root=DATA_DIR)
    class_names = full_dataset.classes
    print(f"Discovered classes: {class_names}")
    
    # Save classes for inference later
    with open('classes.txt', 'w') as f:
        f.write('\n'.join(class_names))
        
    # Split 80/20
    train_size = int(0.8 * len(full_dataset))
    val_size = len(full_dataset) - train_size
    
    train_subset, val_subset = random_split(full_dataset, [train_size, val_size])
    
    # Wrap subsets to apply specific transforms
    train_dataset = CustomDataset(train_subset, transform=train_transforms)
    val_dataset = CustomDataset(val_subset, transform=val_transforms)
    
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=4)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=4)
    
    return train_loader, val_loader, class_names

def train_model():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    train_loader, val_loader, class_names = get_dataloaders()
    num_classes = len(class_names)
    
    # Use pre-trained MobileNetV2
    model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)
    
    # Modify the classifier head for our number of classes
    model.classifier[1] = nn.Linear(model.last_channel, num_classes)
    model = model.to(device)
    
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.classifier.parameters(), lr=LEARNING_RATE)
    
    best_acc = 0.0
    
    for epoch in range(EPOCHS):
        print(f"Epoch {epoch+1}/{EPOCHS}")
        print("-" * 10)
        
        # Training phase
        model.train()
        running_loss = 0.0
        running_corrects = 0
        
        for inputs, labels in train_loader:
            inputs = inputs.to(device)
            labels = labels.to(device)
            
            optimizer.zero_grad()
            
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            _, preds = torch.max(outputs, 1)
            
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item() * inputs.size(0)
            running_corrects += torch.sum(preds == labels.data)
            
        train_loss = running_loss / len(train_loader.dataset)
        train_acc = running_corrects.double() / len(train_loader.dataset)
        print(f"Train Loss: {train_loss:.4f} Acc: {train_acc:.4f}")
        
        # Validation phase
        model.eval()
        running_loss = 0.0
        running_corrects = 0
        
        with torch.no_grad():
            for inputs, labels in val_loader:
                inputs = inputs.to(device)
                labels = labels.to(device)
                
                outputs = model(inputs)
                loss = criterion(outputs, labels)
                _, preds = torch.max(outputs, 1)
                
                running_loss += loss.item() * inputs.size(0)
                running_corrects += torch.sum(preds == labels.data)
                
        val_loss = running_loss / len(val_loader.dataset)
        val_acc = running_corrects.double() / len(val_loader.dataset)
        print(f"Val Loss: {val_loss:.4f} Acc: {val_acc:.4f}")
        
        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), MODEL_SAVE_PATH)
            print(f"Saved new best model with accuracy: {best_acc:.4f}")
            
    print(f"Training complete. Best validation accuracy: {best_acc:.4f}")

if __name__ == '__main__':
    train_model()
