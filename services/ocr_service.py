from datetime import datetime

import ocr.paddle_runner as paddle_runner
from ocr.preprocess import preprocess_image
from ocr.postprocess_generic import parse_paddle_output
from ocr.postprocess_vi import postprocess_ocr_results
import utils.image as image

is_debug = True

def run_ocr_pipeline(image_b64, lang=None):
    try:
        if lang is None:
            lang = paddle_runner.DEFAULT_LANG

        img = image.decode_base64_to_image(image_b64)
        if img is None:
            raise ValueError("Invalid image")

        img = preprocess_image(img, lang)
        padded_img, pad_top, pad_bottom = image.add_padding(img)

        raw_list, conf_threshold = paddle_runner.run_paddle_ocr(padded_img, lang)

        regions = parse_paddle_output(
            raw_list,
            conf_threshold,
            lang=lang
        )

        if is_debug:
            image.debug_dump_ocr_image(
                image_np=padded_img,
                ocr_lines=regions,
                output_path=f"debug/ocr_boxes_debug_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.png"  
            )

        if lang == "vietnamese":
            results = postprocess_ocr_results(regions)
        else:
            results = regions
        adjusted_results = image.resize_bounding(results, pad_top)
        print(adjusted_results)
        return adjusted_results, lang
    except Exception as e:
        return e
