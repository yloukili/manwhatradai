# services/ocr/postprocess_vi.py

import re
from functools import lru_cache
from ocr.lm_vi_ngram import score_sentence

# -----------------------------------------------------
# TOKENIZATION
# -----------------------------------------------------
TOKEN_RE = re.compile(r"\s+")

def tokenize(text: str):
    return TOKEN_RE.split(text.strip())

def detokenize(tokens):
    return " ".join(tokens)

# -----------------------------------------------------
# DIACRITIC VARIANTS (SAFE)
# -----------------------------------------------------
DIACRITIC_MAP = {
    "a": ["a", "á", "à", "ả", "ã", "ạ", "â", "ấ", "ầ", "ẩ", "ẫ", "ậ", "ă", "ắ", "ằ", "ẳ", "ẵ", "ặ"],
    "e": ["e", "é", "è", "ẻ", "ẽ", "ẹ", "ê", "ế", "ề", "ể", "ễ", "ệ"],
    "i": ["i", "í", "ì", "ỉ", "ĩ", "ị"],
    "o": ["o", "ó", "ò", "ỏ", "õ", "ọ", "ô", "ố", "ồ", "ổ", "ỗ", "ộ", "ơ", "ớ", "ờ", "ở", "ỡ", "ợ"],
    "u": ["u", "ú", "ù", "ủ", "ũ", "ụ", "ư", "ứ", "ừ", "ử", "ữ", "ự"],
    "y": ["y", "ý", "ỳ", "ỷ", "ỹ", "ỵ"],
    "d": ["d", "đ"],
}

def generate_variants(word: str):
    """
    Generate diacritic-only variants for a word.
    Conservative: 1-char replacement only.
    """
    variants = {word}
    lw = word.lower()

    for i, ch in enumerate(lw):
        if ch in DIACRITIC_MAP:
            for rep in DIACRITIC_MAP[ch]:
                candidate = word[:i] + rep + word[i + 1:]
                variants.add(candidate)

    return list(variants)

# -----------------------------------------------------
# CORE CORRECTION
# -----------------------------------------------------
@lru_cache(maxsize=2048)
def _score(text: str) -> float:
    return score_sentence(text)

def correct_vietnamese(text: str) -> str:
    """
    Vietnamese post-OCR correction using KenLM.

    - No dictionary
    - No forced replacements
    - Only diacritic variants
    - Apply change ONLY if LM score improves clearly
    """

    tokens = tokenize(text)

    # Too short → unstable LM signal
    if len(tokens) < 3:
        return text

    base_sentence = detokenize(tokens)
    base_score = _score(base_sentence)

    corrected = tokens[:]

    for i, tok in enumerate(tokens):
        # Skip non-words
        if not tok.isalpha():
            continue

        variants = generate_variants(tok)
        if len(variants) <= 1:
            continue

        best_token = tok
        best_score = base_score

        for cand in variants:
            if cand == tok:
                continue

            trial = corrected[:]
            trial[i] = cand
            trial_sentence = detokenize(trial)

            s = _score(trial_sentence)

            # Strong margin → avoid overcorrection
            if s > best_score + 0.25:
                best_score = s
                best_token = cand

        corrected[i] = best_token

    return detokenize(corrected)
