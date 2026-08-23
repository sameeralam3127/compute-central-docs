---
title: "Ansible Module argument_spec and Check Mode"
icon: lucide/list-checks
description: Ansible module internals in depth — argument_spec validation features, check mode internals, idempotency patterns, diff mode, and no_log/module_utils.
tags:
  - Ansible
  - Build Your Own
  - Modules
---

# ArgumentSpec, Check Mode, Idempotency, and Diff

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover. [Build a Custom Module](01-build-a-custom-module.md) already demonstrates each of these in a working module — this page goes one level deeper on each piece.

## What It Will Cover

- **`argument_spec` features beyond `type`/`required`**: `choices`, `default`, `no_log=True` for sensitive parameters, `mutually_exclusive`, `required_together`, `required_if`, sub-argument specs for nested dict parameters
- **Check mode internals**: `module.check_mode`, and why a module must explicitly branch on it rather than getting it "for free"
- **Idempotency patterns beyond a simple equality check**: comparing computed hashes for large content, handling partial-match update-in-place logic, race conditions between the check and the act
- **Diff mode**: the `before`/`after` dict shape `module.exit_json(diff=...)` expects, and how it surfaces in `--diff` output
- **`module_utils`**: sharing logic across a family of related modules instead of duplicating it (the mechanism a real collection uses for its own custom modules — see [Build a Collection From Zero](03-build-a-collection-from-zero.md))
- **Return value documentation**: the `RETURN` docstring contract in full, including nested return structures

## Common Mistakes

- Using `no_log` only on the *task* level and forgetting it belongs on the `argument_spec` parameter itself for a custom module handling secrets.
- A "check-then-act" idempotency check that's actually a race — state can change between the check and the write on a genuinely concurrent system, which is worth calling out even though most Ansible use cases (config management, not high-frequency systems) rarely hit it in practice.

## Interview Questions

- What does `no_log=True` on an `argument_spec` parameter actually redact, and where?
- How would you share validation logic across five related custom modules without duplicating it in each one?

## Next

Continue to [Build a Collection From Zero](03-build-a-collection-from-zero.md).
