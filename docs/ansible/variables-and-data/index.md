---
title: "Ansible Variables and Data Sources"
icon: lucide/database
description: Every Ansible variable source and how they combine — types, sources, precedence, facts, registered variables, magic variables, and set_fact/combine.
tags:
  - Ansible
  - Variables
---

# Variables & Data

"Why isn't my variable taking effect?" is the most common Ansible support question there is. This section is the complete, definitive answer — starting broad, then narrowing to the exact precedence order.

## Read in this order

1. [Variable Types and Sources](01-variable-types-and-sources.md)
2. [Variable Precedence](02-variable-precedence.md) — the definitive order, highest to lowest
3. [Facts](03-facts.md)
4. [Registered Variables](04-registered-variables.md)
5. [Magic Variables and Hostvars](05-magic-variables-and-hostvars.md)
6. [set_fact and combine](06-set-fact-and-combine.md)

## Related

- [Variable Precedence Cheat Sheet](../quick-reference/03-variable-precedence-cheat-sheet.md) — the pyramid, no prose
- [Jinja2 & Templates](../jinja2-and-templates/index.md) — what you do with a variable once you have it

## Next

Continue to [Jinja2 & Templates](../jinja2-and-templates/index.md).
