# postprocess_vi.py
import re
import kenlm
import itertools 

KENLM_PATH = "ocr/lm/vi.klm"

DIACRITIC_MAP = {
    "a": ["a","à","á","ả","ã","ạ","â","ầ","ấ","ẩ","ẫ","ậ","ă","ằ","ắ","ẳ","ẵ","ặ"],
    "e": ["e","è","é","ẻ","ẽ","ẹ","ê","ề","ế","ể","ễ","ệ"],
    "i": ["i","ì","í","ỉ","ĩ","ị"],
    "o": ["o","ò","ó","ỏ","õ","ọ","ô","ồ","ố","ổ","ỗ","ộ","ơ","ờ","ớ","ở","ỡ","ợ"],
    "u": ["u","ù","ú","ủ","ũ","ụ","ư","ừ","ứ","ử","ữ","ự"],
    "y": ["y","ỳ","ý","ỷ","ỹ","ỵ"],
    "d": ["d","đ"],
}
# Familles complètes (source de vérité)
DIACRITIC_FAMILIES = {
    "a": ["a","à","á","ả","ã","ạ",
          "â","ầ","ấ","ẩ","ẫ","ậ",
          "ǎ","ă","ằ","ắ","ẳ","ẵ","ặ","ā"],
    "e": ["e","è","é","ẻ","ẽ","ẹ",
          "ê","ề","ế","ể","ễ","ệ","ē"],
    "i": ["i","ì","í","ỉ","ĩ","ị"],
    "o": ["o","ò","ó","ỏ","õ","ọ",
          "ô","ồ","ố","ổ","ỗ","ộ",
          "ơ","ờ","ớ","ở","ỡ","ợ"],
    "u": ["u","ù","ú","ủ","ũ","ụ",
          "ư","ừ","ứ","ử","ữ","ự"],
    "y": ["y","ỳ","ý","ỷ","ỹ","ỵ"],
    "d": ["d","đ"],
}
FREQUENCY_ORDER = {
    "a": ["a","à","á","ạ","ả","ã","â","ă",
          "ầ","ấ","ậ","ẩ","ẫ","ằ","ắ","ặ","ẳ","ẵ","ợ"],
    "e": ["e","è","é","ẹ","ẻ","ẽ","ê",
          "ề","ế","ệ","ể","ễ"],
    "i": ["i","ì","í","ị","ỉ","ĩ"],
    "o": ["o","ò","ó","ọ","ỏ","õ","ô","ơ",
          "ồ","ố","ộ","ổ","ỗ","ờ","ớ","ợ","ở","ỡ"],
    "u": ["u","ù","ú","ụ","ủ","ũ","ư",
          "ừ","ứ","ự","ử","ữ"],
    "y": ["y","ỳ","ý","ỵ","ỷ","ỹ"],
    "d": ["d","đ"],
}
CHAR_TO_FAMILY = {}
for base, chars in DIACRITIC_FAMILIES.items():
    for c in chars:
        CHAR_TO_FAMILY[c] = base
# vrais mots vietnamiens d'une lettre
REAL_ONE_LETTER_WORDS = {"a", "à", "ạ", "ơ", "ở"}

# ponctuation autorisée autour
PUNCT = r"[.,!?;:…\"'()\[\]{}]"

# -------------------------------
# Split STRUCTUREL (rapide)
# -------------------------------
def split_candidates(token):
    """
    Génère des hypothèses STRUCTURELLES avec plusieurs coupures possibles.
    Aucune diacritique ici.
    """
    n = len(token)
    if n <= 4:
        return [(token, 5.0)]

    split_positions = set()

    # minuscule → Majuscule (signal fort)
    for m in re.finditer(r"([a-zà-ỹ])([A-Z])", token):
        split_positions.add(m.start(2))

    # voyelle → consonne
    for i in range(n - 1):
        if token[i].lower() in "aeiouyàáảãạāǎăằắẳẵặâầấẩẫậèéẻẽẹēêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ" and token[i+1].lower() not in "aeiouy":
            split_positions.add(i + 1)


    split_positions = sorted(split_positions)
    max_splits = n // 2

    candidates = set()
    candidates.add(token)

    for k in range(1, min(len(split_positions), max_splits) + 1):
        for pos_combo in itertools.combinations(split_positions, k):
            new_token = token
            offset = 0
            for p in sorted(pos_combo):
                p += offset
                new_token = new_token[:p] + " " + new_token[p:]
                offset += 1
            candidates.add(new_token)

    scored = []
    for cand in candidates:
        score = 0.0

        # bonus minuscule → Majuscule
        score += len(re.findall(r"[a-zà-ỹ] [A-Z]", cand)) * 3.0

        # bonus voyelle → consonne
        score += len(
            re.findall(r"[aeiouyàáảãạāǎăằắẳẵặâầấẩẫậèéẻẽẹēêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ] [^aeiouy]", cand, flags=re.IGNORECASE)
        ) * 1.0

        # bonus token long
        if n >= 8 and " " in cand:
            score += 0.5

        # PÉNALITÉ consonnes seules
        for w in cand.split():
            if is_consonant_only(w):
                score -= 100.0
            if not is_real_one_letter_word(w):
                score -= 100.0

        scored.append((cand, score))
    return scored

def is_consonant_only(word):
    
    return (
        len(word) > 1 and
        not re.search(r"[aeiouyàáảãạāǎăằắẳẵặâầấẩẫậèéẻẽẹēêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]", word, flags=re.IGNORECASE)
    )
