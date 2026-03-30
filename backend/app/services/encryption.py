"""AES encryption for fingerprint image bytes using Fernet (symmetric)."""

import logging

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)


class EncryptionService:
    """
    Wraps Fernet for encrypting/decrypting binary fingerprint data.
    Key must be a URL-safe base64-encoded 32-byte key from env.
    """

    def __init__(self, fernet_key: str) -> None:
        if not fernet_key or not fernet_key.strip():
            raise ValueError(
                "FERNET_KEY is required. Generate: "
                "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        self._fernet = Fernet(fernet_key.strip().encode() if isinstance(fernet_key, str) else fernet_key)

    def encrypt(self, plain_bytes: bytes) -> bytes:
        """Encrypt raw image bytes; result is safe to store in MongoDB BinData."""
        return self._fernet.encrypt(plain_bytes)

    def decrypt(self, token: bytes) -> bytes:
        """Decrypt stored ciphertext back to original image bytes."""
        try:
            return self._fernet.decrypt(token)
        except InvalidToken:
            logger.warning("Fernet decrypt failed (wrong key or corrupted data)")
            raise ValueError("Could not decrypt fingerprint data") from None
