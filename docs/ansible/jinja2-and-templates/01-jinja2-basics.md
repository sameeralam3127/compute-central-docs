---
icon: lucide/braces
description: Jinja2 expressions in Ansible — variable interpolation, arithmetic, string operations, and exactly when templating runs relative to YAML parsing.
tags:
  - Ansible
  - Jinja2
---

# Jinja2 Basics

## What You'll Learn

- The `{{ }}` expression syntax and where it's evaluated
- Arithmetic, string concatenation, and comparisons inside expressions
- Why quoting matters when a value needs to stay a specific type

## Mental Model

Every `{{ expression }}` in a playbook is rendered by the Jinja2 templating engine, **after** YAML parsing has already turned the file into Python data structures (see [YAML → Python Mental Model](../yaml-and-execution-model/02-yaml-to-python-mental-model.md)). YAML has no idea Jinja2 exists — it just sees an ordinary string that happens to contain `{{ }}` characters; Ansible renders it in a separate, later pass.

## Minimal Example

```yaml
- name: Show a rendered string
  ansible.builtin.debug:
    msg: "Deploying to {{ inventory_hostname }} in {{ env_name }}"
```

## Expressions Beyond Plain Substitution

```yaml
vars:
  base_port: 8000
  instance_id: 3

tasks:
  - name: Compute a per-instance port
    ansible.builtin.debug:
      msg: "Port is {{ base_port + instance_id }}"   # 8003

  - name: String concatenation
    ansible.builtin.debug:
      msg: "{{ env_name ~ '-' ~ inventory_hostname }}"

  - name: Comparison
    ansible.builtin.debug:
      msg: "{{ 'production ready' if replica_count >= 3 else 'needs more replicas' }}"
```

`~` concatenates as strings regardless of type (safer than `+`, which fails between a string and a number). The ternary `x if cond else y` form is the idiomatic Jinja2 conditional expression.

## Keeping a Type When It Matters

```yaml
# String "8080" — fine for most modules, which accept strings
port: "{{ base_port }}"

# Force an actual integer, e.g. for arithmetic or a module that validates type strictly
port: "{{ base_port | int }}"
```

Jinja2 renders every expression to a string by default unless the **entire** value is a single `{{ }}` expression — Ansible then attempts to preserve the underlying type (int, bool, list, dict) rather than stringify it. Mixing literal text with an expression (`"Port: {{ base_port }}"`) always produces a string.

## Common Mistakes

- Wrapping an already-Jinja2 field (like `when:`) in `{{ }}` — redundant, and non-idiomatic: `when: "{{ x == 1 }}"` works but should just be `when: x == 1`.
- Expecting `+` to concatenate a string and a number — use `~` for concatenation, reserve `+` for arithmetic between numbers.
- Assuming a value stays an integer after being wrapped in surrounding text — `"Port: {{ port }}"` is always a string, regardless of `port`'s underlying type.

## Interview Questions

- At what point does Jinja2 rendering happen relative to YAML parsing?
- Why would `{{ a + b }}` fail when `a` is a string and `b` is a number, and what's the fix?

## Next

Continue to [Filters and Tests](02-filters-and-tests.md).
