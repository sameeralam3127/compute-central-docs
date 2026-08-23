---
icon: lucide/factory
description: Designing Ansible roles for production — single responsibility, testing with Molecule, and versioning roles that other teams depend on.
tags:
  - Ansible
  - Roles
  - Production
---

# Production Role Design

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

A role that works once, on one project, is different from a role other teams can depend on for years — this page is about the latter.

## What It Will Cover

- Single-responsibility roles (a `nginx` role shouldn't also manage the database) and composing several focused roles instead of one monolith
- Testing roles in isolation with **Molecule** — previewed here, covered fully in [Molecule Testing](../production-engineering/07-molecule-testing.md)
- Auditing third-party roles pulled from Galaxy before running them with `become: true` — a role has the same access as any other task; see [Security](../production-engineering/04-security.md)
- Semantic versioning a role that other teams/projects depend on, and pinning consumers to a specific version via `requirements.yml`
- Idempotency and check-mode discipline at the role level, not just per-task

## Common Mistakes

- Running an unaudited third-party role with `become: true` in production without reading what it actually does.
- No version pinning on role dependencies, so a role update silently breaks every consumer at once.

## Interview Questions

- What would you check before running a third-party Galaxy role with elevated privileges in production?
- How do you test a role in isolation before it's consumed by a real playbook?

## Next

Continue to [Collections](../collections/index.md).
