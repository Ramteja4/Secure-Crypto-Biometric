"""
Biometric authentication API: FastAPI + MongoDB + Fernet + ORB fingerprint matching.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database.db import close_db, connect_db, get_database
from app.models.login_attempt_model import LOGIN_ATTEMPTS_COLLECTION, login_attempt_indexes
from app.models.user_model import USERS_COLLECTION, user_indexes
from app.routes.auth import router as auth_router
from app.routes.analytics import router as analytics_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    await connect_db()
    db = get_database()
    for keys, kwargs in user_indexes():
        await db[USERS_COLLECTION].create_index(list(keys.keys()), **kwargs)
    for keys, kwargs in login_attempt_indexes():
        await db[LOGIN_ATTEMPTS_COLLECTION].create_index(list(keys.keys()), **kwargs)
    logger.info("App started; CORS origins: %s", settings.cors_origins)
    yield
    await close_db()


app = FastAPI(title="Biometric Auth API", version="1.0.0", lifespan=lifespan)

settings = get_settings()
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(analytics_router)


@app.get("/")
async def root():
    return {"service": "biometric-auth-api", "docs": "/docs"}
