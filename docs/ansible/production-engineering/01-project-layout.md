---
title: "Ansible Project Directory Structure Best Practices"
icon: lucide/folder-kanban
description: A recommended production Ansible repository layout — inventories per environment, group_vars/host_vars, roles, collections, and where secrets and tests belong.
tags:
  - Ansible
  - Production
  - Project Layout
---

# Project Layout

## What You'll Learn

- A production-grade repository structure, and why each piece is separated the way it is
- How environments (dev/staging/prod) stay isolated from each other by structure, not discipline alone

## The Layout

```text
ansible-project/
├── ansible.cfg
├── requirements.yml          # pinned collection dependencies
├── requirements.txt          # pinned Python dependencies (ansible-core, etc.)
├── inventories/
│   ├── dev/
│   │   ├── hosts.ini
│   │   └── group_vars/
│   ├── staging/
│   │   ├── hosts.ini
│   │   └── group_vars/
│   └── production/
│       ├── hosts.ini
│       └── group_vars/
├── group_vars/                # cross-environment defaults, if any
├── host_vars/
├── playbooks/
│   ├── site.yml
│   └── deploy.yml
├── roles/
│   └── nginx/
├── collections/                 # locally installed, gitignored
├── library/                      # project-local custom modules
├── plugins/
│   └── filter_plugins/
├── templates/                     # only if not scoped inside a role
├── files/
├── molecule/                       # role-level test scenarios
├── README.md
└── .ansible-lint
```

## Why Environments Are Separate Directories, Not Just Variables

```text
inventories/
├── dev/hosts.ini
├── staging/hosts.ini
└── production/hosts.ini
```

```bash
ansible-playbook -i inventories/production/hosts.ini playbooks/deploy.yml
```

Separate inventory directories per environment mean a mistyped `--limit` or a missing `-i` flag **cannot** accidentally reach production — the wrong inventory simply doesn't contain those hosts. A single shared inventory with an `env` variable to distinguish dev from prod puts that same safety burden on every engineer remembering to pass the right flag correctly, every time.

## What Belongs Where

| Directory | Contents |
|---|---|
| `inventories/<env>/` | That environment's hosts and `group_vars`/`host_vars` |
| `roles/` | Reusable, testable units — see [Roles](../roles/index.md) |
| `collections/` | Installed dependencies, pinned via `requirements.yml` — gitignored, reinstalled by CI |
| `library/` | Project-local custom modules not yet worth packaging as a collection |
| `molecule/` | Per-role test scenarios — see [Molecule Testing](07-molecule-testing.md) |
| `playbooks/` | Entry points — `site.yml`, `deploy.yml` — kept thin, composed of roles |

## Common Mistakes

- One shared inventory file with an `env:` variable instead of separate `inventories/<env>/` directories — a single flag mistake can then target the wrong environment.
- Committing `collections/` to version control instead of `requirements.yml` — bloats the repo and drifts from what CI actually installs.
- Playbooks that are hundreds of lines of raw tasks instead of thin entry points composed of roles.

## Interview Questions

- Why structure inventories as separate directories per environment instead of one inventory with an environment variable?
- What belongs in `library/` versus a proper collection, and when do you graduate from one to the other?

## Next

Continue to [ansible.cfg](02-ansible-cfg.md).
