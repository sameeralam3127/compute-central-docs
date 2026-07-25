---
icon: lucide/repeat
description: Ansible loops, conditionals, handlers, and tags — iterating tasks over data, branching with when, notify-driven handlers, and selective execution.
tags:
  - Ansible
  - Volume 2
  - Playbooks
---

# Part 39 — Loops, Conditionals and Handlers

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

This chapter (the second of three covering what used to be a single "Playbooks" chapter) is about the keywords that decide *whether* a task runs, *how many times*, and *what happens after* — the per-task branching and repetition layer, plus the handler/notify mechanism and selective execution via tags.

## Why This Exists

- Nearly every real task eventually needs to run zero, one, or many times depending on data (`loop`), skip conditionally (`when`), or trigger a follow-up action only when something actually changed (`handlers`/`notify`). These four keywords (`loop`, `when`, `handlers`, `tags`) are used constantly and deserve room the old combined chapter couldn't give them.

## Problem Statement

- Without loops, repeated near-identical tasks get copy-pasted instead of iterated. Without conditionals, tasks run unconditionally on hosts where they don't apply. Without handlers, every task that changes a config has to remember to restart its own service. Without tags, a 200-task playbook can't be run partially during debugging.

## Internal Architecture

- `loop` and `when` are evaluated per-host, per-task, at the point the Task Queue Manager dispatches that task — not pre-computed once at parse time. Handlers are collected as `notify` events fire during a play and run once, deduplicated, at the end of the play (or block, on newer Ansible versions) — not immediately when `notify` is called.

## Step-by-Step Explanation

- **`loop`**: iterating a task over a list of items, with `item` as the loop variable by default (renameable via `loop_control.loop_var`); legacy `with_items`/`with_dict`/etc. still work but `loop` (paired with Jinja2 filters) is the modern form.
- **Conditionals (`when`)**: skipping a task based on facts, variables, or a registered result from an earlier task — evaluated fresh per host.
- **`handlers`**: tasks that only run when `notify:`-ed by another task, deduplicated even if notified multiple times, and run once at the end of the play — the standard pattern for "restart the service, but only if its config actually changed."
- **`tags`**: attaching one or more labels to a task, block, or role, enabling `--tags`/`--skip-tags` to run a meaningful subset of a large playbook without editing it.

## Production Best Practices

- Preferring `loop` over legacy `with_*` forms in new playbooks, since `loop` composes more predictably with filters and `loop_control`.
- Using `notify`/handlers for every "restart/reload the service" pattern instead of a separate always-run restart task — this is what makes a restart conditional on real change, not habit.
- Tagging tasks meaningfully (`tags: [config, restart]`) from the start of a project, not retrofitted after the playbook is already large.

## Common Mistakes

- Using `with_items`/legacy loop syntax in new code out of habit instead of `loop`.
- Forgetting handlers only fire once per play even if notified multiple times, and only at the *end* of the play — not immediately when `notify` runs, which surprises people expecting synchronous behavior.
- Over-tagging every single task with the same tag, making `--tags` filtering meaningless because it never narrows anything down.

## Performance Considerations

- Large loops (`loop` over hundreds of items) run sequentially per host by default — `async`/parallelism strategies for genuinely expensive per-item work are covered in [Volume 6](../volume-6-production-and-performance/02-performance-and-scaling.md).

## Security Considerations

- Conditionals that gate privilege-escalated (`become: true`) tasks need the same scrutiny as the task itself — a `when:` that's wrong can either skip a needed security control or run one somewhere it shouldn't.

## Interview Questions

- "What's the difference between `loop` and the legacy `with_items` syntax?"
- "How do handlers guarantee a service only restarts once, even if notified by three different tasks?"
- "How would you run only a subset of a 200-task playbook without editing it?"

## Hands-On Lab

- Write a playbook with a task that templates a config file and `notify`s a handler that restarts a (mock) service; run it twice and confirm the handler only fires on the run where the file actually changed.

## Summary

- `loop`, `when`, `handlers`, and `tags` are the tools that turn a flat, unconditional task list into automation that adapts per host, avoids redundant restarts, and can be run partially on demand.

## Next

Continue to [Part 40 — Error Handling: Blocks, Rescue and Always](08-error-handling-blocks-rescue-always.md).
