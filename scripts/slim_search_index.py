#!/usr/bin/env python3
"""Shrink site/search.json after `zensical build`.

The theme downloads the whole search index on every page load. Code blocks
make up about 40% of its text, so this removes <pre> blocks from each entry
while keeping prose, headings, and inline `code` searchable.

  python scripts/slim_search_index.py
"""

import json
import re
from pathlib import Path

INDEX = Path("site/search.json")
PRE = re.compile(r"<pre\b.*?</pre>", re.S)
SPACE = re.compile(r"\s{2,}")

data = json.loads(INDEX.read_text(encoding="utf-8"))
before = INDEX.stat().st_size
for item in data["items"]:
    item["text"] = SPACE.sub(" ", PRE.sub(" ", item["text"])).strip()
compact = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
INDEX.write_text(compact, encoding="utf-8")
after = INDEX.stat().st_size
saved = 100 - 100 * after // before
print(f"search index: {before:,} -> {after:,} bytes ({saved}% smaller)")
