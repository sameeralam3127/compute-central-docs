---
icon: lucide/lock
description: Ansible Vault and secrets management — encrypting files and values, vault IDs for multiple trust domains, and integrating an external secret manager instead.
tags:
  - Ansible
  - Production
  - Vault
  - Security
---

# Secrets and Vault

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

Secrets need to exist somewhere — playbook repos, CI systems, control nodes — without being readable by anyone who shouldn't have them. Vault is Ansible's built-in answer; an external secret manager is often the better one for larger teams.

## What It Will Cover

- `ansible-vault create` / `edit` / `encrypt` / `decrypt` / `view` / `rekey`
- `encrypt_string` for encrypting a single value inline in an otherwise-plaintext file
- `--vault-id` for multiple named vault passwords/keys per trust domain (separate prod/staging passwords, so a staging leak can't decrypt production secrets)
- Referencing a vault-encrypted `group_vars` file transparently — no special task syntax needed once the file itself is encrypted
- Integrating an external secret manager (HashiCorp Vault, AWS Secrets Manager) via lookup plugins instead of committing any encrypted value at all — cross-referenced from [Lookup and Filter Plugins](../advanced-execution/04-lookup-and-filter-plugins.md)
- `no_log: true` on any task that handles a decrypted secret, and why default `-vvv` logging can leak it otherwise — full logging hygiene in [Security](04-security.md)

## Common Mistakes

- Passing a secret via `-e` on a CI command line, where it can land in shell history or process listings — see [Security](04-security.md).
- One vault password for every environment, so a staging compromise exposes production secrets too.
- Forgetting `no_log: true` on a task that decrypts and uses a secret, leaking it into readable output.

## Interview Questions

- How does Ansible Vault protect secrets, and what are its limitations compared to an external secret manager?
- Why would a team use multiple `--vault-id`s instead of one shared vault password?

## Full worked example

See [Case Study: Vault Secrets](../case-studies/05-vault-secrets-case-study.md).

## Next

Continue to [Security](04-security.md).
