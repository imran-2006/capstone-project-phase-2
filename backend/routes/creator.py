"""
Creator Profile (creative field) endpoints.

Purely a personalization layer: it never touches the ML model, the check-in
data or the prediction logic. It only stores which creative field the user
picked (in its own table) and returns curated field-specific content.
"""

import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import Session

from database import Base, get_db, User
from auth_utils import get_current_user
from services.creator_library import (
    FIELD_KEYS, clean_custom_field, display_label, build_personalization,
)

router = APIRouter()


class CreatorProfile(Base):
    """New, separate table (additive). The existing tables are not modified."""

    __tablename__ = "creator_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, unique=True, index=True, nullable=False)
    field = Column(String, nullable=False)
    custom_field = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)


class CreatorProfileUpdate(BaseModel):
    field: str
    custom_field: Optional[str] = None


def _response(row):
    if row is None:
        return {
            "field": None,
            "custom_field": None,
            "label": None,
            "personalization": build_personalization(None),
        }
    return {
        "field": row.field,
        "custom_field": row.custom_field,
        "label": display_label(row.field, row.custom_field),
        "personalization": build_personalization(row.field, row.custom_field),
    }


def get_field_label(db: Session, user_id: int):
    """Used by the chat endpoint; returns a label or None. Never raises."""
    try:
        row = db.query(CreatorProfile).filter(CreatorProfile.user_id == user_id).first()
        return display_label(row.field, row.custom_field) if row else None
    except Exception:
        return None


@router.get("/creator-profile")
def read_creator_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(CreatorProfile).filter(CreatorProfile.user_id == current_user.id).first()
    return _response(row)


@router.put("/creator-profile")
def save_creator_profile(
    payload: CreatorProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    field = (payload.field or "").strip().lower()
    if field not in FIELD_KEYS:
        raise HTTPException(status_code=422, detail="Unknown creative field.")

    custom = None
    if field == "other":
        try:
            custom = clean_custom_field(payload.custom_field)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

    row = db.query(CreatorProfile).filter(CreatorProfile.user_id == current_user.id).first()
    if row is None:
        row = CreatorProfile(user_id=current_user.id, field=field, custom_field=custom)
        db.add(row)
    else:
        row.field = field
        row.custom_field = custom
        row.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _response(row)
