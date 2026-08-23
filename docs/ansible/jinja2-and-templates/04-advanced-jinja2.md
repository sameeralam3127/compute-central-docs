---
icon: lucide/sparkles
description: Jinja2 macros, whitespace control, and custom filter plugins for Ansible templates.
tags:
  - Ansible
  - Jinja2
---

# Advanced Jinja2

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## What It Will Cover

- `{% macro %}` for reusable template snippets across multiple `.j2` files, with `{% import %}`
- Whitespace control (`{%-` / `-%}`) to stop generated config files from accumulating blank lines
- Writing a custom Jinja2 filter plugin and referencing it from a collection — cross-referenced from [Build a Collection From Zero](../build-your-own/03-build-a-collection-from-zero.md)
- `vars()`/`{% set %}` for computing an intermediate value inside a template

## Common Mistakes

- Overusing macros for logic that would be clearer as a `set_fact` computed before the template renders at all.
- Not using whitespace control, producing config files with irregular blank lines that make diffs noisy in review.

## Interview Questions

- When would you write a custom Jinja2 filter instead of chaining built-in ones?
- What does whitespace control (`{%-`/`-%}`) actually change in rendered output?

## Next

Continue to [Modules](../modules/index.md).
