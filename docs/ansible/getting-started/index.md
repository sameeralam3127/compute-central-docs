---
title: "Ansible Tutorial: Getting Started Guide"
icon: lucide/rocket
description: Start here — what Ansible is, how it connects to machines, how to install it, and how to run your first ad-hoc command and playbook.
tags:
  - Ansible
  - Getting Started
---

# Getting Started

Everything you need before you write your first real playbook: what Ansible actually is, how it talks to a machine, how to install it, and how to get from a blank terminal to a working SSH connection and a passing playbook run.

If you already know Ansible and want a specific answer, use [Quick Reference](../quick-reference/index.md) or [Troubleshooting](../troubleshooting/index.md) instead — this section is for building the mental model once, in order.

## Read in this order

0. [History and Why Ansible Exists](00-history-and-why-ansible.md) — the pain it was built to solve, who built it, and why it's designed the way it is
1. [What Is Ansible?](01-what-is-ansible.md) — a precise definition, and where it sits next to Terraform and Kubernetes
2. [Architecture and Execution](02-architecture-and-execution.md) — agentless, push-based, SSH + Python — how a command actually reaches a machine
3. [Control Node vs. Managed Nodes](03-control-node-vs-managed-nodes.md) — which machine needs what installed
4. [Installing Ansible](04-installing-ansible.md) — pipx, package managers, virtualenv, per OS
5. [SSH and Connectivity](05-ssh-and-connectivity.md) — the single biggest source of first-week failures, covered end to end
6. [Your First Playbook](06-your-first-playbook.md) — `ping` → an ad-hoc command → a real playbook, with real output

!!! tip "If you're impatient"
    You can skip straight to [Your First Playbook](06-your-first-playbook.md) and come back for the "why" later — it's self-contained as long as you already have SSH access to a Linux machine.

## Next

Once you have a working connection and a playbook that runs cleanly, continue to [Core Concepts](../core-concepts/index.md).
