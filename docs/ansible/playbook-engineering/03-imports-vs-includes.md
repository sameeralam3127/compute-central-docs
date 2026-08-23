---
icon: lucide/file-symlink
description: Static vs. dynamic inclusion in Ansible — import_tasks/include_tasks and import_playbook, plus how each interacts with tags, loops, and --list-tasks.
tags:
  - Ansible
  - Playbook Engineering
---

# Imports vs. Includes

The core `import_tasks` vs. `include_tasks` comparison — with the decision tree — lives in [Module Decision Trees](../modules/02-module-decision-trees.md). This page covers what that comparison implies once you're structuring a real project, plus the playbook-level equivalent, `import_playbook`.

## The One-Line Version

- **`import_*`** — resolved at **parse time**, before any host runs anything. Fully visible to `--list-tasks`/`--list-tags`/`--tags` filtering.
- **`include_*`** — resolved at **run time**, host by host. Necessary when *what* to include depends on a variable, fact, or loop — invisible to `--list-tasks` ahead of time, because it genuinely can't be known yet.

## `import_playbook`

The playbook-level equivalent of `import_tasks`, used to compose multiple playbook files into one entry point:

```yaml title="site.yml"
---
- import_playbook: preflight.yml
- import_playbook: web.yml
- import_playbook: database.yml
```

`import_playbook` is **always static** — there is no `include_playbook` counterpart. This is a deliberate asymmetry: playbook composition is expected to be a fixed, reviewable structure, not something decided at run time.

## Interaction With Loops

```yaml
# include_tasks CAN be looped — a genuinely dynamic use case
- name: Run environment-specific setup
  ansible.builtin.include_tasks: "{{ item }}_setup.yml"
  loop:
    - network
    - storage
    - firewall
```

`import_tasks` **cannot** be looped this way — because it's resolved before the play runs, there's no `item` value available yet to build a filename from. This is the clearest practical case where `include_tasks` isn't just a style preference — it's the only option.

## Interaction With Tags

```yaml
- name: Run networking setup
  ansible.builtin.import_tasks: network_setup.yml
  tags: networking
```

With `import_tasks`, the `networking` tag is applied to **every task inside `network_setup.yml`** individually, at parse time — `--tags networking` runs exactly those tasks, and `--list-tags` shows them. With `include_tasks`, tag filtering is checked at the moment the include is reached; Ansible can't tell you in advance what's inside.

## Decision, Restated for Project Structure

| Situation | Choice |
|---|---|
| Splitting a long, always-the-same task list into files for readability | `import_tasks` |
| Composing multiple playbook files into one entry point | `import_playbook` (the only option) |
| Task file to include is decided by a variable, fact, or `loop` | `include_tasks` |
| Need `--list-tasks`/`--tags` to see everything ahead of a run | `import_tasks` |

## Common Mistakes

- Trying to `loop:` an `import_tasks` and being confused why `item` isn't defined inside the imported file — loops require `include_tasks`.
- Assuming `include_playbook` exists — it doesn't; playbook-level composition is always static via `import_playbook`.
- Defaulting to `include_tasks` everywhere out of habit, losing `--list-tasks` visibility for structure that was actually static all along.

## Interview Questions

- What's the difference between `import_tasks` and `include_tasks`, in terms of *when* each is resolved?
- Why can't `import_tasks` be used inside a `loop`?
- Why is there no `include_playbook`?

See [Interview Prep: Core Concepts](../interview-prep/01-core-concepts-questions.md) for the full leveled answer.

## Next

Continue to [Delegation and Become](04-delegation-and-become.md).
