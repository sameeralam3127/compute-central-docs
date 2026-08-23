---
icon: lucide/merge
description: Defining runtime variables with set_fact, and merging dictionaries safely with combine instead of overwriting them.
tags:
  - Ansible
  - Variables
---

# set_fact and combine

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

Not every variable is known before a play starts — `set_fact` computes one at run time from other variables or registered results, and `combine` merges dictionaries without clobbering keys the naive `+`/override approach would lose.

## What It Will Cover

- `set_fact` basics and its precedence, roughly alongside registered variables — see [Variable Precedence](02-variable-precedence.md)
- `cacheable: true` on `set_fact` to persist a value into fact caching across runs
- Why overwriting a whole dictionary variable (`my_dict: {{ new_values }}`) loses keys the new value doesn't mention
- `combine` for a deep, non-destructive merge: `my_dict | combine(new_values, recursive=True)`
- A worked example: layering environment-specific overrides onto a base configuration dictionary without losing base keys

## Common Mistakes

- Reassigning a dictionary variable directly instead of using `combine`, silently dropping keys that weren't in the new value.
- Forgetting `recursive=True` when nested dictionaries need merging, not just top-level keys.
- Overusing `set_fact` as a substitute for proper role variable design — every `set_fact` is a runtime side effect that makes a playbook's data flow harder to follow.

## Interview Questions

- Why would `my_dict: "{{ new_values }}"` be wrong when you meant to merge, not replace?
- What does `combine(..., recursive=True)` do that a plain dictionary reassignment doesn't?

## Next

Continue to [Jinja2 & Templates](../jinja2-and-templates/index.md).
