import pandas as pd
import numpy as np
import sys
import os

# ─────────────────────────────────────────────
# 1. LOAD THE TWO DATASETS
#    Update these paths to wherever your CSV files are located.
# ─────────────────────────────────────────────

INDIAN_WQ_PATH    = r"C:\\Users\\slaxm\\Downloads\\ML_project_58\\water_dataX.csv"   # ← change to your file path
POTABILITY_PATH   = r"C:\Users\slaxm\Downloads\ML_project_58\water_potability.csv"        # ← change to your file path
OUTPUT_PATH       = r"C:\Users\slaxm\Downloads\ML_project_58\Dataset.csv"

print("=" * 60)
print("  WATER QUALITY DATASET MERGER")
print("=" * 60)

# ── Load Indian Water Quality dataset ──────────────────────────
print(f"\n[1/5] Loading Indian Water Quality data from: {INDIAN_WQ_PATH}")
try:
    indian_df = pd.read_csv(INDIAN_WQ_PATH, encoding="latin-1")
except FileNotFoundError:
    sys.exit(f"ERROR: Could not find '{INDIAN_WQ_PATH}'. Please update the path.")

print(f"      Rows: {len(indian_df):,}  |  Columns: {list(indian_df.columns)}")

# ── Load Water Potability dataset ──────────────────────────────
print(f"\n[2/5] Loading Water Potability data from: {POTABILITY_PATH}")
try:
    potability_df = pd.read_csv(POTABILITY_PATH)
except FileNotFoundError:
    sys.exit(f"ERROR: Could not find '{POTABILITY_PATH}'. Please update the path.")

print(f"      Rows: {len(potability_df):,}  |  Columns: {list(potability_df.columns)}")


# ─────────────────────────────────────────────
# 2. EXTRACT REQUIRED COLUMNS
# ─────────────────────────────────────────────
print("\n[3/5] Extracting required columns...")

# Indian WQ  → Temp, D.O., PH  (rename for consistency)
indian_cols = {
    "PH"          : "ph",
    "Temp"        : "temperature",
    "D.O. (mg/l)" : "dissolved_oxygen",
}
indian_sel = indian_df[list(indian_cols.keys())].rename(columns=indian_cols).copy()
indian_sel["source"] = "Indian_WQ"

# Potability → ph, Turbidity, Conductivity
pot_cols = {
    "ph"          : "ph",
    "Turbidity"   : "turbidity",
    "Conductivity": "conductivity",
    "Potability"  : "potability",
}
pot_sel = potability_df[list(pot_cols.keys())].rename(columns=pot_cols).copy()
pot_sel["source"] = "Potability"

print(f"      Indian WQ  subset shape : {indian_sel.shape}")
print(f"      Potability subset shape : {pot_sel.shape}")


# ─────────────────────────────────────────────
# 3. ROUND pH TO 1 DECIMAL FOR MERGE KEY
#    This creates a 'ph_key' column to match on
#    (e.g. 6.87 and 6.83 → both become 6.9)
# ─────────────────────────────────────────────
print("\n[4/5] Merging on common (rounded) pH values...")

indian_sel  = indian_sel.dropna(subset=["ph"])
pot_sel     = pot_sel.dropna(subset=["ph"])

indian_sel["ph_key"] = indian_sel["ph"].round(1)
pot_sel["ph_key"]    = pot_sel["ph"].round(1)

# Inner join on ph_key — only keep rows where pH exists in BOTH datasets
merged = pd.merge(
    pot_sel,
    indian_sel[["ph_key", "temperature", "dissolved_oxygen"]],
    on="ph_key",
    how="inner",
)

# Drop the helper key column; keep the original ph column
merged.drop(columns=["ph_key", "source"], inplace=True, errors="ignore")

# Reorder columns nicely
final_cols = [
    "ph",
    "turbidity",
    "conductivity",
    "dissolved_oxygen",
    "temperature",
    "potability",
]
merged = merged[final_cols]

print(f"      Merged dataset shape    : {merged.shape}")
print(f"\n      Sample (first 5 rows):")
print(merged.head().to_string(index=False))


# ─────────────────────────────────────────────
# 4. SAVE OUTPUT
# ─────────────────────────────────────────────
merged.to_csv(OUTPUT_PATH, index=False)
print(f"\n[5/5] Saved merged dataset → '{OUTPUT_PATH}'")

# ── Summary stats ──────────────────────────────────────────────
print("\n" + "=" * 60)
print("  SUMMARY STATISTICS")
print("=" * 60)
print(merged.describe().round(3).to_string())
print("\nNull counts:")
print(merged.isnull().sum().to_string())
print("\nDone! ✓")