import numpy as np

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
# BUBBLE GROUPING
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
def parse_paddle_output(raw, conf_threshold=0.5, lang=None):
    """
    Parse PaddleOCR / PaddleX output for single pass mode.
    Works with items containing 'rec_texts', 'rec_scores', 'rec_polys'.
    """
    lines = []

    if isinstance(raw, list):
        for item in raw:
            rec_texts = item.get("rec_texts", [])
            rec_scores = item.get("rec_scores", [])
            rec_polys = item.get("rec_polys", item.get("dt_polys", []))

            if not rec_texts or not rec_scores or not rec_polys:
                continue

            for text, score, poly in zip(rec_texts, rec_scores, rec_polys):
                if score < conf_threshold:
                    continue

                # convert np.array to list if needed
                if isinstance(poly, np.ndarray):
                    poly = poly.tolist()

                bbox = quad_to_bbox(poly)
                lines.append({
                    "xmin": bbox["xmin"],
                    "ymin": bbox["ymin"],
                    "xmax": bbox["xmax"],
                    "ymax": bbox["ymax"],
                    "text": text,
                    "score": score,
                })

    # GROUP INTO BUBBLES
    bubbles = group_lines_into_bubbles(lines)

    regions = []
    for bubble in bubbles:
        text = " ".join(l["text"] for l in bubble["lines"])
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
