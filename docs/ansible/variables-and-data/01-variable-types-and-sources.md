---
title: "Ansible Variable Types and Sources"
icon: lucide/variable
description: Every place an Ansible variable can be defined — inventory, group_vars, host_vars, play vars, role vars and defaults, extra vars, and more — before precedence is applied.
tags:
  - Ansible
  - Variables
---

# Variable Types and Sources

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

Precedence ([next page](02-variable-precedence.md)) only makes sense once every source is named individually — this page is the inventory of *where* a value can live, before ranking them.

## What It Will Cover

- Inventory variables — inline, `host_vars/<host>.yml`, `group_vars/<group>.yml`, `group_vars/all.yml`
- Play-level `vars:` and `vars_files:`
- Role `defaults/main.yml` vs. `vars/main.yml`
- Block-level and task-level `vars:`
- `include_vars` for loading a variables file mid-play
- Extra vars via `-e` on the command line, including `-e @file.yml`
- Data types: strings, numbers, booleans, lists, dictionaries, and nested structures — and how Jinja2 renders each

## Common Mistakes

- Assuming all "vars" sources are equal in precedence — they are emphatically not; see [Variable Precedence](02-variable-precedence.md).
- Putting environment-specific values in role `vars/main.yml` (hard to override) instead of `defaults/main.yml` (easy to override).

## Interview Questions

- Name every place a variable can be defined in Ansible, without looking it up.
- What's the practical difference between role `defaults/main.yml` and `vars/main.yml`?

## Next

Continue to [Variable Precedence](02-variable-precedence.md).
