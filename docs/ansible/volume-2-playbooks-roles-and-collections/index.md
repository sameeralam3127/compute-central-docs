---
icon: lucide/book-open
description: Volume 2 of the Ansible book series — the CLI, inventory, variables, ansible.cfg, playbooks, roles, collections, and Galaxy. The day-to-day working surface of Ansible.
tags:
  - Ansible
  - Volume 2
---

# Volume 2: Playbooks, Roles & Collections

!!! info "Volume status"
    This volume is at the outline stage. Each chapter below has its structure and scope defined; full prose is being written chapter by chapter after Volume 1.

## Who This Volume Is For

Readers who understand *why* Ansible exists (Volume 1) and now need to actually build and organize real automation: inventories, variables, playbooks, reusable roles, and shareable collections.

## Prerequisites

[Volume 1: Fundamentals & History](../volume-1-fundamentals-and-history/index.md) — particularly the declarative/idempotency mental model and a working Ansible install.

## Chapters

1. [CLI Deep Dive](01-cli-deep-dive.md) — `ansible`, `ansible-playbook`, `ansible-config`, `ansible-doc`, `ansible-console`, `ansible-galaxy`, `ansible-vault`
2. [Inventory](02-inventory.md) — static and dynamic inventory, INI and YAML formats, cloud inventory plugins, groups and patterns
3. [Variables and Precedence](03-variables-and-precedence.md) — every variable source and the full precedence order, visualized
4. [ansible.cfg](04-ansible-cfg.md) — every major setting, search order, and performance-relevant tuning
5. [Playbooks](05-playbooks.md) — every keyword: tasks, handlers, blocks, loops, conditionals, strategy, delegation, tags
6. [Roles](06-roles.md) — role structure, Galaxy layout, and reusable role architecture
7. [Collections](07-collections.md) — why collections were introduced, namespaces, versioning, dependencies
8. [Galaxy](08-galaxy.md) — publishing, installing, requirements files, semantic versioning, signing

## What You Will Be Able to Do After This Volume

- Write a production-shaped playbook using roles and collections rather than one giant flat file
- Reason confidently about which of a dozen possible sources set a given variable's final value
- Read and tune `ansible.cfg` instead of copy-pasting a stranger's config
- Publish and consume content from Ansible Galaxy correctly, with version pins

## Next

Continue to [Volume 3: Core Internals & Python Architecture](../volume-3-core-internals/index.md).
