---
icon: lucide/book-open
description: Learn Ansible automation basics, inventory, playbooks, roles, configuration, variables, facts, and practical workflows for server and infrastructure management.
tags:
  - Ansible
  - Overview
---

# Ansible Automation Overview

Ansible is an automation tool for configuring servers, deploying applications, and running repeatable operational tasks. It is a good fit when you want simple, readable automation without installing agents on every Linux host.

## What Ansible Is Good For

- Provisioning packages and services
- Managing configuration files
- Running application deployments
- Standardizing repeated operational work

## Why Teams Like It

- Agentless for most Linux environments
- Uses SSH for remote access
- Stores automation in YAML playbooks
- Easy to read during reviews and troubleshooting

## Key Building Blocks

- **Inventory**: The list of hosts and groups you manage
- **Playbooks**: YAML files that define tasks
- **Modules**: Reusable units of work such as `apt`, `copy`, and `service`
- **Roles**: A structured way to organize reusable automation

## When to Use Ansible vs Terraform

Use Ansible when the main job is configuring systems or running tasks on existing machines.

Use Terraform when the main job is creating infrastructure such as VPCs, subnets, load balancers, or cloud instances.

Many teams use both:

- Terraform creates infrastructure
- Ansible configures what runs on it

## What Came Before Ansible

Before Ansible became common, teams often relied on:

- Shell scripts
- Python scripts
- Manual SSH sessions
- Agent-based tools such as Puppet and Chef

Ansible became popular because it reduced complexity while still supporting real production work.

## Quick Check

```bash
ansible --version
ansible all -m ping -i inventory.ini
```

## FAQ

### What is Ansible used for?

Ansible is used for configuration management, application deployment, server setup, repeatable operations, and simple automation over SSH.

### Is Ansible agentless?

Yes for most Linux workflows. Ansible usually connects over SSH from a control node and runs modules on managed hosts without requiring a permanent agent.

### What is the difference between a playbook and a role?

A playbook defines automation steps for hosts. A role organizes tasks, variables, handlers, templates, and files into a reusable structure.

### Should I use Ansible or Terraform?

Use [Terraform](../terraform/overview.md) to create infrastructure. Use Ansible to configure systems and run operational tasks after the infrastructure exists.

## Related Learning

- [Ansible playbooks](playbooks.md)
- [Ansible inventory](inventory.md)
- [Ansible roles](roles.md)
- [Shell scripting for SRE and DevOps automation](../shell-scripts/scripts.md)

## Next Steps

- Review [Ansible core concepts](basics.md)
- Practice with [Ansible interview questions](interview-questions.md)
