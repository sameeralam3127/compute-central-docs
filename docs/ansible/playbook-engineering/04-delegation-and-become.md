---
icon: lucide/arrow-right-left
description: delegate_to and run_once — running a task's action on a different host, or exactly once across a whole play — and become for privilege escalation.
tags:
  - Ansible
  - Playbook Engineering
---

# Delegation and Become

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

Not every task should run on the host it's nominally "for" — the classic case is updating a load balancer's config on behalf of a web server being taken in or out of rotation. `delegate_to` and `run_once` handle this; `become` handles privilege escalation, a related but distinct concept covered in depth in [SSH and Connectivity](../getting-started/05-ssh-and-connectivity.md#become-is-not-ssh-authentication).

## What It Will Cover

- `delegate_to:` — running a task's action on a different host than the one it's targeting, with a worked load-balancer example
- Why `delegate_to` still needs its own connection and privilege-escalation considerations on the delegate target — it isn't "free"
- `run_once: true` — executing a task exactly once across the whole play regardless of host count (e.g., triggering one shared database migration)
- `local_action` / `delegate_to: localhost` for running something on the control node itself
- `become`, `become_user`, `become_method` and how they resolve through variable precedence

## Common Mistakes

- Forgetting `delegate_to` changes *where* a task's action runs but not which host's variables are in scope by default — a common source of "wrong value used" bugs.
- Using `run_once` without also pinning which host runs it, when the "any host" default happens to pick one with different facts than expected.

## Interview Questions

- What does `delegate_to` change about a task's execution, and what does it not change?
- When would you use `run_once`?

## Next

Continue to [Async and Poll](05-async-and-poll.md).
