"""MongoDB connection via Motor (async)."""

import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import get_settings

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None
_database: AsyncIOMotorDatabase | None = None


async def connect_db() -> None:
    """Create MongoDB client and ping server."""
    global _client, _database
    settings = get_settings()
    _client = AsyncIOMotorClient(settings.mongodb_uri)
    _database = _client[settings.mongodb_db_name]
    await _client.admin.command("ping")
    logger.info("Connected to MongoDB: %s", settings.mongodb_db_name)


async def close_db() -> None:
    """Close MongoDB client."""
    global _client, _database
    if _client is not None:
        _client.close()
        _client = None
        _database = None
        logger.info("MongoDB connection closed")


def get_database() -> AsyncIOMotorDatabase:
    if _database is None:
        raise RuntimeError("Database not initialized. Call connect_db() on startup.")
    return _database
