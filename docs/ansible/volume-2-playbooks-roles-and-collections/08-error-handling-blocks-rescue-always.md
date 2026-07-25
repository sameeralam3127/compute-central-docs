---
icon: lucide/shield-alert
description: Ansible error handling — block, rescue, and always for try/except/finally-style task grouping, ignore_errors, module_defaults, and the environment keyword.
tags:
  - Ansible
  - Volume 2
  - Playbooks
---

# Part 40 — Error Handling: Blocks, Rescue and Always

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

This chapter (the last of three covering what used to be a single "Playbooks" chapter) is about what happens when a task fails — `block`/`rescue`/`always`, the common `ignore_errors` anti-pattern it replaces, and two related per-task-defaults keywords, `module_defaults` and `environment`.

## Why This Exists

- Real automation fails partway through sometimes — a package mirror is down, a service takes too long to start. Without deliberate error handling, playbooks either stop dead (the safe but unhelpful default) or silently plow through failures via `ignore_errors: true` (the dangerous shortcut). This chapter covers the correct middle path.

## Problem Statement

- A group of related tasks (e.g., "stop service, update config, start service") often needs all-or-nothing cleanup semantics: if the update fails partway through, the service still needs to end up running *something*, not left stopped. A flat task list with `ignore_errors` can't express that.

## Internal Architecture

- `block` groups tasks so they can share `when`, `become`, and tags as a unit. `rescue` runs only if a task inside the `block` fails, and `always` runs regardless of whether the block succeeded, failed, or was rescued — directly analogous to try/except/finally in general-purpose programming, implemented at the task-execution layer described in [Volume 3](../volume-3-core-internals/index.md).

## Step-by-Step Explanation

- **`block`**: grouping tasks that logically belong together, and applying `when`/`become`/tags once to the whole group instead of repeating them per task.
- **`rescue`**: tasks that run only if something inside the `block` failed — the place to put recovery logic (roll back a config, alert, retry with a fallback).
- **`always`**: tasks that run whether or not the block failed or was rescued — the place for cleanup that must happen no matter what (removing a lock file, ensuring a service is left in *some* running state).
- **`ignore_errors: true`**: suppresses a task's failure so the play continues — contrasted directly with `block`/`rescue`, which handles the failure instead of merely hiding it.
- **`module_defaults`**: setting default argument values for a module across many tasks, reducing repetition when many tasks share the same non-default arguments.
- **`environment`**: setting environment variables for the *remote* task's execution — distinct from control-node `ANSIBLE_*` environment variables covered in [Part 10](05-ansible-cfg.md).

## Production Best Practices

- Using `block`/`rescue`/`always` for any task group where partial failure needs real cleanup, rather than reaching for `ignore_errors` as a default.
- Reserving `ignore_errors` for genuinely expected, safe-to-ignore failures (e.g., "try to remove a file that may not exist"), with a comment explaining why it's safe.

## Common Mistakes

- Overusing `ignore_errors: true` instead of proper `block`/`rescue` handling, masking real failures that should have stopped the run or triggered cleanup.
- Writing a `rescue` block that doesn't actually leave the host in a known-good state, just silences the original error.
- Forgetting `always` runs even when `rescue` itself fails, and not accounting for that in cleanup logic.

## Performance Considerations

- Deeply nested `block`/`rescue`/`always` structures don't carry a meaningful performance cost themselves — the cost is entirely in whatever tasks are inside them.

## Security Considerations

- A `rescue` block that "recovers" by silently continuing with elevated (`become: true`) privileges deserves the same review scrutiny as the original task — error handling isn't a privilege-escalation loophole.

## Interview Questions

- "How do `block`, `rescue`, and `always` work together, and how is this different from `ignore_errors`?"
- "When would you use `module_defaults` instead of repeating an argument on every task?"
- "What's the difference between the `environment` keyword and a control-node `ANSIBLE_*` environment variable?"

## Hands-On Lab

- Write a playbook with a `block` that intentionally fails, a `rescue` that logs the failure and continues, and an `always` that runs regardless — observe the execution order in the output.

## Summary

- `block`/`rescue`/`always` turn "the play stopped" or "the failure was silently hidden" into deliberate, inspectable failure handling — this closes out the three-chapter split of what used to be a single Playbooks chapter.

## Next

Continue to [Part 12 — Roles](09-roles.md).
