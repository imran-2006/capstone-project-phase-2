from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth_utils import get_current_user
from database import CheckIn, RescueSession, User, get_db
from services.ml_service import predict_creative_block

router = APIRouter()

ALLOWED_RISK = ["Low", "Medium", "High", "Critical"]


def _rescue_plan_key_for_factor(feature_name: Optional[str]) -> str:
    if not feature_name:
        return "generic"
    normalized = str(feature_name).lower()
    if "sleep" in normalized:
        return "sleep"
    if "screen" in normalized:
        return "screen_time"
    if "stress" in normalized:
        return "stress"
    if "work" in normalized:
        return "work_hours"
    if "energy" in normalized or "focus" in normalized:
        return "energy"
    if "inspiration" in normalized:
        return "inspiration"
    if "mood" in normalized:
        return "mood"
    return "generic"


class RescueSessionPayload(BaseModel):
    started_at: Optional[datetime] = None
    completed: bool = False
    risk_level_before: Optional[str] = None
    feel_after: Optional[int] = Field(default=None, ge=1, le=5)
    creative_field: Optional[str] = None
    duration_seconds: int = Field(default=0, ge=0, le=3600)


@router.post("/rescue-sessions")
def save_rescue_session(
    payload: RescueSessionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.risk_level_before and payload.risk_level_before not in ALLOWED_RISK:
        raise HTTPException(status_code=422, detail="risk_level_before must be one of Low, Medium, High, Critical.")

    creative_field = payload.creative_field.strip() if payload.creative_field else None
    if creative_field and len(creative_field) > 80:
        raise HTTPException(status_code=422, detail="creative_field must be 80 characters or fewer.")

    row = RescueSession(
        user_id=current_user.id,
        started_at=payload.started_at or datetime.utcnow(),
        completed=bool(payload.completed),
        risk_level_before=payload.risk_level_before,
        feel_after=payload.feel_after,
        creative_field=creative_field,
        duration_seconds=payload.duration_seconds,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "completed": row.completed,
        "risk_level_before": row.risk_level_before,
        "feel_after": row.feel_after,
        "creative_field": row.creative_field,
        "duration_seconds": row.duration_seconds,
        "started_at": row.started_at,
    }


@router.get("/rescue/factors")
def get_rescue_factors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    latest = (
        db.query(CheckIn)
        .filter(CheckIn.user_id == current_user.id)
        .order_by(CheckIn.date.desc())
        .first()
    )

    if not latest:
        return {
            "top_factor": None,
            "plan_key": "generic",
            "message": "No recent check-in found. Using the default rescue plan.",
            "factors": [],
        }

    payload = {
        "sleep_hours": float(latest.sleep_hours or 0),
        "stress_level": latest.stress_level,
        "work_hours": float(latest.work_hours or 0),
        "inspiration_level": latest.inspiration_level,
        "mood": latest.mood,
        "energy_level": int(latest.energy_level or 5),
        "focus_level": int(latest.focus_level or 5),
        "screen_time": float(latest.screen_time or 0),
        "break_frequency": latest.break_frequency,
    }

    try:
        prediction = predict_creative_block(payload)
        factors = prediction.get("factors") or []
        if not factors:
            return {
                "top_factor": None,
                "plan_key": "generic",
                "message": "No clear blockers surfaced from your latest check-in. Use a gentle reset and one tiny next step.",
                "factors": [],
            }

        top_factor = factors[0]
        label = str(top_factor.get("label") or top_factor.get("feature") or "Stress")
        plan_key = _rescue_plan_key_for_factor(label)
        return {
            "top_factor": label,
            "plan_key": plan_key,
            "message": f"Your biggest risk factor today: {label}. Your rescue plan is adjusted for it.",
            "factors": factors[:3],
        }
    except Exception:
        return {
            "top_factor": None,
            "plan_key": "generic",
            "message": "The latest check-in was available, but the explanatory model could not calculate the strongest factor. Using a generic reset.",
            "factors": [],
        }


@router.get("/rescue-sessions/summary")
def get_rescue_session_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(RescueSession).filter(RescueSession.user_id == current_user.id).all()
    completed_count = sum(1 for row in rows if row.completed)
    feel_values = [row.feel_after for row in rows if row.feel_after is not None]
    average_feel_after = round(sum(feel_values) / len(feel_values), 2) if feel_values else 0.0
    return {
        "total_sessions": len(rows),
        "completed_count": completed_count,
        "average_feel_after": average_feel_after,
    }
