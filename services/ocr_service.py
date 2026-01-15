#!/usr/bin/env python3
import base64
import io
from flask import Flask, request, jsonify
from PIL import Image
import numpy as np

import ocr.paddle_runner as paddle_runner
from ocr.preprocess import preprocess_image
from ocr.postprocess_generic import parse_paddle_output
from ocr.postprocess_vi import correct_vietnamese

app = Flask(__name__)

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


# -----------------------------------------------------
# OCR ENDPOINT
# -----------------------------------------------------
@app.route("/ocr", methods=["POST"])
def ocr_endpoint():
    try:
        data = request.get_json(force=True)
        image_b64 = data.get("image")
        lang = data.get("lang", paddle_runner.DEFAULT_LANG)

        if not image_b64:
            return jsonify({"ok": False, "error": "Missing image"}), 400

        if lang not in paddle_runner.OCR_ENGINES:
            lang = paddle_runner.DEFAULT_LANG

        image_b64 = (
            image_b64
            .replace("data:image/png;base64,", "")
            .replace("data:image/jpeg;base64,", "")
        )

        img = decode_base64_to_image(image_b64)
        if img is None:
            return jsonify({"ok": False, "error": "Invalid image"}), 400

    except Exception as e:
        print("OCR input error:", e)
        return jsonify({"ok": False, "error": str(e)}), 500

    # -------------------------------------------------
    # PREPROCESS (ONCE)
    # -------------------------------------------------
    img = preprocess_image(img, lang)

    # -------------------------------------------------
    # MULTI-PASS OCR
    # -------------------------------------------------
    raw_list, conf_threshold = paddle_runner.run_multi_paddle_ocr(img, lang)

    # -------------------------------------------------
    # PARSE + ALIGN + FUSION + KENLM (INSIDE)
    # -------------------------------------------------
    regions = parse_paddle_output(
        raw_list,
        conf_threshold,
        lang=lang
    )  
    # -------------------------------------------------
    # LANGUAGE-SPECIFIC POST OCR
    # -------------------------------------------------
    if lang == "vietnamese":
        for r in regions:
            r["original"] = correct_vietnamese(r["original"])

    return jsonify({
        "ok": True,
        "lang_used": lang,
        "regions": regions
    })


# -----------------------------------------------------
# BOOTSTRAP
# -----------------------------------------------------
if __name__ == "__main__":
    print("Multi-language PaddleOCR service running on http://0.0.0.0:5005/ocr")
    app.run(host="0.0.0.0", port=5005, debug=False)
