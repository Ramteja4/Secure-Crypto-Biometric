"""Analytics routes for biometric login attempts."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.db import get_database
from app.models.login_attempt_model import (
    AnalyticsDistributionOut,
    AnalyticsSummaryOut,
    LOGIN_ATTEMPTS_COLLECTION,
    LoginAttemptOut,
    TrendPoint,
    UserAnalyticsOut,
    confidence_level,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _attempt_out(doc: dict[str, Any]) -> LoginAttemptOut:
    score = doc.get("match_score")
    threshold = doc.get("threshold")
    return LoginAttemptOut(
        email=str(doc.get("email", "")),
        match_score=float(score) if score is not None else None,
        threshold=float(threshold) if threshold is not None else None,
        success=bool(doc.get("success", False)),
        timestamp=doc["timestamp"],
        confidence=confidence_level(
            float(score) if score is not None else None,
            float(threshold) if threshold is not None else None,
        ),
    )


@router.get("/summary", response_model=AnalyticsSummaryOut)
async def analytics_summary():
    db: AsyncIOMotorDatabase = get_database()
    col = db[LOGIN_ATTEMPTS_COLLECTION]

    # One aggregation for counts + average score.
    pipeline = [
        {
            "$group": {
                "_id": None,
                "total": {"$sum": 1},
                "success": {"$sum": {"$cond": ["$success", 1, 0]}},
                "fail": {"$sum": {"$cond": ["$success", 0, 1]}},
                "avg_score": {"$avg": "$match_score"},
                # "False positives": success but score < threshold (should be rare/impossible, but defined)
                "false_positives": {
                    "$sum": {
                        "$cond": [
                            {
                                "$and": [
                                    "$success",
                                    {"$ne": ["$match_score", None]},
                                    {"$ne": ["$threshold", None]},
                                    {"$lt": ["$match_score", "$threshold"]},
                                ]
                            },
                            1,
                            0,
                        ]
                    }
                },
                # "False negatives": failed but score >= threshold
                "false_negatives": {
                    "$sum": {
                        "$cond": [
                            {
                                "$and": [
                                    {"$not": ["$success"]},
                                    {"$ne": ["$match_score", None]},
                                    {"$ne": ["$threshold", None]},
                                    {"$gte": ["$match_score", "$threshold"]},
                                ]
                            },
                            1,
                            0,
                        ]
                    }
                },
            }
        }
    ]

    rows = await col.aggregate(pipeline).to_list(length=1)
    if not rows:
        return AnalyticsSummaryOut(
            total_attempts=0,
            successful_logins=0,
            failed_logins=0,
            average_match_score=None,
            far=0.0,
            frr=0.0,
            success_rate=0.0,
        )

    r = rows[0]
    total = int(r.get("total", 0))
    success = int(r.get("success", 0))
    fail = int(r.get("fail", 0))
    avg_score = r.get("avg_score", None)
    fp = int(r.get("false_positives", 0))
    fn = int(r.get("false_negatives", 0))

    denom = float(total) if total else 1.0
    return AnalyticsSummaryOut(
        total_attempts=total,
        successful_logins=success,
        failed_logins=fail,
        average_match_score=float(avg_score) if avg_score is not None else None,
        far=fp / denom,
        frr=fn / denom,
        success_rate=success / denom,
    )


@router.get("/distribution", response_model=AnalyticsDistributionOut)
async def analytics_distribution():
    db: AsyncIOMotorDatabase = get_database()
    col = db[LOGIN_ATTEMPTS_COLLECTION]

    # Only attempts that have a score/threshold (invalid credentials won't).
    cursor = col.find(
        {"match_score": {"$ne": None}, "threshold": {"$ne": None}},
        projection={"_id": 0, "match_score": 1, "threshold": 1},
    ).sort("timestamp", -1)

    docs = await cursor.to_list(length=5000)
    scores: list[float] = []
    thresholds: list[float] = []
    for d in docs:
        scores.append(float(d["match_score"]))
        thresholds.append(float(d["threshold"]))
    return AnalyticsDistributionOut(match_scores=scores, thresholds=thresholds)


@router.get("/user/{email}", response_model=UserAnalyticsOut)
async def analytics_user(email: str):
    db: AsyncIOMotorDatabase = get_database()
    col = db[LOGIN_ATTEMPTS_COLLECTION]

    email_norm = email.strip().lower()
    cursor = col.find({"email": email_norm}, projection={"_id": 0}).sort("timestamp", 1)
    docs = await cursor.to_list(length=2000)
    attempts = [_attempt_out(d) for d in docs]

    trend: list[TrendPoint] = []
    for a in attempts:
        if a.match_score is None or a.threshold is None:
            continue
        c = confidence_level(a.match_score, a.threshold)
        if c is None:
            continue
        trend.append(
            TrendPoint(
                timestamp=a.timestamp,
                match_score=a.match_score,
                threshold=a.threshold,
                confidence=c,
            )
        )

    return UserAnalyticsOut(email=email_norm, attempts=attempts, trend=trend)

