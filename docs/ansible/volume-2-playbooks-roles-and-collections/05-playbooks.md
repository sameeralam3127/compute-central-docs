---
icon: lucide/scroll-text
description: Every Ansible playbook keyword explained — hosts, tasks, handlers, roles, pre/post tasks, serial, strategy, tags, loops, conditionals, blocks, rescue, always, delegate_to, run_once, and more.
tags:
  - Ansible
  - Volume 2
  - Playbooks
---

# Part 11 — Playbooks

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

The playbook is Ansible's central artifact — this chapter is a keyword-by-keyword reference, not just a "here's an example" tutorial.

## Why This Exists

- Most playbook keywords are individually simple, but their interactions (blocks + rescue + tags, or serial + strategy) are where real production playbooks get subtle — this chapter covers both the keywords and their interactions.

## Problem Statement

- A single flat list of tasks doesn't scale to real infrastructure: you need ordering control (`pre_tasks`/`post_tasks`), reusable structure (`roles`), failure handling (`block`/`rescue`/`always`), rollout control (`serial`, `strategy`), and selective execution (`tags`).

## Internal Architecture

- How a playbook YAML file compiles into an internal `Play` object, which expands into a list of `Task` objects executed by the Task Queue Manager (full internals in Volume 3) — this chapter stays at the keyword/behavior level.

## Step-by-Step Explanation — Keyword Reference

- **`hosts`**: target pattern for the play.
- **`tasks`**: the ordered list of actions.
- **`handlers`**: tasks only run when notified by `notify:`, run once at the end of a play (deduplicated).
- **`roles`**: including a reusable role's tasks/vars/handlers/templates.
- **`pre_tasks` / `post_tasks`**: tasks that run before/after roles regardless of role structure.
- **`serial`**: batch size for rolling execution (an integer, percentage, or list of stepped values).
- **`strategy`**: `linear` (default, waits for all hosts each task) vs. `free` (hosts run independently) vs. `debug`.
- **`tags`**: selective execution via `--tags`/`--skip-tags`.
- **`loop`** (and legacy `with_*`): iterating a task over a list.
- **Conditionals (`when`)**: skipping tasks based on facts/variables.
- **`block` / `rescue` / `always`**: try/except/finally-style error handling grouping for tasks.
- **`delegate_to`**: running a task's action on a different host than the one it's "for" (e.g., updating a load balancer on behalf of a web server).
- **`run_once`**: executing a task a single time across the whole play instead of per host.
- **`include_tasks` / `import_tasks`**: dynamic (runtime) vs. static (parse-time) task inclusion, and why the distinction changes what `--list-tasks`/tags/loops can see.
- **`collections`**: declaring which collections' modules a play can reference unqualified.
- **`environment`**: setting environment variables for the remote task's execution (distinct from control-node `ANSIBLE_*` env vars).
- **`module_defaults`**: setting default argument values for a module across many tasks.

## Production Best Practices

- Preferring `import_tasks`/roles for structure that should be visible to `--list-tasks` and tag filtering; using `include_tasks` only when the task list genuinely must be decided at runtime.
- Using `block`/`rescue`/`always` for any task group where partial failure needs cleanup, rather than relying on `ignore_errors`.

## Common Mistakes

- Overusing `ignore_errors: true` instead of proper `block`/`rescue` handling, masking real failures.
- Using `with_items`/legacy loop syntax in new code instead of `loop`.
- Forgetting handlers only fire once per play even if notified multiple times, and only at the *end* of the play (or block, with newer Ansible versions) — not immediately.

## Performance Considerations

- `strategy: free` vs. `linear` tradeoffs at scale, and how `serial` trades speed for blast-radius control during rollouts — previewed here, covered fully in Volume 6.

## Security Considerations

- `delegate_to` and `become` interactions — a delegated task still needs its own privilege-escalation and connection considerations on the delegate target.

## Interview Questions

- "What's the difference between `include_tasks` and `import_tasks`?"
- "How do `block`, `rescue`, and `always` work together?"
- "What does `serial` control, and why would you use a stepped list like `serial: [1, 5, "100%"]`?"

## Hands-On Lab

- Write a playbook with a `block` that intentionally fails, a `rescue` that logs the failure, and an `always` that runs regardless — observe the execution order.

## Summary

- Playbooks are more than a task list — `block`/`rescue`/`always`, `serial`/`strategy`, and `include`/`import` are the keywords that turn a script into production-grade automation.

## Next

Continue to [Part 12 — Roles](06-roles.md).
