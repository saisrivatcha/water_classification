import os
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, models, transforms
from torch.optim.lr_scheduler import CosineAnnealingLR
import time
import copy
import json
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import confusion_matrix, classification_report
from sklearn.linear_model import LogisticRegression
import joblib

# ─────────────────────────────────────────────
#  CONFIGURATION
# ─────────────────────────────────────────────
DATA_DIR        = '../dataset'
BATCH_SIZE      = 32
EPOCHS          = 25
WEIGHT_DECAY    = 1e-4
UNFREEZE_EPOCH  = 5
PATIENCE        = 7
NUM_WORKERS     = 4
CLASSES_FILE    = '../models/image_classification/classes.txt'

MODELS_CONFIG = [
    {'name': 'EfficientNet-B3',   'save_path': '../models/image_classification/model_efficientnet.pth',  'lr': 1e-3},
    {'name': 'ResNet-50',         'save_path': '../models/image_classification/model_resnet50.pth',       'lr': 5e-4},
    {'name': 'MobileNetV3-Large', 'save_path': '../models/image_classification/model_mobilenetv3.pth',    'lr': 1e-3},
]

# ─────────────────────────────────────────────
#  TRANSFORMS
# ─────────────────────────────────────────────
normalize = transforms.Normalize(
    mean=[0.485, 0.456, 0.406],
    std =[0.229, 0.224, 0.225]
)
train_transforms = transforms.Compose([
    transforms.RandomResizedCrop(224, scale=(0.7, 1.0)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomVerticalFlip(p=0.2),
    transforms.RandomRotation(15),
    transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.1),
    transforms.RandomGrayscale(p=0.05),
    transforms.ToTensor(),
    normalize,
])
val_transforms = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    normalize,
])

# ─────────────────────────────────────────────
#  DATASET WRAPPER
# ─────────────────────────────────────────────
class TransformSubset(torch.utils.data.Dataset):
    def __init__(self, subset, transform=None):
        self.subset    = subset
        self.transform = transform

    def __getitem__(self, idx):
        x, y = self.subset[idx]
        if self.transform:
            x = self.transform(x)
        return x, y

    def __len__(self):
        return len(self.subset)

# ─────────────────────────────────────────────
#  DATA LOADING
# ─────────────────────────────────────────────
def get_dataloaders():
    print(f"\n📂  Loading dataset from '{DATA_DIR}' ...")
    full_dataset = datasets.ImageFolder(root=DATA_DIR)
    class_names  = full_dataset.classes
    print(f"✅  Classes ({len(class_names)}): {class_names}")

    with open(CLASSES_FILE, 'w') as f:
        f.write('\n'.join(class_names))

    train_size = int(0.8 * len(full_dataset))
    val_size   = len(full_dataset) - train_size
    train_sub, val_sub = random_split(
        full_dataset, [train_size, val_size],
        generator=torch.Generator().manual_seed(42)
    )
    train_ds = TransformSubset(train_sub, train_transforms)
    val_ds   = TransformSubset(val_sub,   val_transforms)

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE,
                              shuffle=True,  num_workers=NUM_WORKERS, pin_memory=True)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE,
                              shuffle=False, num_workers=NUM_WORKERS, pin_memory=True)

    print(f"   Train: {train_size}  |  Val: {val_size}\n")
    return train_loader, val_loader, class_names

# ─────────────────────────────────────────────
#  MODEL BUILDERS  (frozen backbone to start)
# ─────────────────────────────────────────────
def build_efficientnet_b3(num_classes):
    m = models.efficientnet_b3(weights=models.EfficientNet_B3_Weights.IMAGENET1K_V1)
    for p in m.parameters():
        p.requires_grad = False
    in_f = m.classifier[1].in_features
    m.classifier = nn.Sequential(nn.Dropout(p=0.4), nn.Linear(in_f, num_classes))
    return m

