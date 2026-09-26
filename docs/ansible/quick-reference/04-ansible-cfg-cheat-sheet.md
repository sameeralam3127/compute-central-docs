---
title: "ansible.cfg Cheat Sheet"
icon: lucide/settings
description: "ansible.cfg cheat sheet: the search order Ansible uses to find the file, and the settings that matter most in production — forks, pipelining, and become."
tags:
  - Ansible
  - Quick Reference
---

# ansible.cfg Cheat Sheet

## Search Order (Highest to Lowest)

1. `ANSIBLE_CONFIG` env var
2. `./ansible.cfg`
3. `~/.ansible.cfg`
4. `/etc/ansible/ansible.cfg`

CLI flag > environment variable (`ANSIBLE_*`) > `ansible.cfg` value > built-in default.

## A Practical Starting Point

```ini
[defaults]
inventory = inventories/dev          ; safe default; pass production with -i
remote_user = deploy
forks = 20
interpreter_python = auto_silent
callback_result_format = yaml
host_key_checking = True
force_handlers = True
retry_files_enabled = False

[ssh_connection]
pipelining = True
ssh_args = -o ControlMaster=auto -o ControlPersist=60s -o StrictHostKeyChecking=accept-new
control_path_dir = ~/.ansible/cp

[privilege_escalation]
become_method = sudo                 ; opt in per play/task with become: true
```

```bash
ansible-config dump --only-changed   # see what's actually in effect
```

## Related

Full explanation: [ansible.cfg](../production-engineering/02-ansible-cfg.md) · [Performance](../production-engineering/05-performance.md)
