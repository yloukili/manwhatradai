#!/usr/bin/env python3
from flask import Flask, request, jsonify

import ocr.paddle_runner as paddle_runner
from ocr.preprocess import preprocess_image
from ocr.postprocess_generic import parse_paddle_output
from ocr.postprocess_vi import postprocess_ocr_results
import utils.image as image

app = Flask(__name__)


@app.route("/ocr", methods=["POST"])
def ocr_endpoint():
    try:
        data = request.get_json(force=True)
        image_b64 = data.get("image")
        lang = data.get("lang", paddle_runner.DEFAULT_LANG)

        if not image_b64:
            return jsonify({"ok": False, "error": "Missing image"}), 400

        # decode
        img = image.decode_base64_to_image(image_b64)
        if img is None:
            return jsonify({"ok": False, "error": "Invalid image"}), 400

        # preprocess (resize / gray / etc.)
        img = preprocess_image(img, lang)
        padded_img, pad_top, pad_bottom = image.add_padding(img)

        # OCR (FULL PIPELINE INSIDE PaddleOCR)
        raw_list, conf_threshold = paddle_runner.run_paddle_ocr(padded_img, lang)
        # -------------------------------------------------
        # PARSE + ALIGN + FUSION + KENLM (INSIDE)
        # -------------------------------------------------
        regions = parse_paddle_output(
            raw_list,
            conf_threshold,
            lang=lang
        )      
        results = postprocess_ocr_results(regions)
        print(results)
        adjusted_results = image.resize_bounding(results, pad_top)
        print(adjusted_results)
        return jsonify({
            "ok": True,
            "lang_used": lang,
            "regions": adjusted_results
        })

    except Exception as e:
        return jsonify({
            "ok": False,
            "error": str(e)
        }), 500


if __name__ == "__main__":
    print("Multi-language PaddleOCR  service running on http://0.0.0.0:5005/ocr")
    app.run(host="0.0.0.0", port=5005, debug=True)
