#!/usr/bin/env python3
import base64
import io
import unicodedata
from flask import Flask, request, jsonify
from paddleocr import PaddleOCR
from PIL import Image
import numpy as np

app = Flask(__name__)

# -----------------------------------------------------
# OCR ENGINES (one per language)
# -----------------------------------------------------
OCR_ENGINES = {
    "vietnamese": PaddleOCR(
        lang="vi",
        rec_score_thresh=0.1,
        use_textline_orientation=False,
        det_db_box_thresh=0.45
    ),
    "korean": PaddleOCR(lang="korean"),
    "japanese": PaddleOCR(lang="japan"),
    "chinese_s": PaddleOCR(lang="ch"),
}

DEFAULT_LANG = "vietnamese"

# -----------------------------------------------------
# UTILS
# -----------------------------------------------------
def decode_base64_to_image(base64_str):
    try:
        img_bytes = base64.b64decode(base64_str)
        pil_img = Image.open(io.BytesIO(img_bytes))
        if pil_img.mode not in ("RGB", "L"):
            pil_img = pil_img.convert("RGB")
        return np.array(pil_img)
    except Exception as e:
        print("Decode error:", e)
        return None


def normalize_text(text):
    return unicodedata.normalize("NFC", text.strip())


def parse_paddle_output(raw):
    """
    Parse PaddleOCR output and regroup text lines into speech bubbles.
    """

    regions = []

    # ---------------------------
    # Helpers
    # ---------------------------
    def quad_to_bbox(poly):
        try:
            xs = [float(p[0]) for p in poly]
            ys = [float(p[1]) for p in poly]
            return {
                "xmin": int(min(xs)),
                "ymin": int(min(ys)),
                "xmax": int(max(xs)),
                "ymax": int(max(ys)),
            }
        except:
            return None

    def group_lines_into_bubbles(lines):
        if not lines:
            return []

        lines = sorted(lines, key=lambda l: (l["ymin"], l["xmin"]))
        bubbles = []
        current = None

        for line in lines:
            line_height = line["ymax"] - line["ymin"]
            line_width = line["xmax"] - line["xmin"]

            if current is None:
                current = {
                    "lines": [line],
                    "xmin": line["xmin"],
                    "xmax": line["xmax"],
                    "ymin": line["ymin"],
                    "ymax": line["ymax"],
                    "avg_height": line_height,
                    "avg_width": line_width,
                }
                continue

            vertical_gap = line["ymin"] - current["ymax"]
            left_align_diff = abs(line["xmin"] - current["xmin"])

            vertical_ok = vertical_gap <= current["avg_height"] * 1.8

            align_tolerance = max(
                current["avg_width"] * 0.12,
                current["avg_height"] * 0.8
            )
            align_ok = left_align_diff <= align_tolerance

            if vertical_ok and align_ok:
                current["lines"].append(line)
                current["xmin"] = min(current["xmin"], line["xmin"])
                current["xmax"] = max(current["xmax"], line["xmax"])
                current["ymax"] = max(current["ymax"], line["ymax"])

                n = len(current["lines"])
                current["avg_height"] = (
                    current["avg_height"] * (n - 1) + line_height
                ) / n
                current["avg_width"] = (
                    current["avg_width"] * (n - 1) + line_width
                ) / n
            else:
                bubbles.append(current)
                current = {
                    "lines": [line],
                    "xmin": line["xmin"],
                    "xmax": line["xmax"],
                    "ymin": line["ymin"],
                    "ymax": line["ymax"],
                    "avg_height": line_height,
                    "avg_width": line_width,
                }

        if current:
            bubbles.append(current)

        return bubbles

    # ---------------------------
    # Validate raw structure
    # ---------------------------
    if not isinstance(raw, list) or not raw:
        print("parse_paddle_output: invalid raw")
        return regions

    item = raw[0]
    if not isinstance(item, dict):
        print("parse_paddle_output: invalid item")
        return regions

    texts = item.get("rec_texts", [])
    polys = item.get("rec_polys", [])
    scores = item.get("rec_scores", [])

    # ---------------------------
    # Build OCR lines
    # ---------------------------
    lines = []

    L = min(len(texts), len(polys))
    for i in range(L):
        bbox = quad_to_bbox(polys[i])
        if not bbox:
            continue

        lines.append({
            "xmin": bbox["xmin"],
            "ymin": bbox["ymin"],
            "xmax": bbox["xmax"],
            "ymax": bbox["ymax"],
            "text": str(texts[i]).strip(),
            "confidence": float(scores[i]) if i < len(scores) else None
        })

    # ---------------------------
    # Group lines into bubbles
    # ---------------------------
    bubbles = group_lines_into_bubbles(lines)

    # ---------------------------
    # Build final regions
    # ---------------------------
    for bubble in bubbles:
        bubble_text = "\n".join(
            l["text"] for l in sorted(bubble["lines"], key=lambda l: l["ymin"])
            if l["text"]
        )

        confidences = [
            l["confidence"] for l in bubble["lines"]
            if l.get("confidence") is not None
        ]

        regions.append({
            "box_2d": [
                bubble["ymin"],
                bubble["xmin"],
                bubble["ymax"],
                bubble["xmax"],
            ],
            "original": bubble_text,
            "confidence": (
                sum(confidences) / len(confidences)
                if confidences else None
            )
        })

    return regions


# -----------------------------------------------------
# API
# -----------------------------------------------------
@app.route("/ocr", methods=["POST"])
def ocr_endpoint():
    try:
        data = request.get_json(force=True)
        image_b64 = data.get("image")
        lang = data.get("lang", DEFAULT_LANG)

        if not image_b64:
            return jsonify({"ok": False, "error": "Missing image"}), 400

        if lang not in OCR_ENGINES:
            lang = DEFAULT_LANG

        image_b64 = image_b64.replace("data:image/png;base64,", "").replace("data:image/jpeg;base64,", "")
        img = decode_base64_to_image(image_b64)

        if img is None:
            return jsonify({"ok": False, "error": "Invalid image"}), 400

        ocr = OCR_ENGINES[lang]
        raw = ocr.ocr(img)
        regions = parse_paddle_output(raw)

        return jsonify({
            "ok": True,
            "lang_used": lang,
            "regions": regions
        })

    except Exception as e:
        print("OCR Error:", e)
        return jsonify({"ok": False, "error": str(e)}), 500


if __name__ == "__main__":
    print("Multi-language PaddleOCR service running on http://0.0.0.0:5005/ocr")
    app.run(host="0.0.0.0", port=5005, debug=False)
