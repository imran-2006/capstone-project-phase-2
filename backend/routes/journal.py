import re
import unicodedata
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth_utils import get_current_user
from database import User, get_db, JournalEntry
from routes.creator import CreatorProfile
from services.creator_library import build_personalization

router = APIRouter()

ALLOWED_MOODS = ["Happy", "Neutral", "Motivated", "Tired", "Sad", "Frustrated"]


def _clean_text(value: str) -> str:
    if value is None:
        raise ValueError("Journal text is required.")
    text = unicodedata.normalize("NFC", str(value))
    text = "".join(ch for ch in text if unicodedata.category(ch) not in {"Cc", "Cs", "Co", "Cn"})
    text = re.sub(r"[\x00-\x1f\x7f]+", " ", text)
    if re.search(r"(?i)<\s*(script|iframe|object|img|svg|style|body|html)\b", text):
        raise ValueError("Journal text contains unsupported markup.")
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        raise ValueError("Journal text cannot be empty.")
    if len(text) > 1000:
        raise ValueError("Journal text must be 1000 characters or fewer.")
    return text


class JournalEntryPayload(BaseModel):
    mood: str
    text: str = Field(min_length=1, max_length=1000)
    entry_date: Optional[datetime] = None


class JournalEntryUpdatePayload(BaseModel):
    mood: str
    text: str = Field(min_length=1, max_length=1000)


@router.get("/journal/prompt")
def get_daily_prompt(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(CreatorProfile).filter(CreatorProfile.user_id == current_user.id).first()
    personalization = build_personalization(profile.field, profile.custom_field) if profile else build_personalization(None)
    return {
        "prompt": personalization["daily_prompt"],
        "field": profile.field if profile else None,
        "custom_field": profile.custom_field if profile else None,
    }


@router.get("/journal")
def list_journal_entries(
    search: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None, alias="from"),
    date_to: Optional[str] = Query(default=None, alias="to"),
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(JournalEntry).filter(JournalEntry.user_id == current_user.id)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(JournalEntry.text.ilike(term), JournalEntry.mood.ilike(term)))

    if date_from:
        try:
            start_dt = datetime.fromisoformat(date_from)
            query = query.filter(JournalEntry.entry_date >= start_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="from must be an ISO date or datetime string.")

    if date_to:
        try:
            end_dt = datetime.fromisoformat(date_to)
            query = query.filter(JournalEntry.entry_date <= end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="to must be an ISO date or datetime string.")

    rows = query.order_by(JournalEntry.entry_date.desc(), JournalEntry.id.desc()).offset(skip).limit(limit).all()
    return [{
        "id": row.id,
        "mood": row.mood,
        "text": row.text,
        "entry_date": row.entry_date,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    } for row in rows]


@router.post("/journal")
def create_journal_entry(
    payload: JournalEntryPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mood = (payload.mood or "").strip()
    if mood not in ALLOWED_MOODS:
        raise HTTPException(status_code=422, detail="Unknown mood.")

    try:
        clean_text = _clean_text(payload.text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    entry = JournalEntry(
        user_id=current_user.id,
        mood=mood,
        text=clean_text,
        entry_date=payload.entry_date or datetime.utcnow(),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {
        "id": entry.id,
        "mood": entry.mood,
        "text": entry.text,
        "entry_date": entry.entry_date,
        "created_at": entry.created_at,
        "updated_at": entry.updated_at,
    }


@router.put("/journal/{entry_id}")
def update_journal_entry(
    entry_id: int,
    payload: JournalEntryUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(JournalEntry).filter(JournalEntry.id == entry_id, JournalEntry.user_id == current_user.id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Journal entry not found.")

    mood = (payload.mood or "").strip()
    if mood not in ALLOWED_MOODS:
        raise HTTPException(status_code=422, detail="Unknown mood.")

    try:
        clean_text = _clean_text(payload.text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    row.mood = mood
    row.text = clean_text
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "mood": row.mood,
        "text": row.text,
        "entry_date": row.entry_date,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@router.delete("/journal/{entry_id}")
def delete_journal_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(JournalEntry).filter(JournalEntry.id == entry_id, JournalEntry.user_id == current_user.id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Journal entry not found.")
    db.delete(row)
    db.commit()
    return {"status": "ok", "message": "Journal entry deleted."}
