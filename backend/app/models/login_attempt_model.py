"""Login attempt collection, fields, and indexes."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


LOGIN_ATTEMPTS_COLLECTION = "login_attempts"


def login_attempt_indexes() -> list[tuple[dict[str, Any], dict[str, Any]]]:
    """Index definitions: (keys, kwargs)."""
    return [
        ({"email": 1, "timestamp": -1}, {"name": "email_ts"}),
        ({"timestamp": -1}, {"name": "ts_desc"}),
        ({"success": 1, "timestamp": -1}, {"name": "success_ts"}),
    ]


ConfidenceLevel = Literal["Low", "Medium", "High"]


def confidence_level(match_score: float | None, threshold: float | None) -> ConfidenceLevel | None:
    if match_score is None or threshold is None:
        return None
    if match_score >= threshold + 0.1:
        return "High"
    if threshold <= match_score < threshold + 0.1:
        return "Medium"
    return "Low"


class LoginAttemptInDB(BaseModel):
    """Document as persisted in MongoDB."""

    model_config = ConfigDict(extra="ignore")

    email: str
    match_score: float | None = None
    threshold: float | None = None
    success: bool
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LoginAttemptOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    email: str
    match_score: float | None = None
    threshold: float | None = None
    success: bool
    timestamp: datetime
    confidence: ConfidenceLevel | None = None


class AnalyticsSummaryOut(BaseModel):
    total_attempts: int
    successful_logins: int
    failed_logins: int
    average_match_score: float | None = None
    far: float
    frr: float
    success_rate: float


class AnalyticsDistributionOut(BaseModel):
    match_scores: list[float]
    thresholds: list[float]


class TrendPoint(BaseModel):
    timestamp: datetime
    match_score: float
    threshold: float
    confidence: ConfidenceLevel


class UserAnalyticsOut(BaseModel):
    email: str
    attempts: list[LoginAttemptOut]
    trend: list[TrendPoint]

