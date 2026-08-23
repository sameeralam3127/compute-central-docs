---
icon: lucide/shield-alert
description: Ansible blocks, rescue, and always — grouping tasks, catching failures, and running cleanup logic regardless of outcome.
tags:
  - Ansible
  - Playbook Engineering
  - Error Handling
---

# Blocks, Rescue, and Always

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

A flat task list has no concept of "if any of these three tasks fail, do this instead" — `block`/`rescue`/`always` is Ansible's answer, modeled loosely on try/except/finally from general-purpose languages, but evaluated per host.

## What It Will Cover

- `block:` to group related tasks (shared `when:`, `become:`, tags applied once to the whole group)
- `rescue:` — runs only if a task inside the `block` fails; the failure is then considered handled unless `rescue` itself fails or explicitly re-raises
- `always:` — runs regardless of whether the block succeeded, failed, or was rescued
- `ansible_failed_task` / `ansible_failed_result` magic variables available inside `rescue:`
- A worked example: attempt a deployment in `block`, roll back in `rescue`, and always send a notification in `always`

## Common Mistakes

- Assuming a failure inside `rescue:` itself is silently swallowed — it isn't; an unhandled failure there still fails the host.
- Forgetting `always:` runs even on a host that never entered `rescue:` (i.e., the `block` fully succeeded) — it isn't only for the failure path.

## Interview Questions

- What's the difference between `rescue:` and `always:`?
- How would you implement a deployment rollback using `block`/`rescue`?

## Next

Continue to [Error Handling](02-error-handling.md).
