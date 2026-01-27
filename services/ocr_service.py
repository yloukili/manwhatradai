#!/usr/bin/env python3
from flask import Flask, request, jsonify

from datetime import datetime
import ocr.paddle_runner as paddle_runner
from ocr.preprocess import preprocess_image
from ocr.postprocess_generic import parse_paddle_output
from ocr.postprocess_vi import postprocess_ocr_results
import utils.image as image

app = Flask(__name__)

is_debug = True

@app.route("/ocr", methods=["POST"])
def ocr_endpoint():
    # try:
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

        # # OCR (FULL PIPELINE INSIDE PaddleOCR)
        raw_list, conf_threshold = paddle_runner.run_paddle_ocr(padded_img, lang)
        # raw_list, conf_threshold = paddle_runner.run_paddle_ocr(img, lang)

        # -------------------------------------------------
        # PARSE + ALIGN + FUSION + KENLM (INSIDE)
        # -------------------------------------------------
        
        regions = parse_paddle_output(
            raw_list,
            conf_threshold,
            lang=lang, 
        )    
        if (is_debug):
            image.debug_dump_ocr_image(
                image_np=padded_img,
                ocr_lines=regions,
                output_path=f"debug/ocr_boxes_debug_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.png"  
            )
        
        results = postprocess_ocr_results(regions)
        adjusted_results = image.resize_bounding(results, pad_top)
        print(adjusted_results)
        return jsonify({
            "ok": True,
            "lang_used": lang,
            "regions": adjusted_results
        })
        # return jsonify({
        #     "ok": True,
        #     "lang_used": lang,
        #     "regions": results
        # })

    # except Exception as e:
    #     return jsonify({
    #         "ok": False,
    #         "error": str(e)
    #     }), 500


if __name__ == "__main__":
    print("Multi-language PaddleOCR  service running on http://0.0.0.0:5005/ocr")
    app.run(host="0.0.0.0", port=5005, debug=is_debug)
