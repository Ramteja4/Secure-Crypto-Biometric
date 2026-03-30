"""Registration, login, password verification, fingerprint gate, JWT issuance."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import Settings
from app.models.user_model import USERS_COLLECTION, UserDocument
from app.services.encryption import EncryptionService
from app.services.fingerprint import FingerprintService

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(
        self,
        db: AsyncIOMotorDatabase,
        settings: Settings,
        encryption: EncryptionService,
        fingerprint: FingerprintService,
    ) -> None:
        self._db = db
        self._settings = settings
        self._encryption = encryption
        self._fingerprint = fingerprint
        self._users = db[USERS_COLLECTION]

    @staticmethod
    def hash_password(plain: str) -> str:
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(plain.encode("utf-8"), salt).decode("utf-8")

    @staticmethod
    def verify_password(plain: str, hashed: str) -> bool:
        try:
            return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
        except ValueError:
            return False

    def create_access_token(self, subject_email: str) -> str:
        expire = datetime.now(timezone.utc) + timedelta(minutes=self._settings.jwt_expire_minutes)
        payload = {"sub": subject_email, "exp": expire}
        return jwt.encode(
            payload,
            self._settings.jwt_secret,
            algorithm=self._settings.jwt_algorithm,
        )

    def decode_token(self, token: str) -> str | None:
        try:
            payload = jwt.decode(
                token,
                self._settings.jwt_secret,
                algorithms=[self._settings.jwt_algorithm],
            )
            sub = payload.get("sub")
            return str(sub) if sub else None
        except JWTError:
            return None

    async def register(self, email: str, password: str, fingerprint_bytes: bytes) -> dict[str, Any]:
        email_norm = email.strip().lower()
        existing = await self._users.find_one({UserDocument.EMAIL: email_norm})
        if existing:
            return {"ok": False, "error": "email_exists", "message": "Email already registered"}

        pwd_hash = self.hash_password(password)
        enc_fp = self._encryption.encrypt(fingerprint_bytes)

        # Optional: store encrypted ORB descriptors (smaller, no raw image in DB after this path)
        enc_desc = None
        desc_raw = self._fingerprint.descriptor_bytes(fingerprint_bytes)
        if desc_raw:
            enc_desc = self._encryption.encrypt(desc_raw)

        doc = {
            UserDocument.EMAIL: email_norm,
            UserDocument.PASSWORD_HASH: pwd_hash,
            UserDocument.ENCRYPTED_FINGERPRINT: enc_fp,
        }
        if enc_desc:
            doc[UserDocument.ENCRYPTED_DESCRIPTOR] = enc_desc

        try:
            await self._users.insert_one(doc)
        except Exception as e:
            logger.exception("Insert user failed")
            return {"ok": False, "error": "db_error", "message": str(e)}

        logger.info("User registered: %s", email_norm)
        return {"ok": True, "message": "Registration successful"}

    async def login(self, email: str, password: str, fingerprint_bytes: bytes) -> dict[str, Any]:
        email_norm = email.strip().lower()
        user = await self._users.find_one({UserDocument.EMAIL: email_norm})
        if not user:
            return {"ok": False, "error": "invalid_credentials", "message": "Invalid email or password"}

        if not self.verify_password(password, user[UserDocument.PASSWORD_HASH]):
            return {"ok": False, "error": "invalid_credentials", "message": "Invalid email or password"}

        try:
            stored_cipher = user[UserDocument.ENCRYPTED_FINGERPRINT]
            if isinstance(stored_cipher, memoryview):
                stored_cipher = stored_cipher.tobytes()
            plain_stored = self._encryption.decrypt(bytes(stored_cipher))
        except (KeyError, ValueError) as e:
            logger.warning("Decrypt fingerprint failed for %s: %s", email_norm, e)
            return {"ok": False, "error": "server_error", "message": "Could not verify fingerprint data"}

        # Prefer descriptor-vs-descriptor if both sides have descriptors (faster, consistent)
        score: int
        if user.get(UserDocument.ENCRYPTED_DESCRIPTOR) and (
            desc_upload := self._fingerprint.descriptor_bytes(fingerprint_bytes)
        ):
            try:
                enc_desc = user[UserDocument.ENCRYPTED_DESCRIPTOR]
                if isinstance(enc_desc, memoryview):
                    enc_desc = enc_desc.tobytes()
                stored_desc = self._encryption.decrypt(bytes(enc_desc))
                score = self._fingerprint.match_descriptors(stored_desc, desc_upload)
            except Exception:
                score = self._fingerprint.match_score(plain_stored, fingerprint_bytes)
        else:
            score = self._fingerprint.match_score(plain_stored, fingerprint_bytes)

        threshold = self._settings.fingerprint_match_threshold
        if score < threshold:
            return {
                "ok": False,
                "error": "fingerprint_mismatch",
                "message": "Fingerprint does not match enrolled template",
                "match_score": score,
                "threshold": threshold,
            }

        token = self.create_access_token(email_norm)
        return {
            "ok": True,
            "message": "Login successful",
            "access_token": token,
            "token_type": "bearer",
            "match_score": score,
            "threshold": threshold,
        }
