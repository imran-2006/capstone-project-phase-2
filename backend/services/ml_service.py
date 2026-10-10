"""
ML prediction service with Explainable AI.

Besides the risk level / confidence / reason / suggestions, every prediction now
also returns "factors": how much EACH input (sleep, stress, focus...) pushed the
risk up or down for THIS specific check-in.

How the explanation works (marginal "what-if" method):
1. Ask the model for the expected risk score of the user's real inputs.
2. For every feature, replace ONLY that feature with a range of typical values
   (all categories, or an even grid of numbers) and average the model's risk score.
3. Difference = how much that one feature moved the risk compared with a typical day.
   Positive -> it pushed risk UP, negative -> it was protecting the user.
"""

import os
import joblib
import numpy as np
import pandas as pd

ML_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml")

_model = joblib.load(os.path.join(ML_DIR, "model.pkl"))
_encoders = joblib.load(os.path.join(ML_DIR, "encoders.pkl"))
_feature_cols = joblib.load(os.path.join(ML_DIR, "feature_cols.pkl"))

label_encoder = _encoders["creative_block_label"]

# Severity by class NAME (never by index, class order is alphabetical in the encoder)
SEVERITY = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}
_CLASS_SEVERITY = np.array(
    [SEVERITY[name] for name in label_encoder.inverse_transform(_model.classes_)],
    dtype=float,
)

# Typical value ranges used as the reference for the what-if comparison
NUMERIC_REFERENCE = {
    "sleep_hours": np.linspace(3, 10, 8),
    "work_hours": np.linspace(2, 14, 7),
    "energy_level": np.arange(1, 11),
    "focus_level": np.arange(1, 11),
    "screen_time": np.linspace(1, 12, 8),
}
CATEGORICAL_FEATURES = ["stress_level", "inspiration_level", "mood", "break_frequency"]
MIN_IMPACT = 0.02  # ignore influences smaller than this (on the 0-3 risk scale)

FEATURE_LABELS = {
    "sleep_hours": "Sleep",
    "stress_level": "Stress",
    "work_hours": "Work hours",
    "inspiration_level": "Inspiration",
    "mood": "Mood",
    "energy_level": "Energy",
    "focus_level": "Focus",
    "screen_time": "Screen time",
    "break_frequency": "Breaks",
}

FEATURE_UNITS = {
    "sleep_hours": "h",
    "work_hours": "h",
    "screen_time": "h",
    "energy_level": "/10",
    "focus_level": "/10",
}

SUGGESTION_POOL = {
    "sleep": "Sleep at least 7-8 hours tonight",
    "stress": "Practice 10 minutes of meditation",
    "workload": "Reduce today's workload if possible",
    "break": "Take a short 10-15 minute break",
    "music": "Listen to relaxing music",
    "walk": "Go for a short walk outside",
    "water": "Drink water and stay hydrated",
    "warmup": "Try a 5-minute creative warm-up exercise",
    "screen": "Take a break from screens for 30 minutes",
    "focus": "Try a single-task focus sprint (25 min, no distractions)",
}


def _encode_frame(rows: list) -> pd.DataFrame:
    """Encode many check-ins at once, keeping the column names the model was trained with."""
    encoded = []
    for data in rows:
        row = {}
        for col in _feature_cols:
            if col.endswith("_enc"):
                base_col = col.replace("_enc", "")
                le = _encoders[base_col]
                value = data[base_col]
                if value not in le.classes_:  # unseen category, fall back gracefully
                    value = le.classes_[0]
                row[col] = le.transform([value])[0]
            else:
                row[col] = data[col]
        encoded.append(row)
    return pd.DataFrame(encoded, columns=_feature_cols)


def _risk_scores(rows: list) -> np.ndarray:
    """Probability-weighted risk score (0 = Low ... 3 = Critical) for each row."""
    probs = _model.predict_proba(_encode_frame(rows))
    return probs @ _CLASS_SEVERITY


def _reference_values(feature: str) -> list:
    if feature in CATEGORICAL_FEATURES:
        return list(_encoders[feature].classes_)
    return list(NUMERIC_REFERENCE[feature])


