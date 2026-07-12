---
icon: lucide/server
description: Real Ansible production projects — LAMP deployment, Kubernetes bootstrap, Docker installation, patch management, user management, Apache, Nginx, MySQL, PostgreSQL, AWS EC2, Azure VM, VMware, and network automation.
tags:
  - Ansible
  - Volume 6
  - Production
---

# Part 36 — Real Production Projects

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

This closing chapter is where every earlier volume comes together into complete, realistic projects — not toy examples, but the shape of automation real teams run.

## Why This Exists

- Individual keyword/module knowledge doesn't automatically add up to knowing how to structure a real project — this chapter closes that gap with complete, worked examples.

## Problem Statement

- Each project below stands in for a category of real-world automation work, chosen to exercise a distinct combination of concepts from across the series (roles, variables, idempotency, security, performance) rather than being an arbitrary list.

## Projects Covered

- **LAMP deployment**: Linux + Apache + MySQL + PHP as one of the most common "first real playbook" projects — roles for each layer, environment-scoped variables for credentials.
- **Kubernetes bootstrap**: using Ansible to provision the underlying nodes and install `kubeadm`/`containerd` prerequisites before cluster init — Ansible's role *around* Kubernetes rather than inside it (echoes the boundaries drawn in Volume 1, Part 3).
- **Docker installation**: a canonical idempotent package-installation-plus-service-configuration role, good for demonstrating check mode and idempotency concretely.
- **Patch management**: scheduled, batched (`serial`) OS patching across a fleet with pre/post health checks — a strong example of `pre_tasks`/`post_tasks`/`serial` (Volume 2, Part 11) together.
- **User management**: idempotent user/group/SSH-key provisioning across environments — a natural fit for `loop` and structured variable data (Volume 2, Part 9).
- **Apache** and **Nginx**: templated virtual-host configuration using the `template` action plugin (Volume 5, Part 26), with handler-driven reloads.
- **MySQL** and **PostgreSQL**: database provisioning and user/permission management, highlighting `no_log` usage (Part 31) for connection credentials.
- **AWS EC2**, **Azure VM**, **VMware**: provisioning modules and dynamic inventory plugins (Volume 2, Part 8) working together — a full provision-then-configure flow.
- **Network automation**: Ansible's network device modules (a different execution model than Linux/Windows — often connecting via `network_cli`/API rather than shipping Python to the device itself) for switch/router configuration.

## Step-by-Step Explanation

- Each project in the full-content pass will include: the complete role/playbook structure, the actual task YAML, expected `ansible-playbook` output, and notes on what from earlier volumes it's demonstrating.

## Production Best Practices

- Every project follows the repository layout and conventions from Part 35 — environment-scoped inventory, focused roles, Vault-protected secrets, CI-gated.

## Common Mistakes

- Treating these as copy-paste templates rather than patterns to adapt — real infrastructure details (network topology, compliance requirements, existing tooling) always require adjustment.

## Performance Considerations

- Patch management and multi-cloud provisioning are the two projects here most sensitive to the Part 32 performance levers (`serial` batching, forks, async for long-running provisioning calls).

## Security Considerations

- Database and cloud-provisioning projects are the two most credential-heavy examples here — deliberately used to reinforce Part 31's Vault/`no_log`/least-privilege practices in a concrete setting.

## Interview Questions

- "Walk through how you'd structure a playbook to deploy a LAMP stack."
- "How would you use Ansible alongside Terraform to provision and configure a cloud VM?"
- "What's different about automating network devices compared to Linux servers?"

## Hands-On Lab

- Build the Docker-installation project end to end: a role with `defaults/main.yml`, an idempotent install task, a templated daemon config, and a handler that restarts the service only when the config actually changes — then run it twice to confirm the second run reports no changes.

## Summary

- These projects are the series' capstone: each one exercises a specific combination of inventory, variables, roles, idempotency, security, and performance practices from every earlier volume, applied to infrastructure that looks like what real teams actually run.

## Series Complete

This is the final chapter of the Ansible book series. Return to the [series overview](../index.md) to revisit any volume, or the [Volume 6 index](index.md) for this volume's full chapter list.
