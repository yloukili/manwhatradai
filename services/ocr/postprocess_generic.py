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

    # tri TOP → BOTTOM, puis LEFT → RIGHT
    lines = sorted(lines, key=lambda l: (l["ymin"], l["xmin"]))

    bubbles = []

    for line in lines:
        lh = line["ymax"] - line["ymin"]
        lw = line["xmax"] - line["xmin"]
        line_cx = (line["xmin"] + line["xmax"]) / 2

        best_bubble = None
        best_score = float("inf")

        for b in bubbles:
            vgap = line["ymin"] - b["ymax"]
         
            bubble_cx = (b["xmin"] + b["xmax"]) / 2
            center_diff = abs(line_cx - bubble_cx)

            # tolérance verticale adaptative
            vertical_tol = b["avg_h"] * (1.2 + 0.8 * b["n_lines"])
            vertical_ok = vgap <= vertical_tol

            # tolérance d’alignement par CENTRE
            center_tol = max(b["avg_w"] * 0.25, b["avg_h"] * 1.0)
            align_ok = center_diff <= center_tol

            if vertical_ok and align_ok:
                score = vgap + center_diff
                if score < best_score:
                    best_score = score
                    best_bubble = b

        if best_bubble:
            b = best_bubble
            b["lines"].append(line)
            b["n_lines"] += 1

            b["xmin"] = min(b["xmin"], line["xmin"])
            b["xmax"] = max(b["xmax"], line["xmax"])
            b["ymax"] = max(b["ymax"], line["ymax"])

            n = b["n_lines"]
            b["avg_h"] = (b["avg_h"] * (n - 1) + lh) / n
            b["avg_w"] = (b["avg_w"] * (n - 1) + lw) / n
        else:
            bubbles.append({
                "lines": [line],
                "n_lines": 1,
                "xmin": line["xmin"],
                "xmax": line["xmax"],
                "ymin": line["ymin"],
                "ymax": line["ymax"],
                "avg_h": lh,
                "avg_w": lw,
            })

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
