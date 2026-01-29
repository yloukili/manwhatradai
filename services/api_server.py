#!/usr/bin/env python3
from flask import Flask, request, jsonify
import copy

from ocr_service import run_ocr_pipeline
from translation_service import translate_text
from utils.translation import parse_source_language

app = Flask(__name__)

VARIANTS = 3
ENG_VALUE = "eng_Latn"
# -------------------
# OCR endpoint
# -------------------
@app.route("/ocr", methods=["POST"])
def ocr_endpoint():
    try:
        data = request.get_json(force=True)
        image_b64 = data.get("image")
        lang = data.get("lang")

        if not image_b64:
            return jsonify({"ok": False, "error": "Missing image"}), 400

        regions, lang_used = run_ocr_pipeline(image_b64, lang)

        return jsonify({
            "ok": True,
            "lang_used": lang_used,
            "regions": regions
        })

    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


# -------------------
# Translation endpoint
# -------------------
@app.route("/translate", methods=["POST"])
def translate_endpoint():
    try:
        data = request.get_json(force=True)
        text = data.get("text")
        src = parse_source_language(data.get("lang"))
        print(text, src)
        tgt = ENG_VALUE
        variants = int(data.get("variants", VARIANTS))

        if not text or not src or not tgt:
            return jsonify({"ok": False, "error": "Missing parameters"}), 400

        translations = translate_text(text, src, tgt, variants)
        print(translations)
        return jsonify({
            "ok": True,
            "translations": translations
        })

    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


# -------------------
# Full OCR + Translation
# -------------------
@app.route("/process", methods=["POST"])
def full_pipeline():
    # try:
        data = request.get_json(force=True)

        image_b64 = data.get("image")
        lang = data.get("lang")
        src_lang = parse_source_language(data.get("lang"))
        tgt_lang = ENG_VALUE
        variants = int(data.get("variants", VARIANTS))

        if not image_b64:
            return jsonify({"ok": False, "error": "Missing image"}), 400

        # OCR
        regions, lang_used = run_ocr_pipeline(image_b64, lang)
        translated_regions = copy.deepcopy(regions)
        # TRANSLATIONS
        for idx, r in enumerate(regions): 
            translations = translate_text(r["original"], src_lang, tgt_lang, variants)
            translated_regions[idx]["translations"] = translations

        return jsonify({
            "ok": True,
            "regions": translated_regions
        })

    # except Exception as e:
    #     return jsonify({"ok": False, "error": str(e)}), 500


if __name__ == "__main__":
    print("Unified API server running on http://0.0.0.0:5005/")
    app.run(host="0.0.0.0", port=5005, debug=True)
