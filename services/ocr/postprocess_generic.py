from ocr.lattice_vi import choose_best_sentence


# -----------------------------------------------------
# GEOMETRY
# -----------------------------------------------------
def quad_to_bbox(poly):
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    return {
        "xmin": int(min(xs)),
        "ymin": int(min(ys)),
        "xmax": int(max(xs)),
        "ymax": int(max(ys)),
    }


# -----------------------------------------------------
# BUBBLE GROUPING (UNCHANGED, WORKING)
# -----------------------------------------------------
def group_lines_into_bubbles(lines):
    if not lines:
        return []

    lines = sorted(lines, key=lambda l: (l["ymin"], l["xmin"]))
    bubbles = []
    current = None

    for line in lines:
        lh = line["ymax"] - line["ymin"]
        lw = line["xmax"] - line["xmin"]

        if current is None:
            current = {
                "lines": [line],
                "xmin": line["xmin"],
                "xmax": line["xmax"],
                "ymin": line["ymin"],
                "ymax": line["ymax"],
                "avg_h": lh,
                "avg_w": lw,
            }
            continue

        vgap = line["ymin"] - current["ymax"]
        left_diff = abs(line["xmin"] - current["xmin"])

        vertical_ok = vgap <= current["avg_h"] * 1.8
        align_tol = max(current["avg_w"] * 0.12, current["avg_h"] * 0.8)
        align_ok = left_diff <= align_tol

        if vertical_ok and align_ok:
            current["lines"].append(line)
            current["xmin"] = min(current["xmin"], line["xmin"])
            current["xmax"] = max(current["xmax"], line["xmax"])
            current["ymax"] = max(current["ymax"], line["ymax"])

            n = len(current["lines"])
            current["avg_h"] = (current["avg_h"] * (n - 1) + lh) / n
            current["avg_w"] = (current["avg_w"] * (n - 1) + lw) / n
        else:
            bubbles.append(current)
            current = {
                "lines": [line],
                "xmin": line["xmin"],
                "xmax": line["xmax"],
                "ymin": line["ymin"],
                "ymax": line["ymax"],
                "avg_h": lh,
                "avg_w": lw,
            }

    bubbles.append(current)
    return bubbles


# -----------------------------------------------------
# MAIN PARSER
# -----------------------------------------------------
def parse_paddle_output(raw, conf_threshold, lang=None):
    lines = []

    # -------------------------------------------------
    # MULTI-PASS MODE (ALREADY ALIGNED)
    # -------------------------------------------------
    if isinstance(raw, dict) and raw.get("mode") == "multi_pass":
        for line_group in raw["aligned"]:
            texts = []
            scores = []
            ref = None

            for item in line_group:
                if not item:
                    continue

                text = item.get("text", "")
                score = item.get("score", 1.0)

                if score >= conf_threshold:
                    texts.append(text)
                    scores.append(score)

                if ref is None:
                    ref = item

            if not texts or not ref:
                continue

            final_text = texts[0]
            if lang == "vietnamese" and len(texts) > 1:
                final_text = choose_best_sentence(texts)
            bbox = quad_to_bbox(ref["box"])

            lines.append({
                "xmin": bbox["xmin"],
                "ymin": bbox["ymin"],
                "xmax": bbox["xmax"],
                "ymax": bbox["ymax"],
                "text": final_text,
                "score": max(scores),
            })

    # -------------------------------------------------
    # SINGLE PASS MODE
    # -------------------------------------------------
    elif isinstance(raw, list):
        for item in raw:
            if item.get("score", 0.0) < conf_threshold:
                continue

            bbox = quad_to_bbox(item["poly"])
            lines.append({
                "xmin": bbox["xmin"],
                "ymin": bbox["ymin"],
                "xmax": bbox["xmax"],
                "ymax": bbox["ymax"],
                "text": item["text"],
                "score": item["score"],
            })

    # -------------------------------------------------
    # GROUP INTO BUBBLES
    # -------------------------------------------------
    bubbles = group_lines_into_bubbles(lines)

    regions = []
    for bubble in bubbles:
        text = "\n".join(l["text"] for l in bubble["lines"])

        regions.append({
            "box_2d": [
                bubble["ymin"],
                bubble["xmin"],
                bubble["ymax"],
                bubble["xmax"],
            ],
            "original": text,
            "confidence": max(l["score"] for l in bubble["lines"]),
        })

    return regions