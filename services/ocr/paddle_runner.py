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
# SINGLE PASS OCR (UNCHANGED)
# -----------------------------------------------------
def run_paddle_ocr(img, lang):
    if lang not in OCR_ENGINES:
        lang = DEFAULT_LANG

    engine = OCR_ENGINES[lang]
    raw = engine.ocr(img)

    return raw, CONF_THRESHOLDS.get(lang, 0.45)

def _extract_lines(raw):
    """
    Extract OCR lines from PaddleOCR 3.x document output.
    Returns a list of:
    {
        "box": [[x,y], [x,y], [x,y], [x,y]],
        "text": str,
        "score": float
    }
    """
    lines = []

    if not raw:
        return lines

    # raw is usually a list with one dict per page
    page = raw[0] if isinstance(raw, list) else raw

    if not isinstance(page, dict):
        return lines

    texts = page.get("rec_texts", [])
    scores = page.get("rec_scores", [])
    polys = page.get("rec_polys", [])

    n = min(len(texts), len(scores), len(polys))

    for i in range(n):
        box = polys[i]
        text = texts[i]
        score = scores[i]

        if not text:
            continue

        lines.append({
            "box": box.tolist() if hasattr(box, "tolist") else box,
            "text": text,
            "score": float(score)
        })

    return lines

def _line_key(line):
    """
    Vertical center of a line bounding box
    """
    if not line or "box" not in line:
        return None

    box = line["box"]
    ys = [pt[1] for pt in box]
    return sum(ys) / len(ys)


def align_lines(raw_passes, tolerance=25):
    """
    Align OCR lines from multiple passes by vertical proximity.

    Input:
        raw_passes = [raw_pass1, raw_pass2, raw_pass3, raw_pass4]

    Output:
        [
          [line_p1, line_p2, line_p3, line_p4],
          ...
        ]
    """

    # Normalize all passes
    passes = [_extract_lines(raw) for raw in raw_passes]
    if not passes or not passes[0]:
        return []

    reference = passes[0]
    aligned = []

    for ref in reference:
        ref_y = _line_key(ref)
        if ref_y is None:
            continue

        group = [ref]

        for other_pass in passes[1:]:
            best = None
            best_dist = tolerance

            for cand in other_pass:
                cy = _line_key(cand)
                if cy is None:
                    continue

                dist = abs(cy - ref_y)
                if dist < best_dist:
                    best = cand
                    best_dist = dist

            group.append(best)

        aligned.append(group)

    return aligned

# -----------------------------------------------------
# MULTI-PASS OCR (RAW + ALIGNED)
# -----------------------------------------------------
def run_multi_paddle_ocr(img, lang):
    """
    Multi-pass OCR:
    - 4 image variants
    - no filtering
    - no text modification
    - line-level alignment only
    """

    if lang not in OCR_ENGINES:
        lang = DEFAULT_LANG

    engine = OCR_ENGINES[lang]

    h, w = img.shape[:2]

    variants = [
        img,
        cv2.resize(img, (int(w * 1.5), int(h * 1.5))),
        cv2.filter2D(
            img,
            -1,
            np.array([[0, -1, 0],
                      [-1, 5, -1],
                      [0, -1, 0]])
        ),
        cv2.convertScaleAbs(img, alpha=1.4, beta=0),
    ]

    raw_passes = []
    for v in variants:
        raw_passes.append(engine.ocr(v))

    aligned = align_lines(raw_passes)

    raw = {
        "mode": "multi_pass",
        "passes": raw_passes,
        "aligned": aligned
    }

    return raw, CONF_THRESHOLDS.get(lang, 0.45)
