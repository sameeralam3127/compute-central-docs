---
icon: lucide/book-open
description: Volume 2 of the Ansible book series — the CLI, inventory, variables, facts, ansible.cfg, playbook structure, loops and conditionals, error handling, roles, Jinja2 templates, collections, and Galaxy.
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
4. [Facts](04-facts.md) — the `setup` module, `gather_subset`, custom facts, and fact caching
5. [ansible.cfg](05-ansible-cfg.md) — every major setting, search order, and performance-relevant tuning
6. [Playbook Structure and Control Flow](06-playbook-structure-and-control-flow.md) — `hosts`, `tasks`, `pre_tasks`/`post_tasks`, `serial`, `strategy`, `delegate_to`, `run_once`, `include`/`import`
7. [Loops, Conditionals and Handlers](07-loops-conditionals-and-handlers.md) — `loop`, `when`, `handlers`/`notify`, and `tags`
8. [Error Handling: Blocks, Rescue and Always](08-error-handling-blocks-rescue-always.md) — `block`/`rescue`/`always`, `ignore_errors`, `module_defaults`, `environment`
9. [Roles](09-roles.md) — role structure, Galaxy layout, and reusable role architecture
10. [Jinja2 and Templates](10-jinja2-and-templates.md) — the `template` module, expression syntax, filters, and whitespace control
11. [Collections](11-collections.md) — why collections were introduced, namespaces, versioning, dependencies
12. [Galaxy](12-galaxy.md) — publishing, installing, requirements files, semantic versioning, signing

!!! note "Chapters 6–8 were originally one chapter"
    Playbook structure/control-flow, loops/conditionals/handlers, and block-based error handling used to be a single "Playbooks" chapter covering seventeen keywords at once. It's been split three ways so each gets the room it needs.

## What You Will Be Able to Do After This Volume

- Write a production-shaped playbook using roles and collections rather than one giant flat file
- Reason confidently about which of a dozen possible sources set a given variable's final value — including facts
- Render host-specific configuration files with Jinja2 templates instead of hand-editing them per host
- Read and tune `ansible.cfg` instead of copy-pasting a stranger's config
- Handle task failures deliberately with `block`/`rescue`/`always` instead of `ignore_errors`
- Publish and consume content from Ansible Galaxy correctly, with version pins

## Next

Continue to [Volume 3: Core Internals & Python Architecture](../volume-3-core-internals/index.md).
