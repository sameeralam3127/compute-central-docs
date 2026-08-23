---
title: "Ansible CLI Cheat Sheet (ansible-playbook, ansible-vault)"
icon: lucide/terminal
description: Ansible CLI cheat sheet — ansible, ansible-playbook, ansible-doc, ansible-vault, ansible-galaxy, ansible-inventory, and the flags used constantly.
tags:
  - Ansible
  - Quick Reference
---

# CLI Cheat Sheet

## `ansible` (ad-hoc)

```bash
ansible <pattern> -m <module> -a "<args>"
ansible web -m ping
ansible web -m command -a "uptime"
ansible web -m package -a "name=nginx state=present" -b
```

## `ansible-playbook`

| Flag | Purpose |
|---|---|
| `--check` | Dry run — no changes made |
| `--diff` | Show before/after content diffs |
| `--limit <pattern>` | Restrict to a host subset |
| `--tags <tags>` / `--skip-tags <tags>` | Run/skip a subset of tagged tasks |
| `--start-at-task "<name>"` | Resume from a specific task |
| `-e "<var=val>"` / `-e @file.yml` | Extra vars — highest precedence |
| `--syntax-check` | Validate structure only, no connection |
| `--list-tasks` / `--list-hosts` / `--list-tags` | Inspect without running |
| `-f N` / `--forks N` | Parallelism ceiling |
| `-vvv` / `-vvvv` | Verbose / very verbose (shows raw SSH commands) |
| `-b` / `--become` | Escalate privilege |
| `-K` / `--ask-become-pass` | Prompt for the become password |

## `ansible-doc`

```bash
ansible-doc -l                # list all modules
ansible-doc ansible.builtin.copy    # full docs for one module
ansible-doc -s ansible.builtin.copy  # just a YAML snippet
```

## `ansible-vault`

```bash
ansible-vault create secrets.yml
ansible-vault edit secrets.yml
ansible-vault encrypt secrets.yml
ansible-vault decrypt secrets.yml
ansible-vault view secrets.yml
ansible-vault encrypt_string 'secretvalue' --name 'db_password'
ansible-vault rekey secrets.yml
```

## `ansible-galaxy`

```bash
ansible-galaxy role init myrole
ansible-galaxy collection init my_namespace.my_collection
ansible-galaxy collection install -r requirements.yml
ansible-galaxy collection build
ansible-galaxy collection publish my_namespace-my_collection-1.0.0.tar.gz
```

## `ansible-inventory`

```bash
ansible-inventory --graph
ansible-inventory --host web01
ansible-inventory --list
```

## `ansible-config`

```bash
ansible-config dump --only-changed
ansible-config view
```

## ansible-dev-tools

```bash
adt --version                                   # show every bundled tool's version
ansible-creator init collection ns.name
ade install -e .[test] --venv .venv             # editable local collection install
ansible-navigator run site.yml --mode stdout
ansible-sign project gpg-sign .
ansible-sign project gpg-verify .
```

Full explanation: [ansible-dev-tools](../production-engineering/08-ansible-dev-tools.md)

## Related

[Troubleshooting](../troubleshooting/index.md) · [ansible.cfg Cheat Sheet](04-ansible-cfg-cheat-sheet.md)
