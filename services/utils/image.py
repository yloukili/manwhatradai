import base64
import io
import numpy as np
import os
from PIL import Image
import cv2

def add_padding(image, top_ratio=0.1, bottom_ratio=0.1, color=(0, 0, 0)):
    """
    Ajoute un padding noir (ou autre couleur) en haut et en bas de l'image.

    Args:
        image (np.ndarray): image d'entrée (H x W x C ou H x W)
        top_ratio (float): proportion de padding en haut (0-1)
        bottom_ratio (float): proportion de padding en bas (0-1)
        color (tuple): couleur du padding, ex: (0,0,0) pour noir

    Returns:
        padded_image (np.ndarray): image paddée
        pad_top (int): hauteur du padding supérieur
        pad_bottom (int): hauteur du padding inférieur
    """
    h, w = image.shape[:2]
    pad_top = int(h * top_ratio)
    pad_bottom = int(h * bottom_ratio)

    # Si image en niveaux de gris, adapter la couleur
    if len(image.shape) == 2:
        color = color[0]

    padded_image = cv2.copyMakeBorder(
        image,
        pad_top,
        pad_bottom,
        0,
        0,
        borderType=cv2.BORDER_CONSTANT,
        value=color
    )
    return padded_image, pad_top, pad_bottom


def resize_bounding(ocr_list, pad_top=0, pad_bottom=0):
    """
    Corrige les coordonnées des bounding boxes après padding vertical.

    Args:
        ocr_list (list of dict): [{'box_2d':[y1,x1,y2,x2], 'original':..., ...}, ...]
        pad_top (int): hauteur du padding ajouté en haut
        pad_bottom (int): hauteur du padding ajouté en bas (inutile ici, pour info)
    
    Returns:
        new_list (list of dict): liste avec box_2d corrigées
    """
    
    new_list = []
    for item in ocr_list:
        box = item.get("box_2d", [0, 0, 0, 0])
        if len(box) == 4:
            y1, x1, y2, x2 = box
            height = y2 - y1
            y1 -= pad_top
            # éviter les coordonnées négatives
            y1 = max(y1, 0)
            y2 = y1 + height
            new_box = [y1, x1, y2, x2]
        else:
            new_box = box
        new_item = item.copy()
        new_item["box_2d"] = new_box
        new_list.append(new_item)
    return new_list


def decode_base64_to_image(base64_str):
    img_bytes = base64.b64decode(base64_str)
    pil_img = Image.open(io.BytesIO(img_bytes))

    if pil_img.mode not in ("RGB", "L"):
        pil_img = pil_img.convert("RGB")

    return np.array(pil_img)


def debug_dump_ocr_image(
    image_np,
    ocr_lines,
    output_path,
    color_boxes=(0, 255, 0),
    thickness=2,
    draw_text=True,
    grid_step=250,
):
    """
    Debug OCR avancé :
    - étend le canvas si des boxes sortent du cadre
    - dessine les bounding boxes
    - ajoute des règles graduées (gauche + bas)
    """

    if image_np is None or not isinstance(image_np, np.ndarray):
        raise ValueError("image_np doit être un numpy array")

    # --- image source ---
    img = image_np.copy()
    if len(img.shape) == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

    H, W = img.shape[:2]

    # --- calcul bornes nécessaires ---
    min_x = 0
    min_y = 0
    max_x = W
    max_y = H

    for l in ocr_lines:
        if "xmin" in l:
            min_y = min(min_y, int(l["ymin"]))
            min_x = min(min_x, int(l["xmin"]))
            max_y = max(max_y, int(l["ymax"]))
            max_x = max(max_x, int(l["xmax"]))
        else:
            min_y = min(min_y, int(l['box_2d'][0]))
            min_x = min(min_x, int(l['box_2d'][1]))
            max_y = max(max_y, int(l['box_2d'][2]))
            max_x = max(max_x, int(l['box_2d'][3]))

    # marges négatives → décalage
    pad_left = -min_x if min_x < 0 else 0
    pad_top = -min_y if min_y < 0 else 0

    new_w = max_x + pad_left
    new_h = max_y + pad_top

    # --- création canvas étendu ---
    canvas = np.zeros((new_h, new_w, 3), dtype=np.uint8)
    canvas[pad_top:pad_top + H, pad_left:pad_left + W] = img

    # --- dessiner les bounding boxes ---
    for line in ocr_lines:
        if "xmin" in line:
            y1 = int(line["ymin"]) + pad_top
            x1 = int(line["xmin"]) + pad_left
            y2 = int(line["ymax"]) + pad_top
            x2 = int(line["xmax"]) + pad_left
        else:
            y1 = int(line['box_2d'][0]) + pad_top
            x1 = int(line['box_2d'][1]) + pad_left
            y2 = int(line['box_2d'][2]) + pad_top
            x2 = int(line['box_2d'][3]) + pad_left
        cv2.rectangle(canvas, (x1, y1), (x2, y2), color_boxes, thickness)

        if draw_text:
            text = line.get("text", "")
            score = line.get("score")
            label = text
            if score is not None:
                label += f" ({score:.2f})"

            ty = y1 - 6 if y1 > 20 else y1 + 20
            cv2.putText(
                canvas,
                label,
                (x1, ty),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (255, 0, 0),
                1,
                cv2.LINE_AA,
            )

    # -------------------------------------------------
    # RÈGLES GRADUÉES
    # -------------------------------------------------

    # règle gauche (Y)
    for y in range(0, new_h, grid_step):
        cv2.line(canvas, (0, y), (15, y), (200, 200, 200), 1)
        cv2.putText(
            canvas,
            str(y - pad_top),
            (20, y + 5),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.4,
            (200, 200, 200),
            1,
        )

    # règle bas (X)
    base_y = new_h - 1
    for x in range(0, new_w, grid_step):
        cv2.line(canvas, (x, base_y), (x, base_y - 15), (200, 200, 200), 1)
        cv2.putText(
            canvas,
            str(x - pad_left),
            (x + 2, base_y - 20),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.4,
            (200, 200, 200),
            1,
        )

    # --- sauvegarde ---
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    cv2.imwrite(output_path, canvas)

    return output_path