---
title: "Ansible when Conditionals: If/Else, AND, OR, and NOT Examples"
icon: lucide/git-fork
description: "Ansible when conditional examples — if/else logic, multiple conditions with and/or/not, facts, registered results, and when with loops."
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

For NOT, use `not`, `!=`, or a negated test:

```yaml
when: not maintenance_mode
when: env != "production"
when: app_version is not defined
```

## If/Else in Ansible

Ansible has no `if`/`else` keyword for tasks. Pick the form that fits what you're choosing:

**Choosing a value.** Use a Jinja2 inline `if`:

```yaml
- name: Pick the web server package for this OS family
  ansible.builtin.set_fact:
    web_package: "{{ 'apache2' if ansible_facts['os_family'] == 'Debian' else 'httpd' }}"
```

**Running one task or another.** Write two tasks with opposite conditions:

```yaml
- name: Start the service in production
  ansible.builtin.service:
    name: checkout
    state: started
  when: env == "production"

- name: Stop the service everywhere else
  ansible.builtin.service:
    name: checkout
    state: stopped
  when: env != "production"
```

**Running one group of tasks or another.** Put the `when:` on a [block](../playbook-engineering/01-blocks-rescue-always.md), which applies it to every task inside.

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
