---
icon: lucide/clock
description: Ansible async and poll — running long tasks in the background and checking on them later, instead of blocking the whole play.
tags:
  - Ansible
  - Playbook Engineering
---

# Async and Poll

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

A task that takes ten minutes (a large file download, a slow database migration) blocks the entire play for that host by default — `async`/`poll` lets Ansible kick it off and check back later, or fire-and-forget entirely.

## What It Will Cover

- `async: <seconds>` — maximum time the task is allowed to run, in the background
- `poll: <seconds>` — how often Ansible checks in; `poll: 0` means fire-and-forget, never check
- Checking on a fire-and-forget job later with `ansible.builtin.async_status`
- How `async` differs from real parallelism across a `loop` — it's about not blocking on one slow task, not about running loop iterations concurrently
- A worked example: kick off a long backup job with `async`/`poll: 0`, continue the play, and poll for completion in a later task

## Common Mistakes

- Assuming `async` makes a `loop` run its iterations in parallel — it doesn't; it's for not blocking on a single slow task.
- Setting `async` without a large enough value and having the job killed mid-run once the ceiling is hit.

## Interview Questions

- What's the difference between `poll: 0` and a normal blocking task?
- How would you check on a fire-and-forget async task later in the same playbook?

## Next

Continue to [Advanced Execution](../advanced-execution/index.md).
