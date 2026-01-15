import os
import re
import kenlm
from functools import lru_cache

# -----------------------------------------------------
# PATHS
# -----------------------------------------------------
BASE_DIR = os.path.dirname(__file__)
LM_PATH = os.path.join(BASE_DIR, "lm", "vi.klm")

_model = None

def get_vi_lm():
    global _model
    if _model is None:
        if not os.path.exists(LM_PATH):
            raise RuntimeError(f"KenLM model not found: {LM_PATH}")
        _model = kenlm.Model(LM_PATH)
    return _model

# -----------------------------------------------------
# TOKENIZATION
# -----------------------------------------------------
TOKEN_RE = re.compile(r"\s+")

def tokenize(text: str):
    return TOKEN_RE.split(text.strip())

def detokenize(tokens):
    return " ".join(tokens)

# -----------------------------------------------------
# SCORING
# -----------------------------------------------------
@lru_cache(maxsize=4096)
def score_sentence(sentence: str) -> float:
    lm = get_vi_lm()
    return lm.score(sentence, bos=True, eos=True)

# -----------------------------------------------------
# CANDIDATE GENERATION (SAFE)
# -----------------------------------------------------
DIACRITIC_MAP = {
    "a": ["a", "á", "à", "ả", "ã", "ạ", "â", "ấ", "ầ", "ẩ", "ẫ", "ậ", "ă", "ắ", "ằ", "ẳ", "ẵ", "ặ"],
    "e": ["e", "é", "è", "ẻ", "ẽ", "ẹ", "ê", "ế", "ề", "ể", "ễ", "ệ"],
    "i": ["i", "í", "ì", "ỉ", "ĩ", "ị"],
    "o": ["o", "ó", "ò", "ỏ", "õ", "ọ", "ô", "ố", "ồ", "ổ", "ỗ", "ộ", "ơ", "ớ", "ờ", "ở", "ỡ", "ợ"],
    "u": ["u", "ú", "ù", "ủ", "ũ", "ụ", "ư", "ứ", "ừ", "ử", "ữ", "ự"],
    "y": ["y", "ý", "ỳ", "ỷ", "ỹ", "ỵ"],
    "d": ["d", "đ"]
}

def generate_candidates(word: str):
    variants = {word}
    lw = word.lower()

    for i, ch in enumerate(lw):
        if ch in DIACRITIC_MAP:
            for rep in DIACRITIC_MAP[ch]:
                variants.add(word[:i] + rep + word[i + 1:])

    return list(variants)

# -----------------------------------------------------
# CHAR-LEVEL CANDIDATES (FOR [X])
# -----------------------------------------------------
VIET_CHAR_SET = sorted({
    c for variants in DIACRITIC_MAP.values() for c in variants
})

UNCERTAIN_TOKEN = "[X]"

# -----------------------------------------------------
# TARGETED [X] CORRECTION
# -----------------------------------------------------
def correct_uncertain_chars_with_lm(text: str) -> str:
    """
    Replace [X] tokens using LM scoring.
    Only touches uncertain characters.
    """

    if UNCERTAIN_TOKEN not in text:
        return text

    lm = get_vi_lm()
    base_text = text.replace(UNCERTAIN_TOKEN, "")
    base_score = score_sentence(base_text)

    chars = list(text)

    for i, ch in enumerate(chars):
        if ch != UNCERTAIN_TOKEN:
            continue

        best_char = ch
        best_score = base_score

        for cand in VIET_CHAR_SET:
            trial = chars[:]
            trial[i] = cand
            trial_sentence = "".join(trial)

            s = score_sentence(trial_sentence)

            if s > best_score + 0.3:
                best_score = s
                best_char = cand

        chars[i] = best_char

    return "".join(chars)

# -----------------------------------------------------
# WORD-LEVEL CORRECTION (LEGACY)
# -----------------------------------------------------
def correct_vietnamese_with_lm(text: str) -> str:
    """
    Entry point:
    - If [X] present → character-level targeted correction
    - Else → conservative word-level correction (legacy behavior)
    """

    if UNCERTAIN_TOKEN in text:
        return correct_uncertain_chars_with_lm(text)

    tokens = tokenize(text)
    if len(tokens) < 3:
        return text

    base_sentence = detokenize(tokens)
    base_score = score_sentence(base_sentence)

    corrected = tokens[:]

    for i, tok in enumerate(tokens):
        if not tok.isalpha():
            continue

        candidates = generate_candidates(tok)
        if len(candidates) <= 1:
            continue

        best_tok = tok
        best_score = base_score

        for cand in candidates:
            if cand == tok:
                continue

            trial = corrected[:]
            trial[i] = cand
            sent = detokenize(trial)

            s = score_sentence(sent)

            if s > best_score + 0.25:
                best_score = s
                best_tok = cand

        corrected[i] = best_tok

    return detokenize(corrected)
