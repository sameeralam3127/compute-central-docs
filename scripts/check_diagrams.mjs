#!/usr/bin/env node
/* Fail the build if any Mermaid diagram in the built site doesn't parse.

  npm ci --prefix scripts           # once: installs mermaid and jsdom
  node scripts/check_diagrams.mjs   # after `zensical build`

A diagram that doesn't parse shows readers its raw source instead of a
picture. It parses every pre.mermaid-lazy block in site/ with the same
Mermaid release that javascripts/extra.js loads in the browser, and refuses
to run if the two versions differ, so the check can't drift from production.
*/
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { JSDOM } from "jsdom";

const SITE = "site";
const EXTRA_JS = "docs/javascripts/extra.js";

// Mermaid sanitizes labels with DOMPurify, which needs a DOM even to parse.
const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
for (const key of ["window", "document", "DOMParser", "Element", "HTMLElement", "SVGElement", "Node"]) {
  const value = key === "window" ? dom.window : dom.window[key];
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}

const require = createRequire(import.meta.url);
const installed = require("mermaid/package.json").version;
const loaded = /mermaid@([0-9.]+)\//.exec(readFileSync(EXTRA_JS, "utf8"));
if (!loaded) {
  console.error(`::error::could not find the Mermaid version in ${EXTRA_JS}`);
  process.exit(1);
}
if (loaded[1] !== installed) {
  console.error(
    `::error::${EXTRA_JS} loads Mermaid ${loaded[1]} but scripts/package.json pins ${installed}; ` +
    "update both together so this check matches what readers get",
  );
  process.exit(1);
}

const { default: mermaid } = await import("mermaid");
mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });

function* pages(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* pages(path);
    else if (entry.name === "index.html") yield path;
  }
}

// pymdownx.superfences escapes the source; decode it the way a browser does.
const decoder = dom.window.document.createElement("textarea");
function decode(html) {
  decoder.innerHTML = html;
  return decoder.value;
}

let diagrams = 0;
const failures = [];
for (const page of pages(SITE)) {
  const html = readFileSync(page, "utf8");
  const url = "/" + relative(SITE, page).replace(/index\.html$/, "");
  let n = 0;
  for (const match of html.matchAll(/<pre class="mermaid-lazy"><code>([\s\S]*?)<\/code><\/pre>/g)) {
    n += 1;
    diagrams += 1;
    try {
      await mermaid.parse(decode(match[1]));
    } catch (error) {
      failures.push({ url, n, message: String(error.message || error) });
    }
  }
}

for (const { url, n, message } of failures) {
  const [first, ...rest] = message.split("\n");
  console.error(`::error::${url} diagram ${n}: ${first}`);
  if (rest.length) console.error(rest.slice(0, 3).map((line) => "    " + line).join("\n"));
}
if (failures.length) {
  console.error(`${failures.length} of ${diagrams} Mermaid diagrams fail to parse.`);
  process.exit(1);
}
process.stdout.write(`diagrams: all ${diagrams} Mermaid diagrams parse with Mermaid ${installed}\n`);
