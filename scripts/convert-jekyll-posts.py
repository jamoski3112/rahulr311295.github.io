#!/usr/bin/env python3
"""One-off converter: Jekyll _posts/*.md (Minimal Mistakes front matter) -> Astro content collection.

Usage: python3 scripts/convert-jekyll-posts.py <path-to-jekyll-repo>/_posts src/content/posts
"""
import re, sys, pathlib, yaml

src, dst = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
dst.mkdir(parents=True, exist_ok=True)
FM = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.S)

for f in sorted(src.glob("*.md")):
    text = f.read_text(encoding="utf-8")
    m = FM.match(text)
    fm, body = yaml.safe_load(m.group(1)), text[m.end():]
    # Jekyll :title permalink = filename minus the date prefix (case preserved)
    slug = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", f.stem)
    # strip liquid raw guards; everything else in these posts is plain markdown/HTML
    body = re.sub(r"^\s*\{%\s*(raw|endraw)\s*%\}\s*$\n?", "", body, flags=re.M)
    body = body.replace('<div class="notice--info" markdown="0">', '<div class="notice notice--info">')

    out = {
        "title": fm["title"],
        "description": (fm.get("excerpt") or "").strip(),
        "date": fm["date"],
        "slug": slug,
    }
    teaser = (fm.get("header") or {}).get("teaser")
    if teaser:
        out["teaser"] = teaser
    out["categories"] = fm.get("categories") or []
    out["tags"] = fm.get("tags") or []
    if fm.get("htb"):
        htb = {k: v for k, v in fm["htb"].items() if v not in (None, "")}
        out["htb"] = htb
    header = yaml.safe_dump(out, sort_keys=False, allow_unicode=True, width=1000)
    (dst / f"{slug}.md").write_text(f"---\n{header}---\n{body.lstrip()}", encoding="utf-8")
    print("wrote", slug)
