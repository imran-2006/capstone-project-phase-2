"""
Creative Block Predictor - Model Training Script
--------------------------------------------------
This script:
1. Generates a realistic synthetic dataset of daily creative-work metrics
2. Encodes categorical fields (stress, mood, etc.) into numbers
3. Trains a RandomForestClassifier to predict "Creative Block Risk"
4. Saves the trained model + encoders to disk so the API can use them

Run with:  python train_model.py
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report
import joblib
import os

np.random.seed(42)

N = 3000  # number of synthetic daily records

STRESS_LEVELS = ["Low", "Medium", "High", "Very High"]
INSPIRATION_LEVELS = ["Very Low", "Low", "Medium", "High", "Very High"]
MOODS = ["Happy", "Neutral", "Motivated", "Tired", "Sad", "Frustrated"]
BREAK_FREQ = ["Rarely", "Sometimes", "Often"]
RISK_LABELS = ["Low", "Medium", "High", "Critical"]

# ---------------------------------------------------------
# 1. Generate synthetic but *logically consistent* data
# ---------------------------------------------------------
def generate_dataset(n=N):
    rows = []
    for _ in range(n):
        sleep_hours = round(np.random.uniform(3, 10), 1)
        work_hours = round(np.random.uniform(2, 14), 1)
        energy_level = np.random.randint(1, 11)
        focus_level = np.random.randint(1, 11)
        screen_time = round(np.random.uniform(1, 12), 1)

        stress_level = np.random.choice(STRESS_LEVELS, p=[0.3, 0.35, 0.25, 0.10])
        inspiration_level = np.random.choice(INSPIRATION_LEVELS, p=[0.10, 0.20, 0.30, 0.25, 0.15])
        mood = np.random.choice(MOODS)
        break_frequency = np.random.choice(BREAK_FREQ, p=[0.3, 0.4, 0.3])

        # ---- Score-based logic to decide risk label (keeps data realistic) ----
        score = 0
        score += (10 - sleep_hours) * 1.5          # less sleep -> higher risk
        score += max(0, work_hours - 8) * 1.2       # overwork -> higher risk
        score += (10 - energy_level) * 1.0
        score += (10 - focus_level) * 1.0
        score += max(0, screen_time - 6) * 0.8

        stress_map = {"Low": 0, "Medium": 4, "High": 8, "Very High": 12}
        score += stress_map[stress_level]

        inspiration_map = {"Very Low": 12, "Low": 8, "Medium": 4, "High": 0, "Very High": -3}
        score += inspiration_map[inspiration_level]

        mood_map = {"Happy": -3, "Motivated": -4, "Neutral": 2,
                    "Tired": 6, "Sad": 7, "Frustrated": 8}
        score += mood_map[mood]

        break_map = {"Often": -3, "Sometimes": 2, "Rarely": 6}
        score += break_map[break_frequency]

        # add a little noise so the model has to actually learn patterns
        score += np.random.normal(0, 4)

        if score < 15:
            label = "Low"
        elif score < 30:
            label = "Medium"
        elif score < 45:
            label = "High"
        else:
            label = "Critical"

        rows.append({
            "sleep_hours": sleep_hours,
            "stress_level": stress_level,
            "work_hours": work_hours,
            "inspiration_level": inspiration_level,
            "mood": mood,
            "energy_level": energy_level,
            "focus_level": focus_level,
            "screen_time": screen_time,
            "break_frequency": break_frequency,
            "creative_block_label": label,
        })

    return pd.DataFrame(rows)


def main():
    print("Generating synthetic dataset...")
    df = generate_dataset()
    print(df["creative_block_label"].value_counts())

    # ---------------------------------------------------------
    # 2. Encode categorical columns
    # ---------------------------------------------------------
    encoders = {}
    categorical_cols = ["stress_level", "inspiration_level", "mood", "break_frequency"]

    for col in categorical_cols:
        le = LabelEncoder()
        df[col + "_enc"] = le.fit_transform(df[col])
        encoders[col] = le

    label_encoder = LabelEncoder()
    df["label_enc"] = label_encoder.fit_transform(df["creative_block_label"])
    encoders["creative_block_label"] = label_encoder

    feature_cols = [
        "sleep_hours", "stress_level_enc", "work_hours", "inspiration_level_enc",
        "mood_enc", "energy_level", "focus_level", "screen_time", "break_frequency_enc",
    ]

    X = df[feature_cols]
    y = df["label_enc"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # ---------------------------------------------------------
    # 3. Train RandomForestClassifier
    # ---------------------------------------------------------
    print("\nTraining RandomForestClassifier...")
    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=10,
        min_samples_split=5,
        random_state=42,
        class_weight="balanced",
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    acc = accuracy_score(y_test, preds)
    print(f"\nTest Accuracy: {acc:.3f}\n")
    print(classification_report(y_test, preds, target_names=label_encoder.classes_))

    print("Feature importances:")
    for feat, imp in sorted(zip(feature_cols, model.feature_importances_), key=lambda x: -x[1]):
        print(f"  {feat}: {imp:.3f}")

    # ---------------------------------------------------------
    # 4. Save model + encoders + feature order
    # ---------------------------------------------------------
    out_dir = os.path.dirname(os.path.abspath(__file__))
    joblib.dump(model, os.path.join(out_dir, "model.pkl"))
    joblib.dump(encoders, os.path.join(out_dir, "encoders.pkl"))
    joblib.dump(feature_cols, os.path.join(out_dir, "feature_cols.pkl"))

    print(f"\nSaved model.pkl, encoders.pkl, feature_cols.pkl to {out_dir}")


if __name__ == "__main__":
    main()
