---
title: "Ansible Playbooks, Plays, and Tasks Explained"
icon: lucide/scroll-text
description: The structure of an Ansible playbook — playbooks, plays, and tasks — hosts, become, pre_tasks/post_tasks, and how they nest.
tags:
  - Ansible
  - Core Concepts
  - Playbooks
---

# Playbooks, Plays, and Tasks

## What You'll Learn

- The three-level structure: playbook → play(s) → task(s)
- The keywords that decide what runs, on which hosts, in what order
- How this scales past a single flat task list

## Mental Model

```mermaid
flowchart TD
    P[Playbook: site.yml] --> Play1[Play: Configure web servers]
    P --> Play2[Play: Configure db servers]
    Play1 --> T1[Task: Install nginx]
    Play1 --> T2[Task: Deploy config]
    Play1 --> T3[Task: Start service]
    Play2 --> T4[Task: Install postgresql]
    Play2 --> T5[Task: Initialize database]
```

- A **playbook** is a YAML file containing one or more plays.
- A **play** maps a group of hosts to a set of tasks (and optionally roles) — it's the unit that has its own `hosts:`, `become:`, and `vars:`.
- A **task** calls exactly one module with specific arguments.

## Minimal Example

```yaml
---
- name: Configure web servers
  hosts: web
  become: true
  tasks:
    - name: Install nginx
      ansible.builtin.package:
        name: nginx
        state: present
```

## Practical Example — Multiple Plays, Ordering Keywords

```yaml
---
- name: Preflight checks on every host
  hosts: all
  tasks:
    - name: Ensure disk space is sufficient
      ansible.builtin.command: df -h /
      register: disk_check
      changed_when: false

- name: Configure web servers
  hosts: web
  become: true
  pre_tasks:
    - name: Update package cache
      ansible.builtin.package:
        update_cache: true
  roles:
    - nginx
  post_tasks:
    - name: Confirm nginx responds
      ansible.builtin.uri:
        url: "http://localhost"
        status_code: 200

- name: Configure database servers
  hosts: db
  become: true
  roles:
    - postgresql
```

- `pre_tasks` / `post_tasks` run before/after `roles:`, regardless of what's inside the role — useful for "always check X before this role runs" logic that shouldn't live inside the role itself.
- Plays run **in order**, top to bottom, each against its own `hosts:` pattern.
- Within a play, by default (the `linear` strategy), Ansible runs each task on **all** targeted hosts before moving to the next task — not host-by-host sequentially. See [Forks, Serial, Strategy](../advanced-execution/01-forks-serial-strategy-throttle.md).

## Key Play-Level Keywords

| Keyword | Purpose |
|---|---|
| `hosts` | Target pattern (see [Inventory](01-inventory.md)) |
| `become` | Escalate privilege for this play's tasks |
| `vars` | Play-scoped variables |
| `gather_facts` | Whether to run the implicit `setup` module first (default: `true`) |
| `pre_tasks` / `tasks` / `post_tasks` | Ordered task groups around `roles:` |
| `serial` | Batch size for rolling execution — see [Advanced Execution](../advanced-execution/index.md) |
| `strategy` | `linear` (default) vs. `free` — see [Advanced Execution](../advanced-execution/index.md) |

## Common Mistakes

- Assuming tasks run host-by-host from top to bottom — the default is task-by-task, across the whole batch of hosts, which surprises people used to imperative scripting.
- Putting everything in one giant play instead of splitting by host group and responsibility.
- Setting `gather_facts: true` (the default) on plays that never use facts — wasted time on every run at scale. See [Performance](../production-engineering/05-performance.md).

## Interview Questions

- What's the difference between a playbook, a play, and a task?
- What do `pre_tasks` and `post_tasks` let you do that `tasks` alone can't?
- Does Ansible run task-by-task or host-by-host by default?

## Next

Continue to [Modules](04-modules.md) — the thing every task actually calls.
