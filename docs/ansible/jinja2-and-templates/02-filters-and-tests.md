---
title: "Ansible Jinja2 Filters and Tests Reference"
icon: lucide/filter
description: The Jinja2 filters and tests used constantly in Ansible playbooks — default, join, dict2items, and is defined/is failed.
tags:
  - Ansible
  - Jinja2
---

# Filters and Tests

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

Filters transform a value (`| default`, `| join`); tests answer a yes/no question about a value (`is defined`, `is failed`) — together they're most of what makes a Jinja2 expression in a real playbook longer than a bare variable name.

## What It Will Cover

- `| default('fallback')` and `| default([], true)` (the second argument treats an empty string/list as undefined too)
- `| join(', ')`, `| length`, `| unique`, `| sort`
- `| dict2items` / `| items2dict` for looping over dictionaries with `loop`
- `| to_json` / `| from_json`, `| to_yaml` / `| from_yaml`
- `| select`/`| selectattr`/`| map` for filtering and projecting lists of dictionaries
- Tests: `is defined`, `is undefined`, `is none`, `is failed`, `is success`, `is changed`
- The difference between a filter (`|`) and a test (`is`) syntactically and conceptually

## Common Mistakes

- Using `| default('')` and still hitting an "undefined variable" error because the variable is genuinely undefined in a *nested* lookup Jinja2 evaluates before the filter applies.
- Confusing `is defined` (variable exists) with a falsy-value check — an empty string or `0` is still "defined."

## Interview Questions

- What does `| default([], true)` do differently from plain `| default([])`?
- How would you filter a list of dictionaries down to only the ones matching a condition, without a full `for` loop?

## Next

Continue to [Templates for Config Generation](03-templates-for-config-generation.md).
