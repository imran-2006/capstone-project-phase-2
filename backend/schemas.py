from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_name: str
    user_email: str


class CheckinRequest(BaseModel):
    sleep_hours: float = Field(ge=0, le=12)
    stress_level: str
    work_hours: float = Field(ge=0, le=16)
    inspiration_level: str
    mood: str
    energy_level: int = Field(ge=1, le=10)
    focus_level: int = Field(ge=1, le=10)
    screen_time: float = Field(ge=0, le=12)
    break_frequency: str


class FactorItem(BaseModel):
    feature: str
    label: str
    value: str
    impact_pct: float
    direction: str  # "increases" or "reduces"


class PredictionResponse(BaseModel):
    risk_level: str
    confidence: float
    reason: str
    suggestions: List[str]
    factors: List[FactorItem] = []
    checkin_id: int


class HistoryItem(BaseModel):
    id: int
    date: datetime
    sleep_hours: float
    stress_level: str
    work_hours: float
    mood: str
    risk_level: str
    confidence: float
    suggestions: List[str]

    class Config:
        from_attributes = True


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


class ChatResponse(BaseModel):
    reply: str


class ForecastResponse(BaseModel):
    available: bool
    message: str
    trend: Optional[str] = None            # "worsening" | "improving" | "stable"
    forecast_level: Optional[str] = None   # Low / Medium / High / Critical
    forecast_score: Optional[float] = None
    based_on: int = 0
    recent: List[float] = []               # recent risk scores (0-3) for the mini chart
