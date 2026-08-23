---
title: "Ansible CI/CD with ansible-lint and yamllint"
icon: lucide/git-merge
description: Running Ansible safely in CI/CD — ansible-lint, yamllint, --check/--diff gates, and pinned collection/role dependencies.
tags:
  - Ansible
  - Production
  - CI/CD
---

# CI/CD and Linting

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

A playbook that only gets reviewed by a human reading YAML misses a class of mistakes a linter catches in seconds — and a playbook that's never dry-run in CI before a real apply is a production incident waiting for a busy afternoon.

`ansible-lint` and `tox-ansible` (for matrix testing across Python/`ansible-core` versions) both ship together in [ansible-dev-tools](08-ansible-dev-tools.md), so a single install covers most of what this page describes.

## What It Will Cover

- `ansible-lint` — rule-based playbook/role linting (FQCN usage, `command`/`shell` overuse, missing `name:` on tasks, deprecated syntax)
- `yamllint` for structural YAML issues underneath `ansible-lint`'s Ansible-specific rules
- A CI pipeline stage sequence: `yamllint` → `ansible-lint` → `ansible-playbook --syntax-check` → `ansible-playbook --check --diff` against a real (non-production) inventory → human review → apply
- Pinning `requirements.yml`/`requirements.txt` in CI so a run is reproducible, not dependent on whatever happens to resolve that day
- A minimal GitHub Actions example running lint + `--check` on every pull request

## Common Mistakes

- Running `ansible-lint` locally but not enforcing it in CI, so violations creep back in.
- No `--check --diff` gate before merge, catching logic errors only when they hit a real environment.
- CI installing unpinned collections, so a run that passed yesterday fails today for reasons unrelated to the actual change.

## Interview Questions

- What would a CI pipeline for a playbook repository look like, stage by stage?
- Why pin collection and role versions in CI instead of always installing latest?

## Next

Continue to [Molecule Testing](07-molecule-testing.md).
