---
title: "Ansible Variable Precedence Cheat Sheet"
icon: lucide/layers
description: The full Ansible variable precedence order, highest to lowest, as a quick-lookup table and diagram.
tags:
  - Ansible
  - Quick Reference
---

# Variable Precedence Cheat Sheet

```mermaid
flowchart TD
    A["1. Extra vars -e — always wins"] --> B["2. Task vars"]
    B --> C["3. Block vars"]
    C --> D["4. Role and include vars (vars:)"]
    D --> E["5. set_fact / registered vars"]
    E --> F["6. Play vars_files"]
    F --> G["7. Play vars"]
    G --> H["8. host_vars"]
    H --> I["9. group_vars"]
    I --> J["10. Inventory vars"]
    J --> K["11. Facts"]
    K --> L["12. Role defaults — lowest"]
```

| Rank | Source | File / Location |
|---|---|---|
| 1 (highest) | Extra vars | `-e` on the command line |
| 2 | Task vars | `vars:` on a task |
| 3 | Block vars | `vars:` on a block |
| 4 | Role/include vars | `roles/<role>/vars/main.yml` |
| 5 | `set_fact` / registered | Set at runtime |
| 6 | Play `vars_files` | Referenced file |
| 7 | Play vars | `vars:` on a play |
| 8 | `host_vars` | `host_vars/<host>.yml` |
| 9 | `group_vars` | `group_vars/<group>.yml` |
| 10 | Inventory vars | Set inline in the inventory file |
| 11 | Facts | Gathered from the host |
| 12 (lowest) | Role defaults | `roles/<role>/defaults/main.yml` |

**Verify, don't guess:** `ansible-inventory --host <name>` or `ansible-playbook ... -vvv`.

## Related

Full explanation: [Variable Precedence](../variables-and-data/02-variable-precedence.md)
