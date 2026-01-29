import os
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

MODEL_NAME = "facebook/nllb-200-distilled-600M"
DEVICE = "cpu"
# Limit CPU threads to prevent system overload
NUM_THREADS = int(os.environ.get("MANWHAT_THREADS", "4"))
torch.set_num_threads(NUM_THREADS)

print("Loading NLLB translation model...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME).to(DEVICE)
print("Translation model loaded.")

def translate_text(text, src_lang, tgt_lang, num_variants=3):
    tokenizer.src_lang = src_lang
    encoded = tokenizer(text, return_tensors="pt").to(DEVICE)
    forced_bos = tokenizer.convert_tokens_to_ids(tgt_lang)

    results = []

    # 1. Best/Literal variant (Beam Search)
    # Uses beam search to find the most probable translation
    out_best = model.generate(
        **encoded,
        forced_bos_token_id=forced_bos,
        num_beams=3,
        num_return_sequences=1
    )
    results.append(tokenizer.decode(out_best[0], skip_special_tokens=True))

    # 2. Interpretative variants (Sampling)
    # Uses temperature sampling to generate more diverse/creative options
    if num_variants > 1:
        out_diverse = model.generate(
            **encoded,
            forced_bos_token_id=forced_bos,
            do_sample=True,
            temperature=0.9,
            top_p=0.95,
            num_return_sequences=num_variants - 1
        )
        for out in out_diverse:
            results.append(tokenizer.decode(out, skip_special_tokens=True))

    return results
