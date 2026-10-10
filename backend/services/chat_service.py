"""
AI Chatbot Assistant service.

Takes the logged-in user's check-in history, aggregates it into a compact
summary (so we don't dump raw rows into the prompt), and sends it to
Groq (or Google Gemini) along with the user's question. The model is instructed to
answer ONLY using the given data and to avoid medical/mental-health
diagnosis.
"""

import os
from typing import Optional
from datetime import datetime, timedelta
from collections import Counter, defaultdict

from database import CheckIn

# Provider selection: Groq is used when GROQ_API_KEY is set (fast, free tier);
# otherwise Gemini is used when GEMINI_API_KEY is set. Both are optional.
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

_groq_client = None
_gemini_client = None

if GROQ_API_KEY:
    try:
        from groq import Groq
        _groq_client = Groq(api_key=GROQ_API_KEY)
    except Exception as _e:  # package missing or bad key format
        print(f"[chat] Groq unavailable: {_e}. Run: pip install groq")

if not _groq_client and GEMINI_API_KEY:
    try:
        from google import genai
        _gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as _e:
        print(f"[chat] Gemini unavailable: {_e}")

_client = _groq_client or _gemini_client

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _summarize_history(rows: list[CheckIn]) -> str:
    """Turn raw CheckIn rows into a compact, LLM-friendly text summary."""
    if not rows:
        return "The user has no check-in history yet."

    total = len(rows)
    avg_sleep = sum(r.sleep_hours for r in rows) / total
    avg_work = sum(r.work_hours for r in rows) / total
    avg_energy = sum(r.energy_level for r in rows) / total
    avg_focus = sum(r.focus_level for r in rows) / total
    avg_screen = sum(r.screen_time for r in rows) / total

    risk_counts = Counter(r.risk_level for r in rows)
    mood_counts = Counter(r.mood for r in rows)
    stress_counts = Counter(r.stress_level for r in rows)

    # Aggregate by day-of-week so the LLM can actually answer "why am I
    # tired on Mondays" style questions.
    by_day = defaultdict(list)
    for r in rows:
        day_name = DAY_NAMES[r.date.weekday()]
        by_day[day_name].append(r)

    day_lines = []
    for day in DAY_NAMES:
        day_rows = by_day.get(day)
        if not day_rows:
            continue
        d_sleep = sum(r.sleep_hours for r in day_rows) / len(day_rows)
        d_energy = sum(r.energy_level for r in day_rows) / len(day_rows)
        d_mood = Counter(r.mood for r in day_rows).most_common(1)[0][0]
        d_risk = Counter(r.risk_level for r in day_rows).most_common(1)[0][0]
        day_lines.append(
            f"- {day} ({len(day_rows)} entries): avg sleep {d_sleep:.1f}h, "
            f"avg energy {d_energy:.1f}/10, most common mood '{d_mood}', "
            f"most common risk '{d_risk}'"
        )

    recent = sorted(rows, key=lambda r: r.date, reverse=True)[:5]
    recent_lines = [
        f"- {r.date.strftime('%Y-%m-%d')} ({DAY_NAMES[r.date.weekday()]}): "
        f"sleep {r.sleep_hours}h, stress {r.stress_level}, work {r.work_hours}h, "
        f"mood {r.mood}, risk {r.risk_level} ({r.confidence}% confidence)"
        for r in recent
    ]

    summary = f"""
Total check-ins logged: {total}

Overall averages:
- Sleep: {avg_sleep:.1f} hours
- Work hours: {avg_work:.1f} hours
- Energy level: {avg_energy:.1f}/10
- Focus level: {avg_focus:.1f}/10
- Screen time: {avg_screen:.1f} hours

Risk level distribution: {dict(risk_counts)}
Mood distribution: {dict(mood_counts)}
Stress level distribution: {dict(stress_counts)}

Breakdown by day of week:
{chr(10).join(day_lines) if day_lines else "Not enough data across different days yet."}

Most recent 5 check-ins:
{chr(10).join(recent_lines)}
""".strip()

    return summary


SYSTEM_INSTRUCTION = """You are a supportive assistant inside the "Creative Block Predictor" app.
You help the user understand patterns in their own daily check-in data
(sleep, stress, work hours, mood, energy, focus, screen time) and their
creative block risk predictions.

Rules you must follow:
1. Only use the data provided to you in the "USER DATA SUMMARY" section below. Never invent numbers or entries that were not given to you.
2. If the data provided is insufficient to answer confidently, say so plainly instead of guessing.
3. Be concise and specific — reference actual numbers/days from the summary when relevant.
4. Do not diagnose any medical, psychological, or mental health condition. If the user's question goes beyond lifestyle/productivity patterns (e.g. sounds like a health concern), gently suggest they speak with a doctor or qualified professional.
5. Keep responses conversational and warm, 2-5 sentences unless the user asks for more detail.
"""


def get_chat_reply(user_message: str, rows: list[CheckIn], creative_field: Optional[str] = None) -> str:
    if not _client:
        return (
            "The chatbot isn't configured yet. Add your GROQ_API_KEY (or "
            "GEMINI_API_KEY) to the backend/.env file to enable this feature."
        )

    data_summary = _summarize_history(rows)

    field_note = ""
    if creative_field:
        field_note = (
            f"\nUSER CREATIVE FIELD (use only to make examples relevant, never as data): "
            f"{creative_field!r}\n"
        )

    prompt = f"""USER DATA SUMMARY:
{data_summary}
{field_note}
USER QUESTION:
{user_message}
"""

    try:
        if _groq_client:
            completion = _groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_INSTRUCTION},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.6,
                max_tokens=400,
            )
            return (completion.choices[0].message.content or "").strip()

        response = _gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={
                "system_instruction": SYSTEM_INSTRUCTION,
                "temperature": 0.6,
                "max_output_tokens": 400,
            },
        )
        return response.text.strip()
    except Exception as e:
        return f"Sorry, I couldn't reach the AI service right now. ({str(e)})"
