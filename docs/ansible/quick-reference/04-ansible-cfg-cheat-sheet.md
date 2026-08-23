---
icon: lucide/settings
description: ansible.cfg quick reference — search order and the settings that matter most in production.
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
inventory = inventories/production/hosts.ini
remote_user = deploy
host_key_checking = True
forks = 20
retry_files_enabled = False

[ssh_connection]
pipelining = True
ssh_args = -o ControlMaster=auto -o ControlPersist=60s

[privilege_escalation]
become = True
become_method = sudo
```

```bash
ansible-config dump --only-changed   # see what's actually in effect
```

## Related

Full explanation: [ansible.cfg](../production-engineering/02-ansible-cfg.md) · [Performance](../production-engineering/05-performance.md)
