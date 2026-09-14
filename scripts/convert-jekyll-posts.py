#!/usr/bin/env python3
"""Convert Jekyll / Minimal Mistakes posts (the old blog format, also used by the
private htb-writeup-drafts repo) into this site's Astro content format.

Usage:
  python3 scripts/convert-jekyll-posts.py <posts-dir-or-file>... <output-dir> [--date YYYY-MM-DD]

- Output file name = input file name minus the YYYY-MM-DD- prefix (this is the URL slug,
  case preserved, matching the old Jekyll :title permalinks). Any `slug:` in the source
  front matter is ignored so URLs never drift.
- `layout`, `classes`, `header.icon`, `header.teaser_home_page` and the drafts-repo-only
  `status` field are dropped. `excerpt` becomes `description`, `header.teaser` becomes `teaser`.
- Liquid {% raw %} / {% endraw %} guards are stripped (Astro markdown needs none).
- `--date` overrides the post date (used when publishing a draft on retirement day).
"""
import re, sys, pathlib, yaml

args = sys.argv[1:]
override_date = None
if '--date' in args:
    i = args.index('--date'); override_date = args[i + 1]; del args[i:i + 2]
if len(args) < 2:
    sys.exit(__doc__)
*inputs, out = args
dst = pathlib.Path(out); dst.mkdir(parents=True, exist_ok=True)
FM = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.S)

files = []
for inp in inputs:
    p = pathlib.Path(inp)
    files += sorted(p.glob("*.md")) if p.is_dir() else [p]

for f in files:
    text = f.read_text(encoding="utf-8")
    m = FM.match(text)
    if not m:
        print("skip (no front matter):", f); continue
    fm, body = yaml.safe_load(m.group(1)), text[m.end():]
    slug = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", f.stem)
    body = re.sub(r"^\s*\{%\s*(raw|endraw)\s*%\}\s*$\n?", "", body, flags=re.M)
    body = body.replace('<div class="notice--info" markdown="0">', '<div class="notice notice--info">')

    out_fm = {
        "title": fm["title"],
        "description": (fm.get("excerpt") or fm.get("description") or "").strip(),
        "date": override_date or fm["date"],
        "slug": slug,
    }
    teaser = (fm.get("header") or {}).get("teaser") or fm.get("teaser")
    if teaser:
        out_fm["teaser"] = teaser
    out_fm["categories"] = fm.get("categories") or []
    out_fm["tags"] = fm.get("tags") or []
    if fm.get("htb"):
        out_fm["htb"] = {k: v for k, v in fm["htb"].items() if v not in (None, "")}
    header = yaml.safe_dump(out_fm, sort_keys=False, allow_unicode=True, width=1000)
    target = dst / f"{slug}.md"
    target.write_text(f"---\n{header}---\n{body.lstrip()}", encoding="utf-8")
    print("wrote", target)
