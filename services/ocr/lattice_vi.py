# services/ocr/lattice_vi.py
import kenlm
import os

BASE_DIR = os.path.dirname(__file__)
LM_PATH = os.path.join(BASE_DIR, "lm", "vi.klm")

_lm = None

def get_lm():
    global _lm
    if _lm is None:
        _lm = kenlm.Model(LM_PATH)
    return _lm


def choose_best_sentence(candidates):
    """
    candidates: list[str]
    """
    lm = get_lm()
    print(candidates)
    best = candidates[0]
    best_score = lm.score(best, bos=True, eos=True)

    for s in candidates[1:]:
        score = lm.score(s, bos=True, eos=True)
        if score > best_score:
            best = s
            best_score = score

    return best