---
icon: lucide/server
description: Learn Ansible inventory basics with static host groups, common inventory commands, Python interpreter overrides, and practical validation checks.
tags:
  - Inventory
---

# Ansible Inventory Guide

Inventory tells Ansible which hosts to manage and how to group them. A clean inventory makes playbooks easier to reuse.

## Static Inventory Example

```ini
[webservers]
192.168.1.10
192.168.1.11

[databases]
db1.example.com
```

## Common Inventory Tasks

List the hosts Ansible sees:

```bash
ansible all --list-hosts -i inventory.ini
```

Ping all hosts:

```bash
ansible all -m ping -i inventory.ini
```

## Python Interpreter Override

This is useful when a server uses Python 3 in a non-default path.

```ini
[webservers]
192.168.1.10 ansible_python_interpreter=/usr/bin/python3
```

## Practical Advice

- Group hosts by role, not by random naming
- Keep inventory readable and predictable
- Use host variables only when a setting truly differs for one machine

## Quick Check

```bash
ansible-inventory -i inventory.ini --graph
```