def is_real_one_letter_word(word: str) -> bool:
    if not word:
        return True

    w = word.strip()

    # enlève ponctuation début/fin
    w = re.sub(fr"^{PUNCT}+|{PUNCT}+$", "", w)

    # doit être exactement 1 caractère unicode
    if len(w) != 1:
        return True

    return w.lower() in REAL_ONE_LETTER_WORDS
# -------------------------------
# Diacritiques contrôlées
# -------------------------------
def generate_variants(word, max_variants=200):
    options = [diacritic_variants(c) for c in fix_apostrophes(word)]
    for i, v in enumerate(itertools.product(*options)):
        if i >= max_variants:
            break
        yield "".join(v)


def diacritic_variants(char):
    """
    Retourne les variantes vietnamiennes plausibles
    pour n'importe quel caractère (accentué ou non).
    """
    base = CHAR_TO_FAMILY.get(char.lower())
    if not base:
        return [char]  # ponctuation, chiffres, etc.

    variants = FREQUENCY_ORDER[base]

    # respecter la casse d'origine
    if char.isupper():
        return [v.upper() for v in variants]
    return variants

def fix_apostrophes(w):
    # letter suivi de ' → essaie de remplacer par diacritique correspondant
    pattern = re.compile(r"([a-zA-Z])'")  # lettre suivie de '
    while True:
        m = pattern.search(w)
        if not m:
            break
        base_char = m.group(1)
        # récupère la première variante diacritique possible
        variants = diacritic_variants(base_char)
        # remplace le base_char' par la première variante
        w = w[:m.start()] + variants[1] + w[m.end():] if len(variants) > 1 else w
    return w
# -------------------------------
# KenLM Processor
# -------------------------------
class KenLMPostProcessor:
    def __init__(self):
        self.lm = kenlm.Model(KENLM_PATH)

    def score(self, text):
        scored = self.lm.score(text, bos=True, eos=True)
    
        return scored

    def correct_sentence(self, sentence):
        tokens = sentence.split()
        split_options = []
        for t in tokens:
            cands = split_candidates(t)  # [(variant, score), ...]

            if not cands:
                split_options.append([t])
                continue

            # score maximal pour ce token
            max_score = max(score for _, score in cands)

            # garder UNIQUEMENT les meilleurs (ou ex æquo)
            best_variants = [
                variant for variant, score in cands
                if score == max_score
            ]

            split_options.append(best_variants)
        
        # Générer phrases candidates (LIMITÉ)
        phrases = []
        for p in itertools.product(*split_options):
            phrases.append(" ".join(p))
            if len(phrases) >= 10:
                break
        best_phrase = max(phrases, key=self.score)

        # Diacritiques mot à mot
        final_tokens = []
        words = best_phrase.split()
        best_tokens = self.decode_with_beam(words, beam_size=6)
        return " ".join(best_tokens)
        for i, w in enumerate(words):
            vars = list(generate_variants(w))
            if len(vars) == 1:
                final_tokens.append(w)
                continue

            ctx = " ".join(words[max(0,i-1):i] + ["{}"] + words[i+1:i+2])
            best = max(vars, key=lambda v: self.score(ctx.format(v)))
            final_tokens.append(best)

        return " ".join(final_tokens)
    def filter_word_variants(self, word, max_keep=5):
        vars = list(generate_variants(word))
        scored = []
        for v in vars:
            # pénalité mot absurde
            if is_consonant_only(v):
                continue

            s = self.score(v)
            scored.append((v, s))

        # garder les meilleurs
        scored.sort(key=lambda x: x[1], reverse=True)
        return [v for v, _ in scored[:max_keep]]

    def decode_with_beam(self, words, beam_size=10):
        beams = [([], 0.0)]  # (tokens, score)

        for i, w in enumerate(words):
            variants = self.filter_word_variants(w)
            new_beams = []
            for tokens, score in beams:
                for v in variants:
                    phrase = " ".join(tokens + [v])
                    s = self.score(phrase)
                    new_beams.append((tokens + [v], s))

            # garder les meilleurs beams
            new_beams.sort(key=lambda x: x[1], reverse=True)
            beams = new_beams[:beam_size]

        return beams[0][0]
# -------------------------------
# Endpoint pipeline
# -------------------------------
def postprocess_ocr_results(ocr_list, include_source = False):
    processor = KenLMPostProcessor()
    results = []

    for item in ocr_list:
        src = item["original"]
        corrected = processor.correct_sentence(src) if src.strip() else src
        if include_source:
            results.append({
                "box_2d": item["box_2d"],
                "original": corrected,
                "source": src,
                "confidence": item["confidence"],
            })
        else :
            results.append({
                "box_2d": item["box_2d"],
                "original": corrected,
                "confidence": item["confidence"],
            })
    return results


# -------------------------------
# Exemple d'utilisation
# -------------------------------
if __name__ == "__main__":
    sample_input = [
        {'box_2d': [1095, 0, 1399, 309], 'original': 'Nhu cau nói, neu tòi có duāc thuc luc hiēn tai khigǎpXing, thiXing...', 'confidence': 0.9010631442070007},
        {'box_2d': [1081, 1146, 1109, 1260], 'original': 'itchHunter', 'confidence': 0.949954628944397},
        {'box_2d': [1418, 995, 1484, 1244], 'original': 'The nhung...', 'confidence': 0.8630566596984863},
        {'box_2d': [1468, 451, 1513, 496], 'original': 'C', 'confidence': 0.5477546453475952},
        {'box_2d': [1969, 708, 2048, 896], 'original': 'Có le da', 'confidence': 0.7825096845626831}
    ]

    corrected = postprocess_ocr_results(sample_input, True)
    for c in corrected:
        print(c)
