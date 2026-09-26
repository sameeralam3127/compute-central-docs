---
title: "Ansible Handlers and notify Explained"
icon: lucide/bell
description: "An Ansible handler runs once, after the current section of the play, and only if a task that notified it changed. notify, listen, flush_handlers, and force_handlers."
tags:
  - Ansible
  - Core Concepts
  - Handlers
---

# Handlers

A handler is a task that runs **once, after the current section of the play finishes**, and only when a task that notified it actually reported `changed`. That is what makes "restart nginx only if the config changed" work.

## What You'll Learn

- How `notify:` and `handlers:` work together
- When handlers really run, and how to run them early with `meta: flush_handlers`
- The "restart, but only if config changed" pattern, with validation and `listen`
- What happens to a notified handler when a later task fails, and how `force_handlers` fixes it

## Mental Model

A handler is a task that only runs when another task **notifies** it, and only if that task actually reported `changed`. Multiple tasks can notify the same handler in one play — it still only runs **once**, and only **after** the regular tasks in the current section (`pre_tasks`, `tasks`/`roles`, or `post_tasks`) have finished.

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

## When Handlers Actually Run

Notified handlers are flushed at the end of each **section** of a play: after `pre_tasks`, after `roles` and `tasks`, and after `post_tasks`. That's why a health check in `post_tasks` sees the restarted service, and a health check later in `tasks` does not.

To run them right now, flush explicitly:

```yaml
- name: Deploy nginx configuration
  ansible.builtin.template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
    validate: nginx -t -c %s        # never write a config nginx would reject
  notify: Reload nginx

- name: Apply the reload before testing it
  ansible.builtin.meta: flush_handlers

- name: Check the new config is being served
  ansible.builtin.uri:
    url: http://localhost/healthz
    status_code: 200
```

## A Production Handler File

```yaml title="roles/nginx/handlers/main.yml"
- name: Validate nginx config
  ansible.builtin.command: nginx -t
  changed_when: false
  listen: nginx config changed

- name: Reload nginx
  ansible.builtin.service:
    name: nginx
    state: reloaded
  listen: nginx config changed
```

```yaml
- name: Deploy a vhost
  ansible.builtin.template:
    src: shop.conf.j2
    dest: /etc/nginx/conf.d/shop.conf
  notify: nginx config changed      # triggers both handlers, in file order
```

- **`listen`** lets several handlers subscribe to one topic, so tasks notify an event ("config changed") instead of knowing every step that should follow.
- **Handlers run in the order they're defined** in the handlers file, not the order they were notified, so the validation always runs before the reload.
- **`reloaded` instead of `restarted`** applies the new config without dropping in-flight connections, for services that support it (nginx, HAProxy, PostgreSQL for most settings).

## When a Later Task Fails

If a task notifies a handler and a **later** task on the same host fails, the play stops for that host and the handler never runs. The new config is on disk, but the service is still running the old one, and the next run won't notify again because the file already matches.

Fix it with `force_handlers`, which runs notified handlers even when the host fails:

```yaml
- name: Configure web servers
  hosts: web
  force_handlers: true
```

Or set `force_handlers = True` in `ansible.cfg`, or pass `--force-handlers` for a single run.

## Common Mistakes

- Expecting the handler to run **immediately** when `notify` fires — it runs at the end of the current play **section** (`pre_tasks`, `tasks`/`roles`, `post_tasks`), not synchronously. If a later task in the same section depends on the service already being restarted, use `meta: flush_handlers` first.
- Losing a notified handler because a later task failed, leaving the service on its old config with nothing left to trigger a reload — use `force_handlers`.
- Writing a separate unconditional "restart the service" task instead of a handler — this restarts the service on *every* run, defeating idempotency.
- Notifying a handler name that doesn't match exactly (handler names are matched as plain strings, not module names).

## Interview Questions

- When does a notified handler actually run — immediately, or at the end of the play?
- What happens if three different tasks notify the same handler in one play?
- Why is a handler the right tool for "restart the service if the config changed," instead of a plain task?
- A task notified a handler, then a later task failed. What state is the host in, and how do you prevent it?
- What does `listen` add over notifying a handler by name?

## Next

Continue to [Tags](09-tags.md).
