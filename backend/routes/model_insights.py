import os
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support
from sqlalchemy.orm import Session
import joblib

from database import User, get_db
from auth_utils import get_current_user
from ml.train_model import generate_dataset

router = APIRouter()

MODEL_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml", "model.pkl")
ENCODERS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml", "encoders.pkl")
FEATURES_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml", "feature_cols.pkl")

MODEL_CACHE: dict[str, Any] | None = None


def _ordered_classes():
    return ["Low", "Medium", "High", "Critical"]


def _load_model_bundle():
    missing = [p for p in (MODEL_FILE, ENCODERS_FILE, FEATURES_FILE) if not os.path.exists(p)]
    if missing:
        raise FileNotFoundError(f"Model artifacts missing: {', '.join(os.path.basename(p) for p in missing)}")

    model = joblib.load(MODEL_FILE)
    encoders = joblib.load(ENCODERS_FILE)
    feature_cols = joblib.load(FEATURES_FILE)
    return model, encoders, feature_cols


def _recompute_metrics():
    global MODEL_CACHE
    if MODEL_CACHE is not None:
        return MODEL_CACHE

    try:
        model, encoders, feature_cols = _load_model_bundle()
    except FileNotFoundError as exc:
        raise RuntimeError(str(exc))

    df = generate_dataset(3000)
    if df.empty:
        raise RuntimeError("Synthetic evaluation dataset is empty.")

    label_encoder = encoders["creative_block_label"]
    ordered_classes = _ordered_classes()
    ordered_labels = label_encoder.transform(ordered_classes)

    for col in ["stress_level", "inspiration_level", "mood", "break_frequency"]:
        df[f"{col}_enc"] = encoders[col].transform(df[col])

    df["label_enc"] = label_encoder.transform(df["creative_block_label"])

    X = df[feature_cols]
    y = df["label_enc"]

    preds = model.predict(X)
    accuracy = float(accuracy_score(y, preds))

    precision, recall, f1, support = precision_recall_fscore_support(
        y,
        preds,
        labels=ordered_labels,
        zero_division=0,
        average=None,
    )

    cm = confusion_matrix(y, preds, labels=ordered_labels)
    class_metrics = [
        {
            "label": label,
            "precision": round(float(p), 4),
            "recall": round(float(r), 4),
            "f1": round(float(f), 4),
            "support": int(s),
        }
        for label, p, r, f, s in zip(ordered_classes, precision, recall, f1, support)
    ]

    feature_importance = []
    for feature, importance in sorted(zip(feature_cols, model.feature_importances_), key=lambda item: item[1], reverse=True):
        feature_importance.append({
            "feature": feature,
            "importance_percent": round(float(importance) * 100, 4),
        })

    class_distribution = {label: int((df["creative_block_label"] == label).sum()) for label in ordered_classes}

    results = {
        "feature_importance": feature_importance,
        "metrics": {
            "accuracy": round(accuracy, 4),
            "class_metrics": class_metrics,
            "confusion_matrix": {
                "labels": ordered_classes,
                "matrix": cm.tolist(),
            },
        },
        "dataset_info": {
            "records": int(len(df)),
            "class_distribution": class_distribution,
            "classes": ordered_classes,
            "note": "Synthetic data generated from a rule-based risk score",
        },
        "model_info": {
            "algorithm": type(model).__name__,
            "n_estimators": getattr(model, "n_estimators", None),
            "max_depth": getattr(model, "max_depth", None),
            "n_features": int(model.n_features_in_),
        },
    }

    MODEL_CACHE = results
    return results


@router.get("/model-insights")
def get_model_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = db, current_user
    try:
        return _recompute_metrics()
    except Exception as exc:  # pragma: no cover - surfaced as clear message
        raise HTTPException(status_code=503, detail=f"Model insights are unavailable: {exc}") from exc
