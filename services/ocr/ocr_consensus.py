import difflib

UNCERTAIN_TOKEN = "[X]"

def build_consensus(texts, min_agreement=0.6):
    """
    texts: list[str] from multiple OCR passes
    Returns a consensus string with [X] where disagreement exists
    """

    if not texts:
        return ""

    # Start from the longest text (best anchor)
    anchor = max(texts, key=len)
    consensus = list(anchor)

    for i, char in enumerate(anchor):
        votes = []
        for t in texts:
            if i < len(t):
                votes.append(t[i])

        if not votes:
            consensus[i] = UNCERTAIN_TOKEN
            continue

        most_common = max(set(votes), key=votes.count)
        agreement = votes.count(most_common) / len(votes)

        if agreement < min_agreement:
            consensus[i] = UNCERTAIN_TOKEN
        else:
            consensus[i] = most_common

    return "".join(consensus)


def consensus_from_lines(lines_per_pass):
    """
    lines_per_pass: list[list[str]]
    Returns list[str] consensus per line
    """
    num_lines = min(len(p) for p in lines_per_pass)
    results = []

    for i in range(num_lines):
        texts = [p[i] for p in lines_per_pass]
        results.append(build_consensus(texts))

    return results
