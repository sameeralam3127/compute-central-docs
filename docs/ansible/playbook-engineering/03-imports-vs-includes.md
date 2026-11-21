---
title: "Ansible import_tasks vs include_tasks"
icon: lucide/file-symlink
description: "import_tasks is static and read when the playbook is parsed; include_tasks is dynamic and read when the task runs. Loops, tags, when, and handlers compared."
tags:
  - Ansible
  - Playbook Engineering
---

# import_tasks vs include_tasks

`import_tasks` is static: Ansible reads the file when it parses the playbook, before any host runs a task, so every imported task is visible to `--list-tasks` and `--tags`, and the statement can't be looped. `include_tasks` is dynamic: Ansible reads the file when the play reaches it, host by host, so the file name can come from a variable, a fact, or a loop item, but tags and `when` apply to the include rather than to the tasks inside it.

Use `import_tasks` by default. Switch to `include_tasks` when the file to load depends on something only known at run time.

!!! info "Tested on ansible-core 2.22"
    Every behavior and error message on this page was checked with ansible-core 2.22.0 (November 2026).

## What You'll Learn

- The one difference that explains all the others: parse time versus run time
- How loops, tags, `when`, handlers, `--list-tasks`, and `--start-at-task` behave with each
- When `include_tasks` is the only option, and what it quietly costs you
- Where `import_playbook` fits

## import_tasks vs include_tasks at a Glance

| | `import_tasks` (static) | `include_tasks` (dynamic) |
|---|---|---|
| File is read | When the playbook is parsed, before any host runs a task | When the play reaches the task, for each host |
| `loop` on the statement | Not allowed: Ansible stops with "You cannot use loops on 'import_tasks' statements" | Allowed: the file is included once per item |
| Variables in the file name | Play `vars` and extra vars (`-e`) only; facts and inventory variables are undefined at parse time | Any variable: inventory, facts, registered results, loop items |
| `tags` on the statement | Copied onto every imported task, so `--tags` runs them | Apply to the include only; tasks inside run only with `apply: { tags: ... }` |
| `when` on the statement | Copied onto every imported task and re-checked before each one | Checked once, for the include |
| `--list-tasks` and `--list-tags` | List every imported task and its tags | List only the include; the file's tasks and tags stay hidden |
| `--start-at-task` | Can start at an imported task | Can't start at a task inside an include |
| Handlers defined in the file | Can be notified by name | Can't be notified: "The requested handler ... was not found" |
| Errors in the file | Stop the run before any host runs a task | Fail when the include is reached, possibly halfway through a rollout |
| Playbook-level version | `import_playbook` | None: there is no `include_playbook` |

Roles have the same pair: `import_role` is static and `include_role` is dynamic.

## See the Difference in --list-tasks

```yaml title="site.yml"
- name: Configure web servers
  hosts: web
  tasks:
    - name: Firewall rules
      ansible.builtin.import_tasks: tasks/firewall.yml

    - name: App setup
      ansible.builtin.include_tasks: tasks/app.yml
```

`tasks/firewall.yml` contains a task named "Open the firewall port", and `tasks/app.yml` one named "Configure the app":

```text
$ ansible-playbook site.yml --list-tasks

playbook: site.yml

  play #1 (web): Configure web servers	TAGS: []
    tasks:
      Open the firewall port	TAGS: []
      App setup	TAGS: []
```

The imported task shows up by its own name. The include shows up only as itself, "App setup": Ansible doesn't read `tasks/app.yml` until the play gets there, so it can't list, tag-filter, or `--start-at-task` anything inside it.

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

`import_tasks` **cannot** be looped this way — because it's resolved before the play runs, there's no `item` value available yet to build a filename from. Ansible refuses before running anything:

```text
[ERROR]: You cannot use loops on 'import_tasks' statements. You should use 'include_tasks' instead.
```

This is the clearest practical case where `include_tasks` isn't just a style preference — it's the only option.