def build_resnet50(num_classes):
    m = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V1)
    for p in m.parameters():
        p.requires_grad = False
    m.fc = nn.Sequential(nn.Dropout(p=0.4), nn.Linear(m.fc.in_features, num_classes))
    return m

def build_mobilenetv3(num_classes):
    m = models.mobilenet_v3_large(weights=models.MobileNet_V3_Large_Weights.IMAGENET1K_V1)
    for p in m.parameters():
        p.requires_grad = False
    in_f = m.classifier[-1].in_features
    m.classifier[-1] = nn.Linear(in_f, num_classes)
    return m

MODEL_BUILDERS = {
    'EfficientNet-B3':    build_efficientnet_b3,
    'ResNet-50':          build_resnet50,
    'MobileNetV3-Large':  build_mobilenetv3,
}

# ─────────────────────────────────────────────
#  TRAIN ONE MODEL
# ─────────────────────────────────────────────
def train_single(cfg, num_classes, train_loader, val_loader, device, class_names):
    name      = cfg['name']
    save_path = cfg['save_path']
    lr        = cfg['lr']

    print(f"\n{'='*55}")
    print(f"  Training : {name}")
    print(f"{'='*55}")

    model     = MODEL_BUILDERS[name](num_classes).to(device)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=lr, weight_decay=WEIGHT_DECAY
    )
    scheduler     = CosineAnnealingLR(optimizer, T_max=EPOCHS, eta_min=1e-6)
    best_acc      = 0.0
    best_wts      = copy.deepcopy(model.state_dict())
    patience_cnt  = 0

    for epoch in range(1, EPOCHS + 1):
        t0 = time.time()

        # Phase-2: unfreeze full backbone
        if epoch == UNFREEZE_EPOCH + 1:
            print(f"  🔓  Unfreezing full backbone ...")
            for p in model.parameters():
                p.requires_grad = True
            optimizer = optim.AdamW(model.parameters(), lr=lr / 10, weight_decay=WEIGHT_DECAY)
            scheduler = CosineAnnealingLR(optimizer, T_max=EPOCHS - UNFREEZE_EPOCH, eta_min=1e-7)

        # ── Train ──
        model.train()
        tr_loss = tr_cor = 0
        for inputs, labels in train_loader:
            inputs, labels = inputs.to(device), labels.to(device)
            optimizer.zero_grad()
            out  = model(inputs)
            loss = criterion(out, labels)
            loss.backward()
            optimizer.step()
            tr_loss += loss.item() * inputs.size(0)
            tr_cor  += (out.argmax(1) == labels).sum().item()

        # ── Validate ──
        model.eval()
        vl_loss = vl_cor = 0
        with torch.no_grad():
            for inputs, labels in val_loader:
                inputs, labels = inputs.to(device), labels.to(device)
                out  = model(inputs)
                loss = criterion(out, labels)
                vl_loss += loss.item() * inputs.size(0)
                vl_cor  += (out.argmax(1) == labels).sum().item()

        tr_acc = tr_cor / len(train_loader.dataset)
        vl_acc = vl_cor / len(val_loader.dataset)
        scheduler.step()

        print(f"  [{epoch:02d}/{EPOCHS}]  Train {tr_acc:.4f}  Val {vl_acc:.4f}  ({time.time()-t0:.1f}s)")

        if vl_acc > best_acc:
            best_acc = vl_acc
            best_wts = copy.deepcopy(model.state_dict())
            torch.save(model.state_dict(), save_path)
            print(f"    💾  Saved → {save_path}  (val_acc={best_acc:.4f})")
            patience_cnt = 0
        else:
            patience_cnt += 1
            if patience_cnt >= PATIENCE:
                print(f"  ⏹️  Early stop at epoch {epoch}")
                break

    model.load_state_dict(best_wts)
    print(f"  🏆  Best val accuracy: {best_acc:.4f}")

    # Generate Performance Matrix & Classification Report
    print(f"  📊  Evaluating Best Model to Generate Metrics...")
    model.eval()
    all_preds = []
    all_labels = []
    with torch.no_grad():
        for inputs, labels in val_loader:
            inputs, labels = inputs.to(device), labels.to(device)
            out = model(inputs)
            preds = out.argmax(1)
            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
            
    # Confusion Matrix Plot
    cm = confusion_matrix(all_labels, all_preds)
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=class_names, yticklabels=class_names)
    plt.xlabel('Predicted Labels')
    plt.ylabel('True Labels')
    plt.title(f'Confusion Matrix - {name}')
    plt.tight_layout()
    cm_dir = '../results/Confusion_Matrix'
    os.makedirs(cm_dir, exist_ok=True)
    cm_path = os.path.join(cm_dir, f'{name.replace("-", "_").lower()}.png')
    plt.savefig(cm_path)
    plt.close()
    
    # Classification Report
    cr = classification_report(all_labels, all_preds, labels=range(len(class_names)), target_names=class_names)
    cr_dir = '../results/Classification_Report'
    os.makedirs(cr_dir, exist_ok=True)
    cr_path = os.path.join(cr_dir, f'{name.replace("-", "_").lower()}.txt')
    with open(cr_path, 'w', encoding='utf-8') as f:
        f.write(f"Classification Report for {name}\n")
        f.write("="*55 + "\n")
        f.write(cr)
        
    print(f"    📈  Saved Confusion Matrix → {cm_path}")
    print(f"    📄  Saved Classification Report → {cr_path}")

    return best_acc

