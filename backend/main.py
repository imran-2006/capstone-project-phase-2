import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from collections import Counter, defaultdict
from dotenv import load_dotenv

load_dotenv()

from database import init_db, get_db, User, CheckIn
from auth_utils import hash_password, verify_password, create_access_token, get_current_user
from schemas import (
    RegisterRequest, LoginRequest, TokenResponse, CheckinRequest,
    PredictionResponse, HistoryItem, ProfileUpdateRequest, ChatRequest, ChatResponse,
)
from services.ml_service import predict_creative_block
from services.chat_service import get_chat_reply
from routes.insights import router as insights_router
from routes.creator import router as creator_router, get_field_label
from routes.model_insights import router as model_insights_router
from routes.journal import router as journal_router
from routes.rescue import router as rescue_router
from routes.blockbreaker import router as blockbreaker_router

app = FastAPI(title="Creative Block Predictor API")

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()
app.include_router(insights_router)
app.include_router(creator_router)
app.include_router(model_insights_router)
app.include_router(journal_router)
app.include_router(rescue_router)
app.include_router(blockbreaker_router)


@app.get("/")
def root():
    return {"status": "ok", "message": "Creative Block Predictor API is running"}


# ---------------------------------------------------------
# AUTH
# ---------------------------------------------------------
@app.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, user_name=user.name, user_email=user.email)


@app.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, user_name=user.name, user_email=user.email)


# ---------------------------------------------------------
# PREDICT
# ---------------------------------------------------------
@app.post("/predict", response_model=PredictionResponse)
def predict(
    payload: CheckinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = predict_creative_block(payload.model_dump())

    checkin = CheckIn(
        user_id=current_user.id,
        date=datetime.utcnow(),
        sleep_hours=payload.sleep_hours,
        stress_level=payload.stress_level,
        work_hours=payload.work_hours,
        inspiration_level=payload.inspiration_level,
        mood=payload.mood,
        energy_level=payload.energy_level,
        focus_level=payload.focus_level,
        screen_time=payload.screen_time,
        break_frequency=payload.break_frequency,
        risk_level=result["risk_level"],
        confidence=result["confidence"],
        reason=result["reason"],
        suggestions=",".join(result["suggestions"]),
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)

    return PredictionResponse(**result, checkin_id=checkin.id)


# ---------------------------------------------------------
# HISTORY
# ---------------------------------------------------------
@app.get("/history", response_model=list[HistoryItem])
def get_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(CheckIn)
        .filter(CheckIn.user_id == current_user.id)
        .order_by(CheckIn.date.desc())
        .all()
    )
    return [
        HistoryItem(
            id=r.id,
            date=r.date,
            sleep_hours=r.sleep_hours,
            stress_level=r.stress_level,
            work_hours=r.work_hours,
            mood=r.mood,
            risk_level=r.risk_level,
            confidence=r.confidence,
            suggestions=r.suggestions.split(",") if r.suggestions else [],
        )
        for r in rows
    ]


@app.delete("/history")
def clear_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(CheckIn).filter(CheckIn.user_id == current_user.id).delete()
    db.commit()
    return {"status": "ok", "message": "History cleared"}