def _format_value(feature: str, value) -> str:
    if feature in FEATURE_UNITS:
        return f"{float(value):g}{FEATURE_UNITS[feature]}"
    return str(value)


def explain_prediction(data: dict, top_n: int = 5) -> list:
    """Return the features that influenced this prediction most, with % impact."""
    base_score = float(_risk_scores([data])[0])

    raw = []
    for feature in FEATURE_LABELS:
        variants = []
        for ref in _reference_values(feature):
            row = dict(data)
            row[feature] = ref
            variants.append(row)
        typical_score = float(np.mean(_risk_scores(variants)))
        raw.append((feature, base_score - typical_score))  # >0 : worse than a typical day

    raw = [(f, d) for f, d in raw if abs(d) >= MIN_IMPACT]
    total = sum(abs(d) for _, d in raw)
    if total <= 0:
        return []

    factors = [{
        "feature": feature,
        "label": FEATURE_LABELS[feature],
        "value": _format_value(feature, data[feature]),
        "impact_pct": round(abs(delta) / total * 100, 1),
        "direction": "increases" if delta > 0 else "reduces",
    } for feature, delta in raw]

    factors.sort(key=lambda f: f["impact_pct"], reverse=True)
    return factors[:top_n]


def _build_reason(data: dict, risk_level: str) -> str:
    reasons = []
    if data["sleep_hours"] < 6:
        reasons.append("insufficient sleep")
    if data["stress_level"] in ("High", "Very High"):
        reasons.append("high stress")
    if data["inspiration_level"] in ("Very Low", "Low"):
        reasons.append("low inspiration")
    if data["work_hours"] > 9:
        reasons.append("long work hours")
    if data["energy_level"] <= 4:
        reasons.append("low energy")
    if data["focus_level"] <= 4:
        reasons.append("poor focus")
    if data["screen_time"] > 8:
        reasons.append("excessive screen time")
    if data["mood"] in ("Sad", "Frustrated", "Tired"):
        reasons.append(f"a {data['mood'].lower()} mood")
    if data["break_frequency"] == "Rarely":
        reasons.append("too few breaks")

    if not reasons:
        return "Your metrics look balanced today, keep up the good habits."

    reason_text = ", ".join(reasons[:-1])
    if len(reasons) > 1:
        reason_text += f", and {reasons[-1]}"
    else:
        reason_text = reasons[0]
    return f"{reason_text.capitalize()} detected."


def _build_suggestions(data: dict, risk_level: str) -> list:
    suggestions = []
    if data["sleep_hours"] < 7:
        suggestions.append(SUGGESTION_POOL["sleep"])
    if data["stress_level"] in ("High", "Very High"):
        suggestions.append(SUGGESTION_POOL["stress"])
    if data["work_hours"] > 9:
        suggestions.append(SUGGESTION_POOL["workload"])
    if data["break_frequency"] == "Rarely":
        suggestions.append(SUGGESTION_POOL["break"])
    if data["mood"] in ("Sad", "Frustrated", "Tired"):
        suggestions.append(SUGGESTION_POOL["music"])
    if data["energy_level"] <= 5:
        suggestions.append(SUGGESTION_POOL["walk"])
    if data["screen_time"] > 7:
        suggestions.append(SUGGESTION_POOL["screen"])
    if data["focus_level"] <= 5:
        suggestions.append(SUGGESTION_POOL["focus"])
    if data["inspiration_level"] in ("Very Low", "Low"):
        suggestions.append(SUGGESTION_POOL["warmup"])
    suggestions.append(SUGGESTION_POOL["water"])

    seen, unique = set(), []
    for s in suggestions:
        if s not in seen:
            seen.add(s)
            unique.append(s)
    return unique[:6]


def predict_creative_block(data: dict) -> dict:
    X = _encode_frame([data])
    pred_class_idx = _model.predict(X)[0]
    probabilities = _model.predict_proba(X)[0]
    confidence = float(np.max(probabilities) * 100)

    risk_level = label_encoder.inverse_transform([pred_class_idx])[0]

    return {
        "risk_level": risk_level,
        "confidence": round(confidence, 1),
        "reason": _build_reason(data, risk_level),
        "suggestions": _build_suggestions(data, risk_level),
        "factors": explain_prediction(data),
    }