# ─────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────
def train_model():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"🖥️   Device: {device}")

    train_loader, val_loader, class_names = get_dataloaders()
    num_classes = len(class_names)

    results = {}
    for cfg in MODELS_CONFIG:
        acc = train_single(cfg, num_classes, train_loader, val_loader, device, class_names)
        results[cfg['name']] = acc

    print(f"\n{'='*55}")
    print("  Training Meta-Model (Stacking)")
    print(f"{'='*55}")

    # Load all 3 best models
    loaded_models = []
    for cfg in MODELS_CONFIG:
        m = MODEL_BUILDERS[cfg['name']](num_classes).to(device)
        m.load_state_dict(torch.load(cfg['save_path'], weights_only=True))
        m.eval()
        loaded_models.append(m)

    # Extract probabilities on val_loader
    X_meta = []
    y_meta = []
    
    print("  Extracting base model predictions on Validation Set...")
    with torch.no_grad():
        for inputs, labels in val_loader:
            inputs = inputs.to(device)
            # Get probs from each model
            batch_probs = []
            for m in loaded_models:
                probs = torch.nn.functional.softmax(m(inputs), dim=1)
                batch_probs.append(probs.cpu().numpy())
            
            # Concatenate along dim=1 -> (batch_size, 3 * num_classes)
            concat_probs = np.concatenate(batch_probs, axis=1)
            X_meta.extend(concat_probs)
            y_meta.extend(labels.numpy())

    X_meta = np.array(X_meta)
    y_meta = np.array(y_meta)

    print("  Fitting Logistic Regression Meta-Model...")
    meta_model = LogisticRegression(max_iter=1000)
    meta_model.fit(X_meta, y_meta)
    
    meta_model_path = '../models/image_classification/meta_model.pkl'
    joblib.dump(meta_model, meta_model_path)
    val_acc_meta = meta_model.score(X_meta, y_meta)
    print(f"    💾  Saved → {meta_model_path}  (val_acc={val_acc_meta:.4f})")

    print(f"\n{'='*55}")
    print("  SUMMARY")
    print(f"{'='*55}")
    for name, acc in results.items():
        print(f"  {name:25s}  →  {acc:.4f}")
    print(f"  Meta-Model (Stacking)      →  {val_acc_meta:.4f}")
    print(f"\n  📋  Meta-Model  → meta_model.pkl")
    print(f"  📋  Classes     → {CLASSES_FILE}")

if __name__ == '__main__':
    train_model()