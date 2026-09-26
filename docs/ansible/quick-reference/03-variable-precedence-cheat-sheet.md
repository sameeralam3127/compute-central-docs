---
title: "Ansible Variable Precedence Cheat Sheet"
icon: lucide/layers
description: "Ansible variable precedence as a lookup table, all 22 levels from highest to lowest: extra vars beat everything, role defaults lose, and every level in between."
tags:
  - Ansible
  - Quick Reference
---

# Variable Precedence Cheat Sheet

Highest at the top. This is the full documented order.

| Rank | Source | File / Location |
|---|---|---|
| 1 (highest) | Extra vars | `-e key=value` / `-e @file.yml` |
| 2 | Include params | `vars:` on `include_tasks` / `include_role` |
| 3 | Role params | `vars:` on a role under `roles:` or `import_role` |
| 4 | `set_fact` / registered vars | Set at run time |
| 5 | `include_vars` | Loaded at run time |
| 6 | Task vars | `vars:` on a task |
| 7 | Block vars | `vars:` on a block |
| 8 | Role vars | `roles/<role>/vars/main.yml` |
| 9 | Play `vars_files` | Files listed on the play |
| 10 | Play `vars_prompt` | Prompted at start |
| 11 | Play vars | `vars:` on a play |
| 12 | Facts / cached `set_fact` | Gathered from the host |
| 13 | Playbook `host_vars/*` | Next to the playbook |
| 14 | Inventory `host_vars/*` | Next to the inventory |
| 15 | Inventory file host vars | Inline on the host line |
| 16 | Playbook `group_vars/*` | Next to the playbook |
| 17 | Inventory `group_vars/*` | Next to the inventory |
| 18 | Playbook `group_vars/all` | Next to the playbook |
| 19 | Inventory `group_vars/all` | Next to the inventory |
| 20 | Inventory file group vars | `[group:vars]` |
| 21 | Role defaults | `roles/<role>/defaults/main.yml` |
| 22 (lowest) | Command-line options (not variables) | `-u`, `--private-key` |

**Four rules:** `-e` always wins · run-time values (`set_fact`, `register`, `include_vars`) beat file-based vars except role/include params · host beats group beats `all` · role `vars/` beats inventory, role `defaults/` loses to everything.

**Verify, don't guess:** `ansible-inventory --host <name>` for inventory-side values; a `debug: var=<name>` task for what a task actually sees.

## Related

Full explanation: [Variable Precedence](../variables-and-data/02-variable-precedence.md)
