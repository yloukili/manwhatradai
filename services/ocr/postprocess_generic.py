def quad_to_bbox(poly):
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    return {
        "xmin": int(min(xs)),
        "ymin": int(min(ys)),
        "xmax": int(max(xs)),
        "ymax": int(max(ys)),
    }


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


def parse_paddle_output(raw, conf_threshold):
    item = raw[0]

    texts = item.get("rec_texts", [])
    polys = item.get("rec_polys", [])
    scores = item.get("rec_scores", [])

    lines = []

    for i in range(min(len(texts), len(polys))):
        score = scores[i] if i < len(scores) else None
        if score is not None and score < conf_threshold:
            continue

        bbox = quad_to_bbox(polys[i])
        lines.append({
            **bbox,
            "text": texts[i].strip(),
            "confidence": score
        })

    bubbles = group_lines_into_bubbles(lines)

    regions = []
    for b in bubbles:
        regions.append({
            "box_2d": [b["ymin"], b["xmin"], b["ymax"], b["xmax"]],
            "original": "\n".join(l["text"] for l in b["lines"]),
            "confidence": (
                sum(l["confidence"] for l in b["lines"] if l["confidence"])
                / max(1, len(b["lines"]))
            )
        })

    return regions
