---
title: "Ansible when Conditionals: If/Else, AND, OR Examples"
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
when: not (maintenance_mode | bool)
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

## Conditionals Must Be Booleans (ansible-core 2.19+)

Older Ansible treated any "truthy" value as true: a non-empty string, a non-empty list, the number 1. Since `ansible-core` 2.19, a `when:` (and `changed_when:`, `failed_when:`, `until:`, `assert` `that:`) must evaluate to an actual `true` or `false`. Anything else fails the task:

```text
fatal: [web01]: FAILED! => {"msg": "Conditional result (True) was derived from value of type 'str' at '...'. Conditionals must have a boolean result."}
```

The most common real-world triggers, and their fixes:

```yaml
# A flag passed on the command line: -e maintenance_mode=false
# Values from -e key=value are strings, so this is the string "false"
when: maintenance_mode                     # breaks on 2.19+
when: maintenance_mode | bool              # works everywhere

# "Is this list non-empty?"
when: pending_migrations                   # breaks: a list is not a boolean
when: pending_migrations | length > 0      # explicit

# "Did the command print anything?"
when: check_result.stdout                  # breaks: a string is not a boolean
when: check_result.stdout | length > 0

# "Is this variable set to something?"
when: db_host                              # breaks
when: db_host is defined and db_host | length > 0
```

Every fix is also clearer to read, because it says which question is being asked.

## Common Mistakes

- Wrapping the condition in `{{ }}` — `when:` is already a Jinja2 expression. `when: "{{ x == 1 }}"` triggers a warning, and templates embedded *inside* a larger expression (`when: "{{ env }} == 'prod'"`) fail outright on `ansible-core` 2.19+. Write `when: x == 1` and `when: env == 'prod'`.
- Relying on truthiness (`when: some_list`, `when: some_string`) — it fails on `ansible-core` 2.19+; compare explicitly or use `| bool`.
- Forgetting a `when:` on a loop is checked per item, leading to surprise when only some items run.
- Gating a privilege-escalated (`become: true`) task on a condition that's wrong — a bad `when:` can skip a needed security control just as easily as skip a harmless one. Treat conditional logic on sensitive tasks with the same review rigor as the task itself.

## Interview Questions

- Is `when:` evaluated once per play or once per host per task?
- How do you express AND vs. OR in a `when:` condition?
- How does `when:` interact with `loop`?
- Why does `when: maintenance_mode` fail after upgrading to `ansible-core` 2.19 when the value came from `-e`?

## Next

Continue to [Loops](07-loops.md).