@app.delete("/history/{checkin_id}")
def delete_checkin(
    checkin_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(CheckIn).filter(
        CheckIn.id == checkin_id, CheckIn.user_id == current_user.id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Check-in not found")
    db.delete(row)
    db.commit()
    return {"status": "ok"}


# ---------------------------------------------------------
# ANALYTICS
# ---------------------------------------------------------
@app.get("/analytics")
def get_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(CheckIn)
        .filter(CheckIn.user_id == current_user.id)
        .order_by(CheckIn.date.asc())
        .all()
    )

    mood_trend = [{"date": r.date.strftime("%Y-%m-%d"), "mood": r.mood} for r in rows]
    stress_trend = [{"date": r.date.strftime("%Y-%m-%d"), "stress_level": r.stress_level} for r in rows]
    productivity_trend = [
        {"date": r.date.strftime("%Y-%m-%d"), "focus_level": r.focus_level, "energy_level": r.energy_level}
        for r in rows
    ]
    risk_trend = [{"date": r.date.strftime("%Y-%m-%d"), "risk_level": r.risk_level} for r in rows]

    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    weekly_rows = [r for r in rows if r.date >= week_ago]
    monthly_rows = [r for r in rows if r.date >= month_ago]

    def summarize(subset):
        if not subset:
            return {"avg_sleep": 0, "avg_work_hours": 0, "avg_confidence": 0, "risk_counts": {}}
        return {
            "avg_sleep": round(sum(r.sleep_hours for r in subset) / len(subset), 1),
            "avg_work_hours": round(sum(r.work_hours for r in subset) / len(subset), 1),
            "avg_confidence": round(sum(r.confidence for r in subset) / len(subset), 1),
            "risk_counts": dict(Counter(r.risk_level for r in subset)),
        }

    return {
        "mood_trend": mood_trend,
        "stress_trend": stress_trend,
        "productivity_trend": productivity_trend,
        "risk_trend": risk_trend,
        "weekly_summary": summarize(weekly_rows),
        "monthly_summary": summarize(monthly_rows),
    }


# ---------------------------------------------------------
# REPORTS
# ---------------------------------------------------------
@app.get("/reports")
def get_reports(
    range: str = "week",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    if range == "week":
        since = now - timedelta(days=7)
    elif range == "month":
        since = now - timedelta(days=30)
    elif range == "year":
        since = now - timedelta(days=365)
    else:
        raise HTTPException(status_code=400, detail="range must be week, month, or year")

    rows = (
        db.query(CheckIn)
        .filter(CheckIn.user_id == current_user.id, CheckIn.date >= since)
        .order_by(CheckIn.date.asc())
        .all()
    )

    if not rows:
        return {
            "range": range, "total_checkins": 0, "avg_sleep": 0, "avg_work_hours": 0,
            "avg_energy": 0, "avg_focus": 0, "risk_distribution": {},
            "most_common_mood": None, "checkins": [],
        }

    risk_distribution = dict(Counter(r.risk_level for r in rows))
    mood_counts = Counter(r.mood for r in rows)

    return {
        "range": range,
        "total_checkins": len(rows),
        "avg_sleep": round(sum(r.sleep_hours for r in rows) / len(rows), 1),
        "avg_work_hours": round(sum(r.work_hours for r in rows) / len(rows), 1),
        "avg_energy": round(sum(r.energy_level for r in rows) / len(rows), 1),
        "avg_focus": round(sum(r.focus_level for r in rows) / len(rows), 1),
        "risk_distribution": risk_distribution,
        "most_common_mood": mood_counts.most_common(1)[0][0] if mood_counts else None,
        "checkins": [
            {
                "date": r.date.strftime("%Y-%m-%d"),
                "risk_level": r.risk_level,
                "confidence": r.confidence,
                "mood": r.mood,
            }
            for r in rows
        ],
    }


# ---------------------------------------------------------
# PROFILE
# ---------------------------------------------------------
@app.put("/profile")
def update_profile(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.name:
        current_user.name = payload.name
    if payload.email:
        current_user.email = payload.email
    db.commit()
    return {"status": "ok", "name": current_user.name, "email": current_user.email}


@app.get("/profile")
def get_profile(current_user: User = Depends(get_current_user)):
    return {"name": current_user.name, "email": current_user.email}


# ---------------------------------------------------------
# AI CHATBOT ASSISTANT
# ---------------------------------------------------------
@app.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    since = datetime.utcnow() - timedelta(days=30)
    rows = (
        db.query(CheckIn)
        .filter(CheckIn.user_id == current_user.id, CheckIn.date >= since)
        .order_by(CheckIn.date.asc())
        .all()
    )

    reply = get_chat_reply(payload.message, rows, get_field_label(db, current_user.id))
    return ChatResponse(reply=reply)
