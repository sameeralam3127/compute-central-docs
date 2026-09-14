#!/usr/bin/env python3
"""Add git-based "last updated" and "first published" dates to the site.

Two steps, run in CI around `zensical build`:

  python scripts/freshness.py frontmatter   # before the build
  python scripts/freshness.py sitemap       # after the build

`frontmatter` reads each page's first and last commit dates from git and
writes them into the page's front matter as `last_updated` /
`last_updated_display` and `date_published` / `date_published_display`
(ISO and human-readable). The templates use these for the byline and
structured data (dateModified / datePublished). It rewrites files in docs/,
so it refuses to run outside CI unless you pass --force — don't commit the
result.

`sitemap` adds <lastmod> to site/sitemap.xml using the same dates.

Requires full git history (actions/checkout with fetch-depth: 0).
"""

import os
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

DOCS = Path("docs")
SITE = Path("site")
SITE_URL = "https://computecentral.in/"


def url_path(md: Path) -> str:
    """docs/a/b.md -> a/b/, docs/a/index.md -> a/, docs/index.md -> ''."""
    rel = md.relative_to(DOCS).with_suffix("")
    parts = list(rel.parts)
    if parts[-1] == "index":
        parts = parts[:-1]
    return "/".join(parts) + ("/" if parts else "")


def last_commit_dates() -> dict[Path, str]:
    """Map every tracked Markdown file to the date of its most recent commit.

    One `git log` pass over the whole history is much faster than one
    `git log -1` per file.
    """
    out = subprocess.run(
        ["git", "log", "--format=%x00%cs", "--name-only", "--", str(DOCS)],
        capture_output=True, text=True, check=True,
    ).stdout
    dates: dict[Path, str] = {}
    current = None
    for line in out.splitlines():
        if line.startswith("\x00"):
            current = line[1:]
        elif line.endswith(".md") and current:
            dates.setdefault(Path(line), current)  # log is newest first
    return dates


def first_commit_dates() -> dict[Path, str]:
    """Map every tracked Markdown file to the date of its first (oldest) commit."""
    out = subprocess.run(
        ["git", "log", "--format=%x00%cs", "--name-only", "--", str(DOCS)],
        capture_output=True, text=True, check=True,
    ).stdout
    dates: dict[Path, str] = {}
    current = None
    for line in out.splitlines():
        if line.startswith("\x00"):
            current = line[1:]
        elif line.endswith(".md") and current:
            dates[Path(line)] = current  # log is newest first: last write wins = oldest
    return dates


def display(iso: str) -> str:
    d = date.fromisoformat(iso)
    return f"{d.day} {d:%B %Y}"


def cmd_frontmatter(force: bool) -> None:
    if not (os.environ.get("CI") or force):
        sys.exit(
            "refusing to rewrite docs/ outside CI; "
            "pass --force to run locally (don't commit the result)"
        )
    shallow = subprocess.run(
        ["git", "rev-parse", "--is-shallow-repository"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    if shallow == "true":
        sys.exit(
            "shallow clone: dates would all be today; "
            "use actions/checkout with fetch-depth: 0"
        )

    dates = last_commit_dates()
    created = first_commit_dates()
    by_url: dict[str, str] = {}
    written = 0
    for md in sorted(DOCS.rglob("*.md")):
        iso = dates.get(md)
        if not iso:
            continue  # untracked file
        published_iso = created.get(md, iso)
        by_url[url_path(md)] = iso
        text = md.read_text(encoding="utf-8")
        if re.search(r"^last_updated:", text, re.M):
            continue
        fields = (
            f'last_updated: "{iso}"\n'
            f'last_updated_display: "{display(iso)}"\n'
            f'date_published: "{published_iso}"\n'
            f'date_published_display: "{display(published_iso)}"\n'
        )
        if text.startswith("---\n"):
            end = text.index("\n---", 3)
            text = text[:end + 1] + fields + text[end + 1:]
        else:
            text = f"---\n{fields}---\n\n{text}"
        md.write_text(text, encoding="utf-8")
        written += 1

    newest = max(by_url.values())
    print(f"frontmatter: dated {written} pages; newest {newest}")


def cmd_sitemap() -> None:
    # Recompute from git rather than reading a file: `zensical build --clean`
    # empties .cache/ between the two steps.
    by_url = {
        url_path(md): iso
        for md, iso in last_commit_dates().items()
        if md.exists()
    }
    sitemap = SITE / "sitemap.xml"
    xml = sitemap.read_text(encoding="utf-8")
    added = 0

    def add_lastmod(m: re.Match) -> str:
        nonlocal added
        loc = m.group(1)
        iso = by_url.get(loc.removeprefix(SITE_URL))
        if not iso or "<lastmod>" in m.group(0):
            return m.group(0)
        added += 1
        return f"<loc>{loc}</loc>\n        <lastmod>{iso}</lastmod>"

    xml = re.sub(r"<loc>([^<]+)</loc>", add_lastmod, xml)
    sitemap.write_text(xml, encoding="utf-8")
    total = xml.count("<loc>")
    print(f"sitemap: added lastmod to {added} of {total} URLs")
    if added < total:
        sys.exit("some sitemap URLs have no git date; check url_path()")


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in {"frontmatter", "sitemap"}:
        sys.exit(__doc__)
    if sys.argv[1] == "frontmatter":
        cmd_frontmatter(force="--force" in sys.argv)
    else:
        cmd_sitemap()
