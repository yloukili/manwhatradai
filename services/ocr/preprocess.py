import cv2
import numpy as np

def _ensure_3_channels(img: np.ndarray) -> np.ndarray:
    """
    PaddleOCR REQUIRES (H, W, 3)
    """
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    elif img.ndim == 3 and img.shape[2] == 1:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    return img


def upscale_if_needed(img: np.ndarray) -> tuple[np.ndarray, float]:
    h, w = img.shape[:2]
    if min(h, w) >= 1200:
        return img, 1.0
    print("resized")
    return cv2.resize(
        img,
        None,
        fx=2.0,
        fy=2.0,
        interpolation=cv2.INTER_CUBIC
    ), 2.0


def enhance_for_vietnamese(img: np.ndarray) -> np.ndarray:
    """
    Accent-sensitive enhancement
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    clahe = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8)
    )
    gray = clahe.apply(gray)

    # Light sharpen (safe)
    kernel = np.array(
        [[0, -1, 0],
         [-1, 5, -1],
         [0, -1, 0]],
        dtype=np.float32
    )
    gray = cv2.filter2D(gray, -1, kernel)

    # CRITICAL: convert back to 3 channels
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    # return img
    


def preprocess_image(img: np.ndarray, lang: str) -> tuple[np.ndarray, float]:
    """
    FINAL GUARANTEE:
    - uint8
    - (H, W, 3)
    """

    # Safety
    if img.dtype != np.uint8:
        img = img.astype(np.uint8)
    

    img = _ensure_3_channels(img)
    img, scale_factor = upscale_if_needed(img)

    if lang == "vietnamese":
        img = enhance_for_vietnamese(img)

    # FINAL SAFETY NET
    img = _ensure_3_channels(img)
    print("PREPROCESSING DONE")

    return img, scale_factor