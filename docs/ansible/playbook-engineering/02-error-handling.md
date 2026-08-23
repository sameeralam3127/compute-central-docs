---
icon: lucide/octagon-alert
description: Ansible error handling — ignore_errors, failed_when, any_errors_fatal, and max_fail_percentage.
tags:
  - Ansible
  - Playbook Engineering
  - Error Handling
---

# Error Handling

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

By default, a failed task on one host removes that host from the rest of the play but lets other hosts continue — that default is usually right, but not always, and this page covers the keywords that change it deliberately.

## What It Will Cover

- `ignore_errors: true` — continue the play on this host past a failed task (rarely the right first instinct; usually `failed_when` is)
- `failed_when:` — define failure explicitly instead of relying on a module's default success/failure logic (used constantly with `command`/`shell`, see [Command vs. Shell](../modules/01-command-vs-shell-vs-raw-vs-script.md))
- `any_errors_fatal: true` — stop the **entire play**, across all hosts, the moment any single host fails
- `max_fail_percentage` — abort the play once more than a given percentage of hosts have failed, useful for canary-style rollouts
- How these interact with [`block`/`rescue`/`always`](01-blocks-rescue-always.md)

## Common Mistakes

- Reaching for `ignore_errors: true` to silence a failure instead of fixing the underlying `failed_when` logic — this hides real problems, not just cosmetic ones.
- Not setting `any_errors_fatal`/`max_fail_percentage` on a rollout that should stop early if early hosts are already failing.

## Interview Questions

- What's the difference between `ignore_errors` and `failed_when`?
- How would you stop an entire rollout early if 20% of hosts fail?

## Next

Continue to [Imports vs. Includes](03-imports-vs-includes.md).