## Variables in the File Name

An import's file name is evaluated at parse time, so it can only use variables that exist before any host is contacted: play `vars` and extra vars passed with `-e`. Inventory variables and facts don't exist yet:

```text
[ERROR]: Error when evaluating variable in import path 'tasks/{{ setup_kind }}_setup.yml': 'setup_kind' is undefined
```

Here `setup_kind` was a group variable in the inventory. The same line with `include_tasks` works, because by then the host and its variables are known. Picking a task file per OS family, `"{{ ansible_facts['os_family'] }}.yml"`, is the classic case that needs an include.

## Interaction With Tags

```yaml
- name: Run networking setup
  ansible.builtin.import_tasks: network_setup.yml
  tags: networking
```

With `import_tasks`, the `networking` tag is applied to **every task inside `network_setup.yml`** individually, at parse time — `--tags networking` runs exactly those tasks, and `--list-tags` shows them. With `include_tasks`, the tag lands on the include alone: `--tags networking` runs the include and then skips every task in the file, because none of them carry the tag. The fix is `apply`, shown under [What Most Engineers Miss](#what-most-engineers-miss). [Tags](../core-concepts/09-tags.md) covers tag filtering in general.

## Decision, Restated for Project Structure

| Situation | Choice |
|---|---|
| Splitting a long, always-the-same task list into files for readability | `import_tasks` |
| Composing multiple playbook files into one entry point | `import_playbook` (the only option) |
| Task file to include is decided by a variable, fact, or `loop` | `include_tasks` |
| Need `--list-tasks`/`--tags` to see everything ahead of a run | `import_tasks` |
| Need to resume a failed run with `--start-at-task` inside the file | `import_tasks` |

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
- **Imports can't use facts or host variables in the filename.** `import_tasks: "{{ ansible_facts['os_family'] }}.yml"` fails with `'ansible_facts' is undefined`, because imports are resolved before any host has gathered facts. Use `include_tasks` there.
- **Errors surface at different times.** A broken imported file stops the run at parse time, before any host is touched. A broken included file only fails when that include runs, which can be halfway through a production rollout.
- **A handler defined inside a dynamic include can't be notified at all.** Notifying it fails with "The requested handler 'Restart api' was not found in either the main handlers list nor in the listening handlers list". Keep handlers in `handlers/` files, or bring them in with `import_tasks`; see [Handlers](../core-concepts/08-handlers.md).

## Common Mistakes

- Trying to `loop:` an `import_tasks` and being confused why `item` isn't defined inside the imported file — loops require `include_tasks`.
- Assuming `include_playbook` exists — it doesn't; playbook-level composition is always static via `import_playbook`.
- Defaulting to `include_tasks` everywhere out of habit, losing `--list-tasks` visibility for structure that was actually static all along.
- Building an import path from an inventory or `group_vars` variable, and getting "is undefined" at parse time.

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

!!! quiz "Resuming a failed run"
    A run failed at "Configure the app", a task inside a file loaded with `include_tasks`. You rerun with `--start-at-task "Configure the app"`. What happens?

    - [ ] The run starts at that task
    - [x] Ansible stops with "No matching task ... found", because it can't see inside an include ahead of time
    - [ ] The run starts at the include and runs the whole file

    `--start-at-task` can only find tasks Ansible knows about at parse time. Switch that file to `import_tasks` if you need to resume inside it.

## Interview Questions

- What's the difference between `import_tasks` and `include_tasks`, in terms of *when* each is resolved?
- Why can't `import_tasks` be used inside a `loop`?
- Why is there no `include_playbook`?
- Why does `import_tasks: "{{ ansible_facts['os_family'] }}.yml"` fail, and what would you use instead?

See [Interview Prep: Core Concepts](../interview-prep/01-core-concepts-questions.md) for the full leveled answer.

## Next

Continue to [Delegation and Become](04-delegation-and-become.md).
