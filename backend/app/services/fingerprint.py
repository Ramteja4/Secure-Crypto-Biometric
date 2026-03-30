"""
Fingerprint similarity using OpenCV ORB features and BFMatcher.

Both images are decoded from bytes, converted to grayscale, resized to a common
size, then ORB keypoints/descriptors are matched. The score is the number of
good matches (with optional ratio test for robustness).
"""

import logging

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# Standard size for comparison (reduces variance from resolution)
MATCH_WIDTH = 256
MATCH_HEIGHT = 256
ORB_FEATURES = 800


class FingerprintService:
    """ORB-based matcher between two fingerprint images (as file bytes)."""

    @staticmethod
    def _bytes_to_grayscale(image_bytes: bytes) -> np.ndarray | None:
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        # Decode as color then convert — handles PNG/JPEG uniformly
        bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if bgr is None:
            logger.warning("OpenCV could not decode image bytes")
            return None
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        return gray

    @staticmethod
    def preprocess(gray: np.ndarray) -> np.ndarray:
        """Resize and lightly enhance contrast for matching stability."""
        resized = cv2.resize(gray, (MATCH_WIDTH, MATCH_HEIGHT), interpolation=cv2.INTER_AREA)
        # CLAHE helps ridge patterns on uneven scans
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        return clahe.apply(resized)

    def match_score(self, image_a_bytes: bytes, image_b_bytes: bytes) -> int:
        """
        Compute ORB match count between two images.

        Returns:
            Non-negative integer: higher means more similar (same finger / scan).
        """
        g1 = self._bytes_to_grayscale(image_a_bytes)
        g2 = self._bytes_to_grayscale(image_b_bytes)
        if g1 is None or g2 is None:
            return 0

        p1 = self.preprocess(g1)
        p2 = self.preprocess(g2)

        orb = cv2.ORB_create(nfeatures=ORB_FEATURES, scaleFactor=1.2, nlevels=8)
        kp1, des1 = orb.detectAndCompute(p1, None)
        kp2, des2 = orb.detectAndCompute(p2, None)

        if des1 is None or des2 is None or len(des1) < 2 or len(des2) < 2:
            return 0

        # Brute-force Hamming on ORB binary descriptors
        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
        raw_matches = bf.knnMatch(des1, des2, k=2)

        # Lowe ratio test to reduce false matches
        good: list[cv2.DMatch] = []
        for pair in raw_matches:
            if len(pair) != 2:
                continue
            m, n = pair
            if m.distance < 0.75 * n.distance:
                good.append(m)

        score = len(good)
        logger.debug("ORB match score: %s (raw knn pairs: %s)", score, len(raw_matches))
        return score

    def descriptor_bytes(self, image_bytes: bytes) -> bytes | None:
        """
        Serialize ORB descriptors for optional encrypted storage (advanced).

        Format: uint32 num_kp, then flat float32 descriptors (ORB is uint8 per row).
        """
        g = self._bytes_to_grayscale(image_bytes)
        if g is None:
            return None
        p = self.preprocess(g)
        orb = cv2.ORB_create(nfeatures=ORB_FEATURES)
        _kp, des = orb.detectAndCompute(p, None)
        if des is None or len(des) == 0:
            return None
        header = np.array([des.shape[0], des.shape[1]], dtype=np.uint32).tobytes()
        return header + des.tobytes()

    def match_descriptors(self, desc_a: bytes, desc_b: bytes) -> int:
        """Match two serialized descriptor blobs (same ORB settings)."""
        if len(desc_a) < 8 or len(desc_b) < 8:
            return 0
        na = int.from_bytes(desc_a[0:4], "little")
        wa = int.from_bytes(desc_a[4:8], "little")
        nb = int.from_bytes(desc_b[0:4], "little")
        wb = int.from_bytes(desc_b[4:8], "little")
        if wa != wb or wa == 0:
            return 0
        da = np.frombuffer(desc_a[8 : 8 + na * wa], dtype=np.uint8).reshape(na, wa)
        db = np.frombuffer(desc_b[8 : 8 + nb * wb], dtype=np.uint8).reshape(nb, wb)
        if da.size < 2 or db.size < 2:
            return 0
        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
        raw_matches = bf.knnMatch(da, db, k=2)
        good: list[cv2.DMatch] = []
        for pair in raw_matches:
            if len(pair) != 2:
                continue
            m, n = pair
            if m.distance < 0.75 * n.distance:
                good.append(m)
        return len(good)
