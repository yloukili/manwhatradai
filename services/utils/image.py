import base64
import io
import numpy as np
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
        ocr_list (list of dict): [{'box_2d':[x1,y1,x2,y2], 'original':..., ...}, ...]
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