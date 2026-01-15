from paddleocr import PaddleOCR
import cv2
import numpy as np

# -----------------------------------------------------
# OCR ENGINES
# -----------------------------------------------------
OCR_ENGINES = {
    "korean": PaddleOCR(lang="korean", use_textline_orientation=False),
    "japanese": PaddleOCR(lang="japan", use_textline_orientation=False),
    "chinese_s": PaddleOCR(lang="ch", use_textline_orientation=False),
    "vietnamese": PaddleOCR(lang="vi", use_textline_orientation=False),
    "english": PaddleOCR(lang="en", use_textline_orientation=False),
}

# -----------------------------------------------------
# POST-OCR CONFIDENCE THRESHOLDS
# (applied later, not here)
# -----------------------------------------------------
CONF_THRESHOLDS = {
    "vietnamese": 0.35,
    "korean": 0.45,
    "japanese": 0.45,
    "chinese_s": 0.45,
    "english": 0.50,
}

DEFAULT_LANG = "vietnamese"


# -----------------------------------------------------
# SINGLE PASS OCR (unchanged behavior)
# -----------------------------------------------------
def run_paddle_ocr(img, lang):
    if lang not in OCR_ENGINES:
        lang = DEFAULT_LANG

    engine = OCR_ENGINES[lang]
    raw = engine.ocr(img)

    return raw, CONF_THRESHOLDS.get(lang, 0.45)


# -----------------------------------------------------
# MULTI-PASS OCR (NEW, BUT STILL RAW)
# -----------------------------------------------------
def run_multi_paddle_ocr(img, lang):
    """
    Run PaddleOCR on multiple image variants.
    Returns a list of raw OCR outputs.
    """
    if lang not in OCR_ENGINES:
        lang = DEFAULT_LANG

    engine = OCR_ENGINES[lang]

    variants = []

    # original
    variants.append(img)

    # upscale
    h, w = img.shape[:2]
    variants.append(cv2.resize(img, (int(w * 1.5), int(h * 1.5))))

    # sharpen
    kernel = np.array([[0, -1, 0],
                       [-1, 5, -1],
                       [0, -1, 0]])
    variants.append(cv2.filter2D(img, -1, kernel))

    # contrast boost
    variants.append(cv2.convertScaleAbs(img, alpha=1.4, beta=0))

    results = []
    for v in variants:
        results.append(engine.ocr(v))

    return results, CONF_THRESHOLDS.get(lang, 0.45)
