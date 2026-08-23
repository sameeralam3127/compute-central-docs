---
title: "Ansible Linux Server Hardening Playbook"
icon: lucide/shield-check
description: A Linux server hardening case study — SSH lockdown, firewall rules, unattended upgrades, and fail2ban, applied idempotently across a fleet.
tags:
  - Ansible
  - Case Studies
  - Security
---

# Case Study: Linux Server Hardening

!!! info "Section status: outline"
    This case study is scoped but not yet written in full prose. The sections below define what it will cover.

## Problem

A fresh fleet of servers needs a consistent security baseline applied before anything else touches them — SSH lockdown, a default-deny firewall, automatic security updates, and brute-force protection.

## What It Will Cover

- Disabling password SSH auth and root login (`PasswordAuthentication no`, `PermitRootLogin no`) via `lineinfile` on `sshd_config`, with a handler to reload `sshd` — and the specific risk of locking yourself out if key-based auth isn't verified *first*
- A default-deny `ufw`/`firewalld` baseline, opening only the ports a role's own defaults declare it needs
- `unattended-upgrades` (Debian family) / `dnf-automatic` (RHEL family) for automatic security patching
- `fail2ban` for SSH brute-force protection
- A full [Security](../production-engineering/04-security.md)-aligned checklist as the playbook's own `assert` preflight

## Interview Questions

- What's the safe order of operations for hardening SSH remotely, without risking a lockout?
- How would you verify a hardening playbook actually achieved its intended state, not just that tasks reported `ok`?

## Next

Continue to [User and SSH Access](04-user-and-ssh-access.md).
