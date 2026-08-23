---
icon: lucide/folder-tree
description: Ansible roles — why they exist, the standard directory structure, and how to design roles that stay reusable across projects.
tags:
  - Ansible
  - Roles
---

# Roles

## What You'll Learn

- Why roles exist, and what breaks without them
- The standard role directory structure, and what each part is for
- The line between a role and "just splitting a playbook into files"

## Why Roles Exist

Without roles, teams end up copy-pasting the same task blocks (install nginx, configure firewall rules, create app users) across every playbook that needs them. A role packages that logic — tasks, handlers, default variables, templates, files, and metadata — into one reusable unit that can be dropped into a different project unmodified.

A role is the unit of **reuse and distribution**. Splitting one long playbook into multiple files with `include_tasks`/`import_tasks` is a different, smaller problem — see [Module Decision Trees: Role vs. Task Include](../modules/02-module-decision-trees.md#role-vs-task-include) for exactly where that line is.

## Read in this order

1. [Role Structure](01-role-structure.md) — the standard directory layout, and what auto-wires without any extra config
2. [Role Variables and Interfaces](02-role-variables-and-interfaces.md) — designing a role's public "API" via `defaults/`
3. [Production Role Design](03-production-role-design.md) — single-responsibility roles, testing, dependency management

## Next

Continue to [Collections](../collections/index.md) — the mechanism for packaging and distributing roles (and modules, and plugins) together.
