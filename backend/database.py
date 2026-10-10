"""
Database setup using SQLAlchemy + SQLite.
SQLite stores everything in a single file (app.db) - no external database
server needed. This keeps local setup simple. You can swap this for
Firebase/Postgres later without changing the API routes much.
"""

from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean
from sqlalchemy.orm import sessionmaker, declarative_base
import datetime

DATABASE_URL = "sqlite:///./app.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class CheckIn(Base):
    __tablename__ = "checkins"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    date = Column(DateTime, default=datetime.datetime.utcnow)

    sleep_hours = Column(Float)
    stress_level = Column(String)
    work_hours = Column(Float)
    inspiration_level = Column(String)
    mood = Column(String)
    energy_level = Column(Integer)
    focus_level = Column(Integer)
    screen_time = Column(Float)
    break_frequency = Column(String)

    risk_level = Column(String)
    confidence = Column(Float)
    reason = Column(String)
    suggestions = Column(String)  # stored as comma-separated string


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    entry_date = Column(DateTime, default=datetime.datetime.utcnow)
    mood = Column(String, nullable=False)
    text = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)


class RescueSession(Base):
    __tablename__ = "rescue_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed = Column(Boolean, default=False)
    risk_level_before = Column(String, nullable=True)
    feel_after = Column(Integer, nullable=True)
    creative_field = Column(String, nullable=True)
    duration_seconds = Column(Integer, default=0)


class BlockBreakerSession(Base):
    __tablename__ = "blockbreaker_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    game_key = Column(String, nullable=False)
    game_title = Column(String, nullable=False)
    creative_field = Column(String, nullable=True)
    mood = Column(String, nullable=True)
    output = Column(String, nullable=True)
    completed = Column(Boolean, default=True)
    duration_seconds = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
