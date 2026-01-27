from paddleocr import PaddleOCR
import os

BASE_DIR = os.path.dirname(__file__)
CONFIG_DIR = os.path.join(BASE_DIR, "..", "config")
OCR_VI_YAML = os.path.join(CONFIG_DIR, "ocr_vi.yaml")
PADDLEX_YAML = os.path.join(CONFIG_DIR, "paddlex_config.yaml")

# -----------------------------------------------------
# OCR ENGINES
# -----------------------------------------------------
OCR_ENGINES = {
    "korean": PaddleOCR(lang="korean", use_textline_orientation=False, use_doc_orientation_classify=False),
    "japanese": PaddleOCR(lang="japan", use_textline_orientation=False, use_doc_orientation_classify=False),
    "chinese_s": PaddleOCR(lang="ch", use_textline_orientation=False, use_doc_orientation_classify=False),
    "vietnamese": PaddleOCR(lang="vi", use_textline_orientation=False, use_doc_orientation_classify=False),
    # "english": PaddleOCR(lang="en", use_textline_orientation=False),
}

CONF_THRESHOLDS = {
    "vietnamese": 0.35,
    "korean": 0.45,
    "japanese": 0.45,
    "chinese_s": 0.45,
    # "english": 0.50,
}

DEFAULT_LANG = "vietnamese"


def run_paddle_ocr(img, lang):
    if lang not in OCR_ENGINES:
        lang = DEFAULT_LANG

    engine = OCR_ENGINES[lang]
    raw = engine.predict(img)

    return raw, CONF_THRESHOLDS.get(lang, 0.45)