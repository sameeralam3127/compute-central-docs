---
icon: lucide/file-text
description: YAML's history, why Ansible chose it over JSON, XML, and TOML, indentation rules, anchors, aliases, multiline strings, and the parser mistakes everyone makes at least once.
tags:
  - Ansible
  - Volume 1
  - YAML
---

# Part 4 — Why YAML?

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

Every Ansible beginner's first real bug is a YAML indentation error. This chapter treats that rite of passage seriously: what YAML is, why it was chosen, and how to stop fighting it.

## Why This Exists

- YAML isn't incidental to Ansible — it's a deliberate readability bet. Understanding *why* makes the syntax rules feel like design, not arbitrary punishment.

## Problem Statement

- What playbooks would look like in JSON (no comments, verbose bracket/brace nesting, unforgiving trailing commas) versus what they look like in YAML — side-by-side comparison.

## History / Context

- **YAML's history**: "YAML Ain't Markup Language," first specification 2001, designed for human-editable data serialization (distinct from XML/SGML's document-markup lineage).
- **Why not JSON**: no comments, no multiline strings, more punctuation-heavy, harder to hand-edit and diff cleanly in code review.
- **Why not XML**: verbose closing tags, historically associated with Puppet/Chef-adjacent enterprise tooling fatigue, harder for non-programmers to read.
- **Why not TOML**: TOML is good for flat-ish config (and Cargo/pyproject.toml use it well) but is awkward for YAML's real target — deeply nested, list-heavy structures like task lists and variable trees.

## Internal Architecture

- How Ansible actually parses YAML: PyYAML/`ansible.parsing.yaml`, the custom loader that adds line/column tracking for better error messages, and Jinja2 templating layered on top (rendered *after* YAML parsing, not during).

## Workflow

- The parse pipeline: raw file → YAML tokenizer → Python data structures (dicts/lists) → Ansible's own validation against module argspecs.

## Step-by-Step Explanation

- **Indentation rules**: 2-space convention, why tabs are rejected, how list items (`-`) interact with mapping indentation.
- **Anchors and aliases** (`&name` / `*name`): reusing a block of YAML elsewhere in the same file, with a worked example.
- **Multiline strings**: block scalars `|` (literal, preserves newlines) vs. `>` (folded, joins into one line), and the chomping indicators `-`/`+`.

## Production Best Practices

- Consistent 2-space indentation enforced by `yamllint`/`ansible-lint` in CI (previewed here, covered fully in Volume 5).
- Preferring explicit `true`/`false` over YAML's many boolean-like synonyms (`yes`/`no`/`on`/`off`) for clarity, since Ansible historically had surprising boolean coercion behavior.

## Common Mistakes

- Mixing tabs and spaces (YAML forbids tabs for indentation).
- The `no`/`yes`/`on`/`off`/country-code-like string surprises (Norway problem) where a bare token gets parsed as a boolean or number instead of a string.
- Forgetting that a colon inside an unquoted string (e.g., a URL) can break mapping parsing, requiring quotes.
- Inconsistent indentation between sibling keys causing silent structural changes rather than a parse error.

## Performance Considerations

- YAML parsing cost is negligible at playbook scale; not a performance topic in practice — noted briefly and moved on.

## Security Considerations

- YAML deserialization risks in general-purpose contexts (e.g., unsafe `yaml.load`) and why Ansible's parser deliberately avoids executing arbitrary Python objects during load.

## Interview Questions

- "Why did Ansible choose YAML instead of JSON?"
- "What's the difference between the `|` and `>` block scalar styles?"
- "What is the YAML 'Norway problem' and how do you avoid it in a playbook?"

## Hands-On Lab

- Take a small JSON data structure and hand-convert it to YAML, then deliberately introduce and fix three common YAML mistakes (bad indentation, an unquoted colon, a boolean-coercion surprise).

## Summary

- YAML was chosen for human readability and diffability, not just because it's popular — and its quirks (indentation strictness, boolean coercion) are the price of that readability.

## Next

Continue to [Part 5 — Declarative vs. Imperative](05-declarative-vs-imperative.md).
