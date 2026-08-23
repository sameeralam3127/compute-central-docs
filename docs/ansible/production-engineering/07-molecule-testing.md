---
title: "Ansible Role Testing with Molecule"
icon: lucide/flask-conical
description: Testing Ansible roles in isolation with Molecule — scenarios, converge/verify/idempotence stages, and Docker-based test instances.
tags:
  - Ansible
  - Production
  - Testing
---

# Molecule Testing

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

A role that "worked when I ran it manually" isn't the same as a role that's actually tested — Molecule runs a role against a disposable test instance (usually a container) as part of a repeatable pipeline, including an explicit **idempotence** check.

Molecule ships as part of [ansible-dev-tools](08-ansible-dev-tools.md) alongside `pytest-ansible`, which can expose Molecule scenarios as pytest fixtures if your project's test suite already standardizes on pytest.

## What It Will Cover

```bash
molecule init scenario -r myrole -d docker
```

```text
roles/myrole/molecule/default/
├── molecule.yml       # driver (docker), platforms to test against
├── converge.yml         # a minimal playbook applying the role
└── verify.yml             # assertions about the resulting state
```

- **`molecule converge`** — apply the role to a fresh disposable instance
- **`molecule verify`** — assert the resulting state is correct (often via `ansible.builtin.assert` or a testing framework)
- **`molecule idempotence`** — run `converge` a second time and fail the build if anything reports `changed` — a direct, automated version of the manual "run it twice" check from [Idempotency](../core-concepts/11-idempotency.md)
- **`molecule test`** — the full sequence (lint, create, converge, idempotence, verify, destroy) as one CI stage
- Testing a role against multiple platforms (Ubuntu, RHEL) in the same scenario via `platforms:` in `molecule.yml`

## Common Mistakes

- Never running the `idempotence` stage — the single check most likely to catch a role that silently reports `changed` on every run.
- Testing only the "happy path" converge and skipping `verify` assertions entirely, so a role can converge to the wrong state and still pass.

## Interview Questions

- What does Molecule's `idempotence` stage actually check, and why is it meaningfully different from `converge` succeeding?
- How would you test a role against both Ubuntu and RHEL in the same CI pipeline?

## Next

Continue to [Case Studies](../case-studies/index.md) to see these practices applied end to end.
