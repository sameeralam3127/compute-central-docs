---
icon: lucide/braces
description: Jinja2 templating in Ansible — the template module, expression syntax, filters, whitespace control, and how templating relates to YAML parsing.
tags:
  - Ansible
  - Volume 2
  - Templates
---

# Part 41 — Jinja2 and Templates

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

Every `{{ }}` a reader has already seen in this series — in variables, in conditionals, in loop items — is Jinja2. This chapter is where that templating language, and the `template` module built on top of it, finally gets its own full treatment instead of scattered mentions.

## Why This Exists

- Jinja2 is used constantly from the very first playbook onward, but until now it's only ever been referenced in passing (as "the templating layer" in [Part 4 — Why YAML?](../volume-1-fundamentals-and-history/04-why-yaml.md), and as the mechanism behind the `template` action plugin in Volume 5). This chapter is the dedicated deep dive the rest of the series has been assuming.

## Problem Statement

- Config files (nginx vhosts, application configs, systemd units) need host-specific or environment-specific values injected into an otherwise-static file — hardcoding a separate file per host doesn't scale, and `lineinfile`/`blockinfile` (Volume 1, Part 5) aren't a good fit for a whole structured file.

## Internal Architecture

- **Parsing order**: a playbook's own YAML is Jinja2-rendered *before* the YAML is parsed into Python structures for `{{ }}` expressions inside task arguments (covered in Volume 1, Part 4) — but a *templated file* (via the `template` module) is rendered separately, at task-execution time, against that task's own variable context.
- **The `template` module vs. `copy`**: `copy` moves a file byte-for-byte; `template` renders a `.j2` file through Jinja2 first, then places the rendered result on the managed node — the two are otherwise similar in interface (`src`, `dest`, `owner`, `mode`).

## Step-by-Step Explanation

- **Expression syntax**: `{{ variable }}` for output, `{% if %}`/`{% for %}` for control structures inside a template file (as opposed to YAML-level `when`/`loop`, which control whether/how many times a *task* runs).
- **Filters**: Jinja2's `|` pipe syntax (`{{ value | default('none') }}`, `{{ list | join(', ') }}`) plus Ansible-specific filters (`to_json`, `to_yaml`, `bool`, `regex_replace`).
- **Whitespace control**: `{%-`/`-%}` trimming to avoid stray blank lines in rendered config files — a common first surprise when a generated file has odd gaps.
- **Conditionals and loops inside templates**: `{% if ansible_facts['os_family'] == 'Debian' %}` branching, and `{% for item in list %}` blocks, distinct from the same-looking constructs at the playbook-task level.
- **Macros**: reusable template snippets defined with `{% macro %}` for repeated structures across a large template.

## Production Best Practices

- Keeping business logic (deciding *which* value a host should get) in variables/facts, and keeping templates themselves close to "just formatting" — a template full of complex `{% if %}` branching is a sign logic belongs in a variable or a role default instead.
- Using `validate:` on the `template` module (where the target config format supports a syntax-check command, e.g., `nginx -t`) to catch a bad render before it's actually placed on the managed node.

## Common Mistakes

- Confusing a template-level `{% if %}` (controls what text appears *inside* the rendered file) with a task-level `when:` (controls whether the *task* runs at all) — they look similar but operate at completely different layers.
- Forgetting whitespace control and shipping a config file full of unintended blank lines.
- Referencing an undefined variable inside a template and getting a rendering failure at deploy time instead of catching it earlier.

## Performance Considerations

- Rendering very large templates (thousands of lines, heavy macro use) happens on the control node before transfer — this is an `action`-plugin-side cost (Volume 5, Part 26), separate from the managed node's own task-execution cost.

## Security Considerations

- Never build a template's *file path* or *destination* from unsanitized user input; and treat any secret value flowing into a template the same as any other sensitive variable — `no_log` on the task, and avoiding secrets in a template that might get logged via `--diff`.

## Interview Questions

- "What's the difference between the `copy` and `template` modules?"
- "How does whitespace control (`{%-`/`-%}`) affect a rendered file, and when would you use it?"
- "What's the difference between a `{% if %}` inside a template and a `when:` on a task?"

## Hands-On Lab

- Write a minimal `nginx.conf.j2` template with one variable and one `{% if %}` block, render it with the `template` module against two hosts with different variable values, and diff the two resulting files.

## Summary

- Jinja2 is the rendering engine behind every `{{ }}` in the series so far; the `template` module is where it graduates from small inline expressions to rendering entire host-specific configuration files, with its own syntax (filters, whitespace control, macros) worth knowing deliberately rather than by accident.

## Next

Continue to [Part 13 — Collections](11-collections.md).
