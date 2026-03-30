"""User document shape and collection indexes for MongoDB."""

from typing import Any

# Collection name
USERS_COLLECTION = "users"


def user_indexes() -> list[tuple[str, Any]]:
    """Index definitions: (keys, kwargs)."""
    return [
        ({"email": 1}, {"unique": True, "name": "uniq_email"}),
    ]


class UserDocument:
    """Logical fields stored per user (not a Pydantic model — BSON from Motor)."""

    EMAIL = "email"
    PASSWORD_HASH = "password_hash"
    ENCRYPTED_FINGERPRINT = "encrypted_fingerprint"
    # Optional: precomputed ORB descriptors (encrypted) for smaller storage / faster compare
    ENCRYPTED_DESCRIPTOR = "encrypted_descriptor"
