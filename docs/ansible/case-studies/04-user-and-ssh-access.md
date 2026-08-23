---
title: "Ansible User and SSH Key Management Example"
icon: lucide/users
description: A user and SSH access case study — creating accounts, managing authorized_keys per team, and revoking access cleanly.
tags:
  - Ansible
  - Case Studies
  - SSH
---

# Case Study: User and SSH Access

!!! info "Section status: outline"
    This case study is scoped but not yet written in full prose. The sections below define what it will cover.

## Problem

A team of engineers needs individual, auditable SSH access to a fleet of servers — no shared accounts, no shared keys — and offboarding someone should be a one-line inventory change, not a manual per-server cleanup.

## What It Will Cover

- `ansible.builtin.user`/`group` for per-engineer accounts, looped over a `team_members` variable
- `ansible.builtin.authorized_key` per user, sourced from individually named public key files (`files/keys/<username>.pub`)
- Revoking access: removing an entry from `team_members` and re-running the playbook to remove both the account and its key — the idempotent teardown case, not just the idempotent setup case
- `sudoers.d` per-user drop-in files instead of one shared sudoers block, for auditable least-privilege `become`

## Interview Questions

- How would you design this playbook so revoking one engineer's access is a single, safe re-run?
- Why individual accounts and keys instead of one shared "deploy" account for a whole team?

## Next

Continue to [Vault Secrets Case Study](05-vault-secrets-case-study.md).
