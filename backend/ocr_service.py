import io
import logging
import os
import re
from typing import Optional, Tuple

import easyocr
import numpy as np
from PIL import Image

MRZ_ALLOWLIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"
_reader: Optional[easyocr.Reader] = None


def _use_gpu() -> bool:
    return os.environ.get("OCR_GPU", "false").lower() in ("1", "true", "yes")


def get_reader() -> easyocr.Reader:
    global _reader
    if _reader is None:
        logging.info("Initializing EasyOCR reader (gpu=%s)", _use_gpu())
        _reader = easyocr.Reader(["en"], gpu=_use_gpu())
    return _reader


def warmup_reader() -> None:
    get_reader()


def _bytes_to_array(image_bytes: bytes) -> np.ndarray:
    image = Image.open(io.BytesIO(image_bytes))
    if image.mode != "RGB":
        image = image.convert("RGB")
    return np.array(image)


def _crop_region(image_array: np.ndarray, start_ratio: float, end_ratio: float) -> np.ndarray:
    height = image_array.shape[0]
    start_row = int(height * start_ratio)
    end_row = int(height * end_ratio)
    return image_array[start_row:end_row, :]


def _read_mrz_text_from_array(image_array: np.ndarray) -> str:
    reader = get_reader()
    results = reader.readtext(
        image_array,
        allowlist=MRZ_ALLOWLIST,
        detail=1,
        paragraph=False,
    )
    if not results:
        return ""

    results.sort(key=lambda item: item[0][0][1])
    lines = [text.strip() for _, text, _ in results if text and text.strip()]
    return "\n".join(lines)


def _read_visual_text_from_array(image_array: np.ndarray) -> str:
    reader = get_reader()
    results = reader.readtext(
        image_array,
        detail=1,
        paragraph=False,
    )
    if not results:
        return ""

    results.sort(key=lambda item: item[0][0][1])
    lines = [text.strip() for _, text, _ in results if text and text.strip()]
    return "\n".join(lines)


def _score_mrz_text(text: str) -> int:
    if not text:
        return 0

    score = 0
    lines = [line.replace(" ", "") for line in text.split("\n") if line.strip()]
    for line in lines:
        if "<<" in line:
            score += 10
        if line.startswith("P<") or line.startswith("PIND") or line.startswith("P"):
            score += 8
        if len(line) >= 40:
            score += 5
        if re.search(r"\d{6}[MF]\d{6}", line):
            score += 12
        if "<" in line:
            score += 3

    return score


def _extract_mrz_text(image_array: np.ndarray) -> str:
    height = image_array.shape[0]
    regions = [
        (0.30, 0.52),  # front+back: MRZ at bottom of top half
        (0.65, 1.0),   # single-page: MRZ at bottom
        (0.0, 1.0),    # full image fallback
    ]

    best_text = ""
    best_score = 0
    for start, end in regions:
        if int(height * end) <= int(height * start):
            continue
        region = _crop_region(image_array, start, end)
        text = _read_mrz_text_from_array(region)
        score = _score_mrz_text(text)
        if score > best_score:
            best_score = score
            best_text = text

    return best_text


def _extract_visual_text(image_array: np.ndarray) -> str:
    front_region = _crop_region(image_array, 0.0, 0.55)
    back_region = _crop_region(image_array, 0.45, 1.0)
    front_text = _read_visual_text_from_array(front_region)
    back_text = _read_visual_text_from_array(back_region)
    parts = [part for part in (front_text, back_text) if part]
    return "\n".join(parts)


def extract_all_text_from_image(image_bytes: bytes) -> Tuple[str, str]:
    """Return (mrz_text, visual_text) from passport image."""
    image_array = _bytes_to_array(image_bytes)
    mrz_text = _extract_mrz_text(image_array)
    visual_text = _extract_visual_text(image_array)
    return mrz_text, visual_text


def extract_text_from_image(image_bytes: bytes) -> str:
    """Backward-compatible: combined MRZ + visual text."""
    mrz_text, visual_text = extract_all_text_from_image(image_bytes)
    parts = [part for part in (mrz_text, visual_text) if part]
    return "\n".join(parts)
