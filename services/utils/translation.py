DEFAULT_TABLE = "vie_Latn"

TRANSLATION_TABLE = {
    "vietnamese": "vie_Latn",
    "korean": "kor_Hang",
    "japanese": "jpn_Jpan",
    "chinese_s": "zho_Hans",
    "auto": DEFAULT_TABLE,
}

def parse_source_language(lang):
    if lang is None: 
        return DEFAULT_TABLE
    elif not lang in TRANSLATION_TABLE:
        return DEFAULT_TABLE

    return TRANSLATION_TABLE[lang]
    
