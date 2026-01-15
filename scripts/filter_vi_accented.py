import sys
import re

VI_DIACRITICS = re.compile(
    r"[àáạảãâầấậẩẫăằắặẳẵ"
    r"èéẹẻẽêềếệểễ"
    r"ìíịỉĩ"
    r"òóọỏõôồốộổỗơờớợởỡ"
    r"ùúụủũưừứựửữ"
    r"ỳýỵỷỹ"
    r"đ]",
    re.IGNORECASE
)

with open(sys.argv[1], "r", encoding="utf-8", errors="ignore") as f:
    for line in f:
        if VI_DIACRITICS.search(line):
            print(line.strip())