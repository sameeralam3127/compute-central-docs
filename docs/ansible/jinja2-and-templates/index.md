---
icon: lucide/braces
description: Jinja2 in Ansible — expressions, filters, tests, and generating real config files with the template module.
tags:
  - Ansible
  - Jinja2
---

# Jinja2 & Templates

Every `{{ }}` in a playbook is Jinja2, not YAML. This section covers the templating language itself and its main production use — generating real config files from a single template plus per-environment variables.

## Read in this order

1. [Jinja2 Basics](01-jinja2-basics.md) — expressions, string interpolation, and where templating actually runs
2. [Filters and Tests](02-filters-and-tests.md) — `| default`, `| join`, `is defined`, and the rest
3. [Templates for Config Generation](03-templates-for-config-generation.md) — the `template` module, `.j2` files, loops and conditionals inside a template
4. [Advanced Jinja2](04-advanced-jinja2.md) — macros, whitespace control, custom filters

## Next

Continue to [Modules](../modules/index.md).
