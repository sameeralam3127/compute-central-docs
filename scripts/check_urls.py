#!/usr/bin/env python3
"""Fail the build if a published URL stops working.

scripts/published-urls.txt lists every URL path the site has published. After
`zensical build`, each one must still exist in site/, either as a page or as a
redirect from [project.plugins.redirects.redirect_maps] in zensical.toml.

  python scripts/check_urls.py            # check (CI)
  python scripts/check_urls.py --update   # also record new pages

Moving or deleting a page without a redirect fails the check. New pages only
warn until you run --update and commit the list.
"""

import re
import sys
from pathlib import Path

SITE = Path("site")
LIST = Path("scripts/published-urls.txt")
SITE_URL = "https://computecentral.in/"


def exists(url: str) -> bool:
    return (SITE / url / "index.html").is_file()


def sitemap_urls() -> set[str]:
    xml = (SITE / "sitemap.xml").read_text(encoding="utf-8")
    locs = re.findall(r"<loc>([^<]+)</loc>", xml)
    return {loc.removeprefix(SITE_URL) for loc in locs}


def main(update: bool) -> None:
    lines = LIST.read_text(encoding="utf-8").splitlines()
    recorded = {line.strip() for line in lines if line.strip()}
    recorded.discard("/")  # the homepage is stored as "/"
    missing = sorted(url for url in recorded if not exists(url))
    new = sorted(sitemap_urls() - recorded - {""})

    if update and new:
        urls = sorted(recorded | set(new))
        LIST.write_text("/\n" + "\n".join(urls) + "\n", encoding="utf-8")
        print(f"recorded {len(new)} new URLs in {LIST}")
    elif new:
        print(
            f"::warning::{len(new)} new URLs are not in {LIST}; "
            "run `python scripts/check_urls.py --update` and commit"
        )

    if missing:
        for url in missing:
            print(f"::error::published URL no longer exists: /{url}")
        sys.exit(
            f"{len(missing)} published URLs would return 404. Add each to "
            "[project.plugins.redirects.redirect_maps] in zensical.toml."
        )
    print(f"urls: all {len(recorded)} published URLs still resolve")


if __name__ == "__main__":
    main(update="--update" in sys.argv)
