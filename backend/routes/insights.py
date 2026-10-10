"""
Risk Forecast endpoint.

Looks at the user's most recent check-ins, turns each risk level into a number
(Low=0, Medium=1, High=2, Critical=3), fits a straight trend line through them
and blends it with the average of the last 3 check-ins to estimate the risk of
the NEXT check-in.

This is a light-weight statistical forecast (not a second ML model), so the app
is honest about it: it needs at least 3 check-ins and the message says it is an
estimate based on the recent trend.
"""

import numpy as np
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db, User, CheckIn
from auth_utils import get_current_user
from schemas import ForecastResponse

router = APIRouter()

LEVELS = ["Low", "Medium", "High", "Critical"]
SCORE = {name: i for i, name in enumerate(LEVELS)}
MIN_CHECKINS = 3
WINDOW = 14  # look at the most recent 14 check-ins


def _message(trend: str, level: str, n: int) -> str:
    if trend == "worsening":
        base = f"Your last {n} check-ins show risk creeping up."
        tail = {
            "Low": "It is still low, but keep an eye on sleep and breaks.",
            "Medium": "Take a proper break and protect your sleep before it climbs further.",
            "High": "Plan lighter work and an early night to stop the climb.",
            "Critical": "Consider resting today and cutting your workload to avoid a full block.",
        }[level]
    elif trend == "improving":
        base = f"Good news, your last {n} check-ins show risk coming down."
        tail = {
            "Low": "Keep the same routine, it is clearly working.",
            "Medium": "You are heading in the right direction, keep your breaks and sleep steady.",
            "High": "Still elevated, but improving. Do not drop the healthy habits now.",
            "Critical": "Still elevated, but the trend is improving. Keep resting.",
        }[level]
    else:
        base = f"Your last {n} check-ins look steady."
        tail = {
            "Low": "Expect another low-risk check-in if you keep this routine.",
            "Medium": "Expect a medium-risk check-in unless something changes.",
            "High": "Risk has been staying high, try changing one habit (sleep or breaks) today.",
            "Critical": "Risk has stayed critical, please reduce workload and rest.",
        }[level]
    return f"{base} {tail}"


@router.get("/forecast", response_model=ForecastResponse)
def get_forecast(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(CheckIn)
        .filter(CheckIn.user_id == current_user.id)
        .order_by(CheckIn.date.desc())
        .limit(WINDOW)
        .all()
    )
    rows = list(reversed(rows))  # oldest -> newest

    scores = [SCORE[r.risk_level] for r in rows if r.risk_level in SCORE]
    n = len(scores)

    if n < MIN_CHECKINS:
        return ForecastResponse(
            available=False,
            message=f"Log at least {MIN_CHECKINS} check-ins to unlock your risk forecast "
                    f"({n} so far).",
            based_on=n,
            recent=[float(s) for s in scores],
        )

    y = np.array(scores, dtype=float)
    x = np.arange(n, dtype=float)
    slope, intercept = np.polyfit(x, y, 1)

    trend_projection = slope * n + intercept
    recent_avg = float(np.mean(y[-3:]))
    forecast = float(np.clip(0.5 * trend_projection + 0.5 * recent_avg, 0, 3))

    level = LEVELS[int(round(forecast))]
    if slope > 0.1:
        trend = "worsening"
    elif slope < -0.1:
        trend = "improving"
    else:
        trend = "stable"

    return ForecastResponse(
        available=True,
        message=_message(trend, level, n),
        trend=trend,
        forecast_level=level,
        forecast_score=round(forecast, 2),
        based_on=n,
        recent=[float(s) for s in scores],
    )
