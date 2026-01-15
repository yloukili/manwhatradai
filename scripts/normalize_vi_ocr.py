import sys

for line in sys.stdin:
    line = line.replace("’", "'").replace("“", '"').replace("”", '"')
    line = line.replace("…", "...")
    print(line.strip())