---
title: "Ansible Core Concepts: Inventory, Modules, Variables"
icon: lucide/layers
description: The vocabulary and daily-driver skills behind every Ansible playbook — inventory, ad-hoc commands, playbooks/plays/tasks, modules, variables, conditionals, loops, handlers, tags, check mode, and idempotency.
tags:
  - Ansible
  - Core Concepts
---

# Core Concepts

The surface area you use every day. If [Getting Started](../getting-started/index.md) got you a working connection and one passing playbook, this section is where that playbook's every line stops being magic.

## Read in this order

1. [Inventory](01-inventory.md) — which hosts, grouped how
2. [Ad-Hoc Commands](02-ad-hoc-commands.md) — one module, no file, run right now
3. [Playbooks, Plays, and Tasks](03-playbooks-plays-tasks.md) — the structure everything else builds on
4. [Modules](04-modules.md) — the actual unit of work, and its idempotent contract
5. [Variables (Overview)](05-variables-overview.md) — where values come from, with a map to the deep-dive section
6. [Conditionals](06-conditionals.md) — `when:`
7. [Loops](07-loops.md) — `loop:`
8. [Handlers](08-handlers.md) — `notify:` and "restart, but only if something changed"
9. [Tags](09-tags.md) — running part of a playbook on purpose
10. [Check Mode and Diff Mode](10-check-mode-and-diff-mode.md) — `--check` / `--diff`
11. [Idempotency](11-idempotency.md) — the mental model everything above is in service of

## Or jump straight to a reference

- [Command vs. Shell vs. Raw vs. Script](../modules/01-command-vs-shell-vs-raw-vs-script.md)
- [Variable Precedence](../variables-and-data/02-variable-precedence.md)
- [Quick Reference: CLI Cheat Sheet](../quick-reference/01-cli-cheat-sheet.md)

## Next

Once these are solid, continue to [Variables & Data](../variables-and-data/index.md) or [Modules](../modules/index.md), depending on what you need next.
