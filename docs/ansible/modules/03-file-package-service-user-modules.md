---
icon: lucide/boxes
description: The core file, package, service, and user management modules — package, file, stat, lineinfile, blockinfile, user, group, authorized_key, cron, mount.
tags:
  - Ansible
  - Modules
---

# File, Package, Service, and User Modules

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

These modules cover the large majority of what a typical configuration-management playbook does day to day — this page is the category reference, one level below [Command vs. Shell](01-command-vs-shell-vs-raw-vs-script.md) and [Module Decision Trees](02-module-decision-trees.md).

## What It Will Cover

For each module below: purpose, common parameters, idempotency behavior, check-mode support, and a minimal + production example.

- **Package management**: `ansible.builtin.package` (cross-distro), `apt`, `dnf`/`yum` (distro-specific, more parameters available)
- **Service management**: `ansible.builtin.service` (cross-init-system), `systemd_service` (systemd-specific features like `daemon_reload`)
- **Files and directories**: `file` (permissions, symlinks, directories), `stat` (read-only inspection, pairs with `register` + `when`), `copy`, `template` (see [Templates for Config Generation](../jinja2-and-templates/03-templates-for-config-generation.md))
- **Partial file edits**: `lineinfile` (single line), `blockinfile` (marked block), `replace` (regex substitution) — and when `template` is the better choice instead, per [Module Decision Trees](02-module-decision-trees.md)
- **Users and access**: `user`, `group`, `authorized_key` (SSH key management — ties to [SSH and Connectivity](../getting-started/05-ssh-and-connectivity.md))
- **Scheduling**: `cron`
- **Mounts**: `mount`
- **Archives and downloads**: `get_url`, `unarchive`
- **Source control**: `git`

## Interview Questions

- When would you choose `apt`/`dnf` directly instead of the cross-distro `package` module?
- What's the difference between `lineinfile` and `blockinfile`?
- Why is `stat` commonly paired with `register` and `when` instead of used alone?

## Next

Continue to [URI and API Automation](04-uri-and-api-automation.md).
