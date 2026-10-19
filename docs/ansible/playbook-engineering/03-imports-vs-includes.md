---
title: "Ansible import_tasks vs include_tasks"
icon: lucide/file-symlink
description: "import_tasks is static and resolved when the playbook is parsed; include_tasks is dynamic and resolved when the task runs. That drives tags, loops, and --list-tasks."
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

## What Most Engineers Miss

- **Tags on `include_tasks` don't reach the tasks inside.** The tag applies to the include itself, so `--tags networking` runs the include and then skips every task in the file, because those tasks don't carry the tag. Use `apply` to pass it down, and keep the tag on the include so it runs at all:

    ```yaml
    - name: Run networking setup
      ansible.builtin.include_tasks:
        file: network_setup.yml
        apply:
          tags: networking
      tags: networking
    ```

- **`when` behaves differently on each.** On `import_tasks`, the condition is copied onto every imported task and checked task by task, so if an early task changes what the condition tests, later tasks skip themselves. On `include_tasks`, it's checked once, for the include.
- **Imports can't use facts or host variables in the filename.** `import_tasks: "{{ ansible_facts['os_family'] }}.yml"` fails, because imports are resolved before any host has gathered facts. Use `include_tasks` there.
- **Errors surface at different times.** A broken imported file stops the run at parse time, before any host is touched. A broken included file only fails when that include runs, which can be halfway through a production rollout.
- **A handler defined inside a dynamic include can't be notified at all.** Keep handlers in `handlers/` files, or bring them in with `import_tasks`.

## Common Mistakes

- Trying to `loop:` an `import_tasks` and being confused why `item` isn't defined inside the imported file — loops require `include_tasks`.
- Assuming `include_playbook` exists — it doesn't; playbook-level composition is always static via `import_playbook`.
- Defaulting to `include_tasks` everywhere out of habit, losing `--list-tasks` visibility for structure that was actually static all along.

## Check Yourself

!!! quiz "Tags on an include"
    `include_tasks: network_setup.yml` has `tags: networking`. You run `--tags networking`. What runs?

    - [ ] Every task in `network_setup.yml`
    - [x] The include itself, but none of the tasks inside, because they don't carry the tag
    - [ ] Nothing: includes ignore tags

    Tags on a dynamic include apply only to the include. Add `apply: { tags: networking }` to pass the tag to the included tasks.

!!! quiz "Which one can loop?"
    You need to run `network_setup.yml`, `storage_setup.yml`, and `firewall_setup.yml` from a `loop`. Which works?

    - [ ] `import_tasks: "{{ item }}_setup.yml"`
    - [x] `include_tasks: "{{ item }}_setup.yml"`
    - [ ] Both

    Imports are resolved before the play runs, when `item` doesn't exist yet. Only includes can be looped.

!!! quiz "A condition on an import"
    `import_tasks: setup.yml` has `when: not app_installed`. An early task in `setup.yml` runs `set_fact: { app_installed: true }`. What happens to the tasks after it?

    - [ ] They run: the condition was checked once, before the import
    - [x] They're skipped: the condition is copied onto every imported task and re-checked each time
    - [ ] The play fails with a recursion error

    On an import, `when` is evaluated per task. Use `include_tasks` if the condition should be checked once.

## Interview Questions

- What's the difference between `import_tasks` and `include_tasks`, in terms of *when* each is resolved?
- Why can't `import_tasks` be used inside a `loop`?
- Why is there no `include_playbook`?

See [Interview Prep: Core Concepts](../interview-prep/01-core-concepts-questions.md) for the full leveled answer.

## Next

Continue to [Delegation and Become](04-delegation-and-become.md).
