#!/usr/bin/env python3
"""Stamp the site's own CSS and JS URLs with the build version.

Run in CI after `zensical build`:

  python scripts/version_assets.py

The theme's assets already have content hashes in their names, but
stylesheets/extra.css and javascripts/extra.js are served from the same URL
on every release, and GitHub Pages lets browsers cache them for 10 minutes.
Right after a deploy a reader could get the new HTML with the old script,
and interactive tools would never load. This appends ?v=<build> to both URLs
in every page, and marks each page's container with the same build, which
javascripts/extra.js uses to reload a tab still running an older release
(instant navigation never re-runs scripts).

The build is the commit being deployed: $GITHUB_SHA in Actions, otherwise
`git rev-parse HEAD`.
"""

import os
import re
import subprocess
import sys
from pathlib import Path

SITE = Path("site")
ASSET = re.compile(r'((?:href|src)="[^"?]*/(?:stylesheets/extra\.css|javascripts/extra\.js))"')
CONTAINER = '<div class="md-container" data-md-component="container"'


def build_id() -> str:
    sha = os.environ.get("GITHUB_SHA") or subprocess.run(
        ["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True,
    ).stdout.strip()
    return sha[:12]


def main() -> None:
    build = build_id()
    pages = 0
    for html in SITE.rglob("*.html"):
        text = html.read_text(encoding="utf-8")
        if CONTAINER not in text:
            continue  # redirect stubs have no theme assets
        text, assets = ASSET.subn(rf'\1?v={build}"', text)
        if assets != 2:
            sys.exit(f"{html}: expected extra.css and extra.js, found {assets}")
        text = text.replace(CONTAINER, f'{CONTAINER} data-cc-build="{build}"', 1)
        html.write_text(text, encoding="utf-8")
        pages += 1
    if not pages:
        sys.exit("no pages found; run after zensical build")
    print(f"assets: versioned extra.css and extra.js as ?v={build} on {pages} pages")


if __name__ == "__main__":
    main()
