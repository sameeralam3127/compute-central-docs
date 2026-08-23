---
title: "Ansible YAML Cheat Sheet"
icon: lucide/file-text
description: YAML cheat sheet for Ansible — lists, mappings, block scalars, anchors, and the Norway problem.
tags:
  - Ansible
  - Quick Reference
---

# YAML Cheat Sheet

```yaml
# Mapping
key: value

# List
items:
  - one
  - two

# Nested mapping
web:
  hosts:
    web01:
      ansible_host: 10.0.1.10

# List of mappings
users:
  - { name: deploy, groups: sudo }
  - { name: appuser, groups: docker }

# Literal block scalar — preserves newlines exactly
motd: |
  Line one.
  Line two.

# Folded block scalar — joins lines with spaces
description: >
  This becomes
  one single line.

# Anchor and alias — reuse a block
defaults: &defaults
  retries: 3
  timeout: 30

web_settings:
  <<: *defaults
  port: 80
```

## Quoting and Type Gotchas ("Norway Problem")

| Written | Parses as |
|---|---|
| `yes` / `no` / `on` / `off` | Boolean (not the string!) |
| `NO` (country code, unquoted) | Boolean `false` |
| `123` | Integer |
| `"123"` | String |
| `http://host:80` (unquoted, in some contexts) | Can break on the colon |

Quote any value where the literal string matters: `state: "no"` if you actually mean the string `"no"`.

## Related

[YAML Essentials](../yaml-and-execution-model/01-yaml-essentials.md) · [YAML → Python Mental Model](../yaml-and-execution-model/02-yaml-to-python-mental-model.md)
