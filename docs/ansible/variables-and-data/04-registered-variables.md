---
title: "Ansible register Variable Explained"
icon: lucide/save
description: Capturing a task's result with register, and using it in later conditionals, loops, and templates.
tags:
  - Ansible
  - Variables
---

# Registered Variables

## What You'll Learn

- How `register:` captures a task's full result, not just a value
- The shape of a registered result and where to find what you need in it

## Minimal Example

```yaml
- name: Check for an existing deployment marker
  ansible.builtin.stat:
    path: /opt/app/current
  register: app_check

- name: Deploy only if not already present
  ansible.builtin.copy:
    src: app.tar.gz
    dest: /opt/app/current
  when: not app_check.stat.exists
```

`register` stores the module's **entire JSON result** — not just one field — under the name you give it. `app_check.stat.exists`, `app_check.stat.mode`, and every other key the `stat` module returns are all available afterward.

## Inspecting What You Actually Got

```yaml
- name: Show the full registered result
  ansible.builtin.debug:
    var: app_check
```

Running this once against an unfamiliar module is the fastest way to learn its return shape — faster than reading documentation for a field name you're not sure exists.

## Common Fields Across Most Modules

| Field | Meaning |
|---|---|
| `changed` | Whether the module made a change |
| `failed` | Whether the task failed |
| `rc` | Return code (`command`/`shell` only) |
| `stdout` / `stderr` | Captured output (`command`/`shell` only) |
| `stdout_lines` | `stdout` pre-split into a list of lines |

## Common Mistakes

- Assuming every module returns the same fields — `stat`, `command`, and `uri` all return very different shapes; always check with `debug: var=` on anything unfamiliar.
- Forgetting `register` inside a `loop` produces a list of results (one per iteration) under `.results`, not a single flat result.
- Registering a result and never checking `failed_when`/`ignore_errors` semantics — see [Error Handling](../playbook-engineering/02-error-handling.md).

## Interview Questions

- What does `register` actually capture — just the output, or the full result?
- What does a registered variable look like when the task it came from was inside a `loop`?

## Next

Continue to [Magic Variables and Hostvars](05-magic-variables-and-hostvars.md).
