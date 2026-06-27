---
icon: lucide/info
description: Use Ansible facts and verbosity flags to inspect managed hosts, debug playbook behavior, validate gathered data, and troubleshoot automation runs.
tags:
  - Facts
  - Debugging
---

# Ansible Facts and Verbosity Guide

Facts help Ansible learn details about a host before running tasks. Verbosity helps you understand what Ansible is doing when something fails.

## Gather Facts

```bash
ansible all -m setup
ansible all -m setup -a "filter=ansible_python_version"
```

## Why Facts Matter

Facts are often used to:

- Detect operating system family
- Choose the right package manager
- Read IP addresses, memory, and CPU details
- Build conditional logic in playbooks

## Verbosity Levels

- `-v`: Basic extra output
- `-vv`: More task and connection detail
- `-vvv`: Deep debugging, including SSH and module behavior

## Practical Tip

Use normal output first, then increase to `-vv` or `-vvv` only when needed. That keeps routine runs readable.

## Quick Check

```bash
ansible all -m setup -a "filter=ansible_distribution*"
ansible-playbook -i inventory.ini playbook.yml -vv
```
