"""
Water Quality Forecasting (Time Series - Linear Regression)
===========================================================
Dataset  : water_quality_with_timestamp.csv
Features : timestamp → predicts future values
Targets  : temperature, dissolved_oxygen, pH, conductivity
"""

import os
import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

# ─────────────────────────────────────────────
# 1. CONFIG
# ─────────────────────────────────────────────
CSV_PATH = "water_quality_with_timestamp.csv"
MODEL_DIR = "forecast_models"
os.makedirs(MODEL_DIR, exist_ok=True)

TARGET_COLUMNS = ["temperature", "dissolved_oxygen", "pH", "conductivity"]

# ─────────────────────────────────────────────
# 2. LOAD DATA
# ─────────────────────────────────────────────
print("=" * 50)
print(" Water Quality Forecasting Training")
print("=" * 50)

df = pd.read_csv(CSV_PATH)

# Convert timestamp to datetime
df['timestamp'] = pd.to_datetime(df['timestamp'])

# Sort by time
df = df.sort_values('timestamp')

print(f"\n[1/4] Dataset Loaded: {df.shape}")

# ─────────────────────────────────────────────
# 3. PREPARE TIME FEATURE
# ─────────────────────────────────────────────
# Convert timestamp → numerical (seconds)
df['time_index'] = (df['timestamp'] - df['timestamp'].min()).dt.total_seconds()

X = df[['time_index']].values

print("\n[2/4] Time feature created")

# ─────────────────────────────────────────────
# 4. TRAIN MODELS (ONE PER PARAMETER)
# ─────────────────────────────────────────────
models = {}

print("\n[3/4] Training models...")

for target in TARGET_COLUMNS:
    print(f"   → Training for: {target}")
    
    y = df[target].values
    
    model = LinearRegression()
    model.fit(X, y)
    
    # Save model
    model_path = os.path.join(MODEL_DIR, f"{target}_model.pkl")
    joblib.dump(model, model_path)
    
    models[target] = model
    
    print(f"     Saved → {model_path}")

# ─────────────────────────────────────────────
# 5. TEST FORECAST
# ─────────────────────────────────────────────
print("\n[4/4] Sample Forecast (Next 24 hours)")

last_time = df['time_index'].iloc[-1]

# Next 24 hours (in seconds)
future_steps = np.arange(
    last_time,
    last_time + 24 * 3600,
    3600  # hourly
).reshape(-1, 1)

for target in TARGET_COLUMNS:
    model = models[target]
    preds = model.predict(future_steps)
    
    print(f"\n   {target.upper()} Forecast:")
    print(preds[:5])  # show first 5 values

print("\nTraining Completed Successfully ✅")