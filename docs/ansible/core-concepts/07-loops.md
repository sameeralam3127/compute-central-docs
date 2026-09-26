---
title: "Ansible Loop Examples: Lists and Dictionaries"
icon: lucide/repeat
description: Ansible loops with loop — iterating a task over a list or dictionary, loop_control, and why loop replaced the legacy with_items family.
tags:
  - Ansible
  - Core Concepts
  - Loops
---

# Loops

## What You'll Learn

- The `loop:` keyword and the `item` variable
- Looping over a list of dictionaries
- Why `loop` replaced `with_items` in modern playbooks

## Minimal Example

```yaml
- name: Install a list of packages
  ansible.builtin.package:
    name: "{{ item }}"
    state: present
  loop:
    - nginx
    - curl
    - git
```

Runs the task three times, once per list item, with `item` bound to the current value each time.

## Looping Over a List of Dictionaries

```yaml
- name: Create application users
  ansible.builtin.user:
    name: "{{ item.name }}"
    groups: "{{ item.groups }}"
    shell: /bin/bash
  loop:
    - { name: deploy, groups: sudo }
    - { name: appuser, groups: docker }
```

## Renaming the Loop Variable

```yaml
- name: Ensure config directories exist
  ansible.builtin.file:
    path: "/etc/app/{{ dir_name }}"
    state: directory
  loop:
    - conf.d
    - templates
  loop_control:
    loop_var: dir_name
```

`loop_control.loop_var` matters when a loop is inside an `include_tasks` that itself contains another loop — without renaming, the inner loop's `item` would shadow the outer one.

## Keeping Output Readable: `label`

By default, Ansible prints the **whole item** for every iteration. For a list of dictionaries that's noisy, and if an item contains a password or token it's a leak:

```yaml
- name: Create database users
  community.postgresql.postgresql_user:
    name: "{{ item.name }}"
    password: "{{ item.password }}"
  loop: "{{ db_users }}"
  loop_control:
    label: "{{ item.name }}"      # prints (item=checkout), not the whole dict
  no_log: true
```

`label` only changes what's displayed; `no_log` is still what keeps the secret out of results and logs.

## Retrying Until Something Is Ready: `until`

A different kind of loop: repeat **one** task until a condition holds. This is the standard way to wait for a service after a restart, or for an API to report a job finished:

```yaml
- name: Wait for the app to report healthy after the restart
  ansible.builtin.uri:
    url: http://localhost:8080/healthz
    return_content: true
  register: health
  until: health.status == 200 and (health.json.status | default('')) == 'ok'
  retries: 20
  delay: 3          # 20 × 3 s = give up after about a minute
```

The task fails only if the condition is still false after the last retry. To wait for a port to open, `ansible.builtin.wait_for: port=8080` is simpler.

## `loop` vs. Legacy `with_*`

```yaml
# Legacy — still works, avoid in new playbooks
- ansible.builtin.package:
    name: "{{ item }}"
  with_items:
    - nginx
    - curl

# Modern — use this
- ansible.builtin.package:
    name: "{{ item }}"
  loop:
    - nginx
    - curl
```

`with_items` and its siblings (`with_dict`, `with_fileglob`, ...) were Ansible's original looping mechanism, each backed by a different "lookup plugin" with its own quirks. `loop` (paired with a Jinja2 filter when you need `with_dict`-style behavior — `loop: "{{ my_dict | dict2items }}"`) is the single, more predictable modern replacement. Both still work; only `loop` should appear in new code.

## Common Mistakes

- Using `with_items`/`with_dict` in new playbooks out of habit or copied examples.
- Looping over hundreds of items expecting parallelism — by default, loop iterations run **sequentially** within a single host/task; see [Async and Poll](../playbook-engineering/05-async-and-poll.md) for genuinely parallel per-item work.
- Nesting loops without renaming `loop_var`, causing the inner loop to silently overwrite the outer `item`.
- Looping over a list of dictionaries that contain secrets without `no_log`, so every iteration prints them.
- Installing packages one per loop iteration. `ansible.builtin.package` and `apt`/`dnf` accept a list in `name:` and install everything in one transaction, which is much faster.

## Interview Questions

- What's the difference between `loop` and `with_items`?
- Does a `loop` run its iterations in parallel or sequentially by default?
- When would you use `loop_control.loop_var`?

## Next

Continue to [Handlers](08-handlers.md).
