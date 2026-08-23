---
icon: lucide/octagon-x
description: Diagnosing Ansible module and execution errors — missing Python interpreters, module not found, and reading module-specific failure messages.
tags:
  - Ansible
  - Troubleshooting
---

# Module and Execution Errors

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

By the time a task reaches this category, SSH connected and `become` (if any) succeeded — the failure is in the module's own execution on the managed node, or in how the task called it.

## What It Will Cover

- `"/usr/bin/python: not found"` — no Python interpreter on the target; bootstrap with `raw` per [Architecture and Execution](../getting-started/02-architecture-and-execution.md)
- `"couldn't resolve module/action"` — usually a missing collection (`ansible-galaxy collection install ...`) or a typo'd FQCN, not a real "module doesn't exist" situation
- Reading a module's own `msg:` field, which is almost always more specific than the generic `FAILED!` wrapper around it
- `ANSIBLE_KEEP_REMOTE_FILES=1` plus `-vvvv` to inspect the actual module file staged on the managed node, for a failure that doesn't make sense from the error message alone
- `command`/`shell` non-zero exit codes vs. `failed_when` overriding what counts as failure — see [Command vs. Shell](../modules/01-command-vs-shell-vs-raw-vs-script.md)

## Interview Questions

- A task fails with "couldn't resolve module/action" — what are the two most likely causes?
- How would you inspect exactly what a module did on the managed node, beyond the summarized error Ansible shows?

## Next

Return to [Troubleshooting](index.md), or continue to [Interview Preparation](../interview-prep/index.md).
