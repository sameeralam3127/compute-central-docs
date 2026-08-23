---
title: "Ansible when Conditional: Syntax and Examples"
icon: lucide/git-fork
description: Ansible conditionals with when — skipping or running tasks based on facts, variables, and registered results.
tags:
  - Ansible
  - Core Concepts
  - Conditionals
---

# Conditionals

## What You'll Learn

- How `when:` decides whether a task runs
- Common conditional patterns using facts and registered results
- How `when:` interacts with loops

## Minimal Example

```yaml
- name: Install nginx only on Debian-family hosts
  ansible.builtin.package:
    name: nginx
    state: present
  when: ansible_facts['os_family'] == "Debian"
```

`when:` is evaluated **per host**, fresh, every time the task is reached — not computed once for the whole play.

## Practical Example — Gating on a Registered Result

```yaml
- name: Check if the app is already deployed
  ansible.builtin.stat:
    path: /opt/app/current
  register: app_check

- name: Deploy the app
  ansible.builtin.copy:
    src: app.tar.gz
    dest: /opt/app/current
  when: not app_check.stat.exists
```

`register` captures a task's result; a later `when:` reads it. This is the standard pattern for "only do this if that other thing hasn't already happened."

## Combining Conditions

```yaml
when:
  - ansible_facts['os_family'] == "Debian"
  - ansible_facts['distribution_major_version'] | int >= 20
```

A YAML **list** under `when:` is an implicit AND. For OR, use Jinja2's `or` directly:

```yaml
when: ansible_facts['distribution'] == "Ubuntu" or ansible_facts['distribution'] == "Debian"
```

## `when:` With `loop`

```yaml
- name: Only install packages that are Debian-specific
  ansible.builtin.package:
    name: "{{ item }}"
    state: present
  loop:
    - nginx
    - ufw
  when: ansible_facts['os_family'] == "Debian"
```

The condition is re-evaluated for **every item**, not once for the whole loop.

## Common Mistakes

- Wrapping the condition in `{{ }}` — `when:` is already Jinja2-evaluated; `when: "{{ x == 1 }}"` works but is redundant and non-idiomatic. Write `when: x == 1`.
- Forgetting a `when:` on a loop is checked per item, leading to surprise when only some items run.
- Gating a privilege-escalated (`become: true`) task on a condition that's wrong — a bad `when:` can skip a needed security control just as easily as skip a harmless one. Treat conditional logic on sensitive tasks with the same review rigor as the task itself.

## Interview Questions

- Is `when:` evaluated once per play or once per host per task?
- How do you express AND vs. OR in a `when:` condition?
- How does `when:` interact with `loop`?

## Next

Continue to [Loops](07-loops.md).
