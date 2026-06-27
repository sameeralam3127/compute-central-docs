---
icon: lucide/puzzle
description: Understand Ansible core concepts including control nodes, managed hosts, modules, tasks, playbooks, inventory, idempotency, and practical automation habits.
tags:
  - Ansible
  - Basics
---

# Ansible Core Concepts Guide

This page covers the few Ansible ideas you should understand before writing playbooks.

## Main Concepts

1. **Inventory**
   The hosts and groups Ansible manages.
2. **Playbooks**
   YAML files that describe the automation workflow.
3. **Modules**
   Built-in actions for tasks such as installing packages, copying files, and managing services.
4. **Roles**
   Reusable playbook structure for larger projects.

## How These Pieces Work Together

The usual flow is simple:

1. Define servers in an inventory.
2. Write a playbook with tasks.
3. Use modules inside those tasks.
4. Move repeated logic into roles as the project grows.

## Practical Starting Point

If you are new to Ansible, start with:

- One inventory file
- One small playbook
- A few built-in modules such as `ping`, `apt`, `copy`, and `service`

## Quick Check

```bash
ansible all -m ping -i inventory.ini
ansible-playbook -i inventory.ini playbook.yml --check
```
