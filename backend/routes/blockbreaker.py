from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth_utils import get_current_user
from database import BlockBreakerSession, CheckIn, User, get_db
from routes.creator import CreatorProfile

router = APIRouter()

ALLOWED_MOODS = {"Happy", "Neutral", "Motivated", "Tired", "Sad", "Frustrated"}


class GameSessionPayload(BaseModel):
    game_key: str = Field(min_length=1, max_length=60)
    game_title: str = Field(min_length=1, max_length=100)
    creative_field: Optional[str] = Field(default=None, max_length=80)
    mood: Optional[str] = None
    output: Optional[str] = Field(default=None, max_length=1_000_000)
    completed: bool = True
    duration_seconds: int = Field(default=180, ge=0, le=180)


def _session_response(row):
    return {
        "id": row.id,
        "game_key": row.game_key,
        "game_title": row.game_title,
        "creative_field": row.creative_field,
        "mood": row.mood,
        "output": row.output,
        "completed": row.completed,
        "duration_seconds": row.duration_seconds,
        "created_at": row.created_at,
    }


@router.get("/blockbreaker/context")
def get_blockbreaker_context(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(CreatorProfile).filter(CreatorProfile.user_id == current_user.id).first()
    latest_checkin = (
        db.query(CheckIn)
        .filter(CheckIn.user_id == current_user.id)
        .order_by(CheckIn.date.desc())
        .first()
    )
    total_sessions = db.query(func.count(BlockBreakerSession.id)).filter(
        BlockBreakerSession.user_id == current_user.id
    ).scalar() or 0
    completed_sessions = db.query(func.count(BlockBreakerSession.id)).filter(
        BlockBreakerSession.user_id == current_user.id,
        BlockBreakerSession.completed.is_(True),
    ).scalar() or 0
    total_minutes = db.query(func.sum(BlockBreakerSession.duration_seconds)).filter(
        BlockBreakerSession.user_id == current_user.id,
        BlockBreakerSession.completed.is_(True),
    ).scalar() or 0
    rows = (
        db.query(BlockBreakerSession)
        .filter(BlockBreakerSession.user_id == current_user.id)
        .order_by(BlockBreakerSession.created_at.desc(), BlockBreakerSession.id.desc())
        .limit(30)
        .all()
    )
    return {
        "field": profile.field if profile else None,
        "custom_field": profile.custom_field if profile else None,
        "latest_mood": latest_checkin.mood if latest_checkin else None,
        "stats": {
            "total_sessions": total_sessions,
            "completed_sessions": completed_sessions,
            "minutes_played": round(total_minutes / 60),
        },
        "sessions": [_session_response(row) for row in rows],
    }


@router.post("/blockbreaker/sessions")
def save_blockbreaker_session(
    payload: GameSessionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mood = payload.mood.strip() if payload.mood else None
    if mood and mood not in ALLOWED_MOODS:
        raise HTTPException(status_code=422, detail="Unknown mood.")

    row = BlockBreakerSession(
        user_id=current_user.id,
        game_key=payload.game_key.strip(),
        game_title=payload.game_title.strip(),
        creative_field=payload.creative_field.strip() if payload.creative_field else None,
        mood=mood,
        output=payload.output,
        completed=payload.completed,
        duration_seconds=payload.duration_seconds,
        created_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _session_response(row)