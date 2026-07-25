---
icon: lucide/scroll-text
description: Playbook structure and execution control — hosts, tasks, pre/post_tasks, serial, strategy, delegate_to, run_once, and include_tasks vs. import_tasks.
tags:
  - Ansible
  - Volume 2
  - Playbooks
---

# Part 38 — Playbook Structure and Control Flow

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

This chapter (the first of three covering what used to be a single "Playbooks" chapter) is about the keywords that decide *what runs, on which hosts, in what order, and at what batch size* — the structural skeleton of a play, before any individual task's own logic.

## Why This Exists

- A single flat list of tasks doesn't scale to real infrastructure: you need ordering control (`pre_tasks`/`post_tasks`), rollout control (`serial`, `strategy`), and the ability to run a task somewhere other than its "natural" target (`delegate_to`, `run_once`). This chapter covers the keywords that make a playbook a controlled rollout instead of a single blind blast to every host.

## Problem Statement

- Real rollouts need to answer questions a flat task list can't: "run this against 10% of hosts first," "run this one task only once across the whole play," "run this task's action on the load balancer, not the web server it's for." Each has a specific, named keyword — guessing at workarounds instead of knowing them leads to fragile playbooks.

## Internal Architecture

- How a playbook YAML file compiles into an internal `Play` object, which expands into a list of `Task` objects executed by the Task Queue Manager — full internals in [Volume 3](../volume-3-core-internals/index.md). This chapter stays at the keyword/behavior level.

## Step-by-Step Explanation — Keyword Reference

- **`hosts`**: the target pattern for the play (cross-reference to inventory patterns, [Part 8](02-inventory.md)).
- **`tasks`**: the ordered list of actions within a play.
- **`pre_tasks` / `post_tasks`**: tasks that run before/after `roles:` regardless of role structure — useful for "always check X before any role runs" logic.
- **`serial`**: batch size for rolling execution — an integer, a percentage, or a stepped list (`[1, 5, "100%"]`) to canary a rollout before going wide.
- **`strategy`**: `linear` (default — waits for all hosts to finish each task before moving to the next) vs. `free` (hosts run independently, no per-task lockstep) vs. `debug`.
- **`delegate_to`**: running a task's action on a different host than the one it's nominally "for" — the classic example is updating a load balancer's config on behalf of a web server being taken in/out of rotation.
- **`run_once`**: executing a task exactly once across the whole play, regardless of how many hosts are targeted (e.g., triggering a single shared database migration).
- **`include_tasks` / `import_tasks`**: dynamic (runtime-resolved) vs. static (parse-time-resolved) task inclusion — the distinction changes what `--list-tasks` and tag filtering can actually see ahead of a run.

## Production Best Practices

- Using `serial` with a stepped list (a small canary batch, then the rest) for any change that could plausibly break a host, rather than an all-at-once rollout.
- Preferring `import_tasks`/roles for structure that should be visible to `--list-tasks` and tag filtering; reaching for `include_tasks` only when the task list genuinely must be decided at runtime.
- Being deliberate about `strategy: free` — only using it when hosts are genuinely independent for that play, with no cross-host ordering assumptions.

## Common Mistakes

- Assuming task execution is host-by-host sequential by default — it's task-by-task across a batch of hosts (the `linear` strategy), which surprises people used to purely imperative scripting.
- Forgetting that `delegate_to` still needs its own connection and privilege-escalation considerations on the delegate target — it isn't "free."
- Using `include_tasks` out of habit where `import_tasks` would give better `--list-tasks`/tag visibility.

## Performance Considerations

- `strategy: free` vs. `linear` tradeoffs at scale, and how `serial` trades speed for blast-radius control during rollouts — quantified fully in [Volume 6](../volume-6-production-and-performance/02-performance-and-scaling.md).

## Security Considerations

- `delegate_to` changes *where* a task's credentials and privilege escalation actually apply — audit delegated tasks with the same care as the host they're nominally targeting.

## Interview Questions

- "What's the difference between `include_tasks` and `import_tasks`?"
- "What does `serial` control, and why would you use a stepped list like `serial: [1, 5, "100%"]`?"
- "When would you use `delegate_to`, and what does it not change about a task's execution?"

## Hands-On Lab

- Write a playbook targeting 4 hosts with `serial: [1, "100%"]`, and observe (with `-v`) that only one host runs the first batch before the rest proceed.

## Summary

- These keywords control the *shape* of a rollout — order, batching, and where a task's action actually happens — independent of what any individual task does. The next two chapters cover per-task branching/repetition (loops, conditionals, handlers) and failure handling (blocks).

## Next

Continue to [Part 39 — Loops, Conditionals and Handlers](07-loops-conditionals-and-handlers.md).
