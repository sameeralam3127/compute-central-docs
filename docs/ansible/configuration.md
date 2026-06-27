---
icon: lucide/settings
description: Configure Ansible with practical ansible.cfg settings, understand configuration precedence, common file locations, useful defaults, and quick validation commands.
tags:
  - Configuration
---

# Ansible Configuration Guide

Ansible configuration controls how commands behave, where inventory is loaded from, and how connections are handled. A project-level `ansible.cfg` is usually the cleanest approach.

## Configuration Precedence

When the same setting appears in multiple places, Ansible generally uses this order:

1. Command-line options
2. Environment variables
3. `ansible.cfg`
4. Built-in defaults

## Common Config File Locations

Ansible looks for configuration in this order:

1. `ANSIBLE_CONFIG`
2. `./ansible.cfg`
3. `~/.ansible.cfg`
4. `/etc/ansible/ansible.cfg`

## Recommended Project Config

Create `ansible.cfg` in the project root so the team shares the same behavior.

Example:

```ini
[defaults]
inventory = inventory.ini
host_key_checking = False
retry_files_enabled = False
```

## Useful Settings

- `inventory`: Default inventory file
- `host_key_checking`: Useful in labs, but review carefully for production
- `retry_files_enabled`: Disables retry file clutter
- `timeout`: Controls SSH timeout behavior

## Quick Check

```bash
ansible-config dump --only-changed
ansible --version
```
