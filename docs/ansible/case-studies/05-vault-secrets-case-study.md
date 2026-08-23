---
icon: lucide/lock-keyhole
description: A secrets management case study — encrypting a database password with Ansible Vault, multiple vault IDs, and a CI pipeline that never sees the plaintext.
tags:
  - Ansible
  - Case Studies
  - Vault
---

# Case Study: Vault Secrets

!!! info "Section status: outline"
    This case study is scoped but not yet written in full prose. The sections below define what it will cover.

## Problem

A database password needs to reach a production playbook without ever existing in plaintext in the repository, in shell history, or in CI logs.

## What It Will Cover

- `ansible-vault encrypt_string` to produce a single encrypted value inline in an otherwise-plaintext `group_vars/production.yml`
- Separate `--vault-id prod@prompt` vs. `--vault-id staging@prompt` so a staging vault-password leak can't decrypt production secrets
- CI configuration: the vault password itself sourced from the CI system's own secret store, never committed, referenced via `--vault-password-file` pointing at a runtime-generated file
- `no_log: true` on the task that consumes the decrypted value, and confirming with `-vvv` that the secret never appears in output even at high verbosity

## Interview Questions

- How would you structure vault passwords so a staging compromise can't expose production secrets?
- Where does the vault password itself live in a CI pipeline, if it can't be committed?

## Next

Continue to [Dynamic Inventory Case Study](06-dynamic-inventory-case-study.md).
