---
icon: lucide/bell
description: Ansible handlers and notify — running a follow-up action only when a task actually changed something, deduplicated, at the end of a play.
tags:
  - Ansible
  - Core Concepts
  - Handlers
---

# Handlers

## What You'll Learn

- How `notify:` and `handlers:` work together
- Why handlers run at the *end* of a play, not immediately
- The "restart, but only if config changed" pattern

## Mental Model

A handler is a task that only runs when another task **notifies** it, and only if that task actually reported `changed`. Multiple tasks can notify the same handler in one play — it still only runs **once**, and only **after** all regular tasks in the play have finished.

## Minimal Example

```yaml
- name: Configure nginx
  hosts: web
  become: true

  tasks:
    - name: Deploy nginx configuration
      ansible.builtin.template:
        src: nginx.conf.j2
        dest: /etc/nginx/nginx.conf
      notify: Restart nginx

  handlers:
    - name: Restart nginx
      ansible.builtin.service:
        name: nginx
        state: restarted
```

- If `nginx.conf.j2` renders identically to the file already on disk, `template` reports `ok`, no `notify` fires, and nginx is never restarted.
- If the file changes, `template` reports `changed`, `notify` fires, and `Restart nginx` runs once — even if three other tasks in the same play also notify it.

## Why This Matters

Without handlers, every task that might change a config would need its own conditional restart logic bolted on. Handlers separate "did the config change" (the task's job) from "does the service need to notice" (the handler's job) — and guarantee the restart happens exactly once per play, not once per notifying task.

## Common Mistakes

- Expecting the handler to run **immediately** when `notify` fires — it runs at the **end of the play** (or end of the block, on modern Ansible) by default, not synchronously. If a later task in the same play depends on the service already being restarted, that dependency will break.
- Writing a separate unconditional "restart the service" task instead of a handler — this restarts the service on *every* run, defeating idempotency.
- Notifying a handler name that doesn't match exactly (handler names are matched as plain strings, not module names).

## Interview Questions

- When does a notified handler actually run — immediately, or at the end of the play?
- What happens if three different tasks notify the same handler in one play?
- Why is a handler the right tool for "restart the service if the config changed," instead of a plain task?

## Next

Continue to [Tags](09-tags.md).
