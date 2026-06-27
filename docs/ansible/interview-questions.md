---
description: Prepare for Ansible interviews with concise practical answers about inventory, playbooks, roles, idempotency, variables, facts, handlers, and automation workflows.
---

# Ansible Interview Questions for Automation Engineers

This page helps you prepare short, practical answers for Ansible interviews.

## How to Answer Well

Give:

1. A simple definition
2. A practical use case
3. One best practice or limitation

## Core Questions

### What is Ansible?

Ansible is an automation tool used for configuration management, application deployment, and operational tasks. It is popular because it is agentless for most Linux environments and uses readable YAML playbooks.

### What does agentless mean in Ansible?

It means Ansible usually connects over SSH instead of requiring a permanent agent on each target host. That keeps setup simpler in many environments.

### What is an inventory?

An inventory is the list of hosts and groups Ansible manages. It can be static, such as an `.ini` file, or dynamic from cloud or platform sources.

### What is a playbook?

A playbook is a YAML file that defines the tasks Ansible should run on one or more hosts.

### What are modules?

Modules are the units of work Ansible executes, such as installing packages, copying files, or managing services.

### What are roles?

Roles are a structured way to organize reusable automation. They help separate tasks, variables, templates, handlers, and defaults for larger projects.

### How are variables used in Ansible?

Variables make playbooks flexible. They help teams reuse the same logic across environments without hardcoding values into every task.

### What are facts in Ansible?

Facts are details Ansible gathers about a host before running tasks, such as OS family, interfaces, CPU, or memory. They are useful for conditional logic.

### When would you use Ansible instead of Terraform?

Use Ansible when the main job is configuring hosts or running tasks on existing systems. Use Terraform when the main job is provisioning infrastructure resources.

## Quick Revision Topics

- Inventory
- Playbooks
- Modules
- Roles
- Variables
- Facts
- `ansible.cfg`
- SSH connectivity
- Idempotency
