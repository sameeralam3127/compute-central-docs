---
title: "Ansible Tags: Run Part of a Playbook with --tags"
icon: lucide/tag
description: Ansible tags — running or skipping part of a playbook with --tags and --skip-tags, without editing the file.
tags:
  - Ansible
  - Core Concepts
---

# Tags

## What You'll Learn

- How to tag tasks, blocks, plays, and roles
- How `--tags`, `--skip-tags`, and `--list-tags` filter a run
- What the special `always` and `never` tags do
- Why tags behave differently on `import_*` and `include_*`

## Why This Exists

A large playbook shouldn't need editing just to run a subset of it during debugging or a partial deploy — tags give every task, block, or role a label that `--tags`/`--skip-tags` can filter on at run time.

## Mental Model

> Tags are labels you attach at write time and filter on at run time. With no tag options, **every** task runs (except those tagged `never`). With `--tags`, only matching tasks run. With `--skip-tags`, matching tasks are removed from whatever would otherwise run.

## Tagging Tasks, Blocks, Plays, and Roles

```yaml title="site.yml"
- name: Configure web servers
  hosts: web
  become: true
  tags: [web]                         # applies to everything in the play

  tasks:
    - name: Install nginx
      ansible.builtin.package:
        name: nginx
        state: present
      tags: [packages]

    - name: Configure nginx
      tags: [config]                  # applies to every task in the block
      block:
        - name: Deploy nginx.conf
          ansible.builtin.template:
            src: nginx.conf.j2
            dest: /etc/nginx/nginx.conf
          notify: Reload nginx

        - name: Deploy site vhost
          ansible.builtin.template:
            src: site.conf.j2
            dest: /etc/nginx/conf.d/site.conf
          notify: Reload nginx

    - name: Run slow smoke tests
      ansible.builtin.uri:
        url: http://localhost/healthz
      tags: [smoke, slow_checks]

  roles:
    - role: node_exporter
      tags: [monitoring]              # applies to every task in the role

  handlers:
    - name: Reload nginx
      ansible.builtin.service:
        name: nginx
        state: reloaded
```

Tags are inherited downward: a task in the `config` block has the tags `web` and `config`.

## Filtering at Run Time

```bash
# See what's available before running anything
ansible-playbook site.yml --list-tags

# Only config tasks
ansible-playbook site.yml --tags config

# Several tags (a task runs if it has ANY of them)
ansible-playbook site.yml --tags config,monitoring

# Everything except the slow checks
ansible-playbook site.yml --skip-tags slow_checks

# Preview exactly which tasks a filter selects
ansible-playbook site.yml --tags config --list-tasks
```

Combine tags with check mode for a safe, focused preview:

```bash
ansible-playbook site.yml --tags config --check --diff
```

!!! note "Handlers still run"
    Handlers aren't filtered by the tags of the task that notifies them. If `--tags config` runs a task that notifies `Reload nginx`, the handler runs even though it isn't tagged `config`.

## Special Tags

| Tag | Behavior |
|---|---|
| `always` | Runs on every invocation, even with `--tags` for something else. Skip it only with `--skip-tags always`. |
| `never` | Never runs unless one of its **other** tags is explicitly requested with `--tags`. |
| `tagged` | `--tags tagged` runs only tasks that have at least one tag. |
| `untagged` | `--tags untagged` runs only tasks with no tags. |
| `all` | The default: every task except `never`. |

A classic use of each:

```yaml
- name: Load environment variables every task depends on
  ansible.builtin.include_vars: "{{ env }}.yml"
  tags: [always]

- name: Wipe the application database (destructive, opt-in only)
  ansible.builtin.command: /opt/checkout/bin/reset-db --yes
  tags: [never, reset_db]
```

`reset_db` runs only when someone deliberately types `--tags reset_db`.

## Tags With Imports vs. Includes

This is the part that surprises people. Static imports and dynamic includes treat tags differently — see [Imports vs. Includes](../playbook-engineering/03-imports-vs-includes.md) for the underlying reason.

```yaml
# Static: the tag is copied onto EVERY task inside tasks/nginx.yml
- ansible.builtin.import_tasks: tasks/nginx.yml
  tags: [nginx]

# Dynamic: the tag applies only to the include statement itself
- ansible.builtin.include_tasks: tasks/nginx.yml
  tags: [nginx]
```

With the dynamic include, `--tags nginx` runs the include, but the tasks *inside* the file aren't tagged `nginx`, so they're skipped. To push tags into an include, use `apply`:

```yaml
- name: Include nginx tasks, tagging everything inside
  ansible.builtin.include_tasks:
    file: tasks/nginx.yml
    apply:
      tags: [nginx]
  tags: [nginx]                      # still needed, so the include itself is selected
```

The same applies to `import_role` versus `include_role`. And because includes are resolved at run time, `--list-tags` can't see tags inside included files ahead of a run.

## A Tagging Convention That Stays Useful

- Tag by **what the task does** (`packages`, `config`, `service`, `firewall`), not by who wrote it.
- Tag each role with its own name, so `--tags nginx` means the whole role.
- Keep the vocabulary short and documented in the repository README.
- Reserve `never` for destructive or expensive opt-in tasks.

## Common Mistakes

- Tagging every task with the same tag, making `--tags` filtering meaningless.
- Forgetting that `import_tasks` copies tags onto the tasks inside, while `include_tasks` tags only the include — so `--tags` silently skips everything in the included file.
- Putting setup that later tasks depend on (such as `include_vars`) behind a tag, so a filtered run fails with undefined variables — tag it `always`.
- Assuming `--skip-tags` is a safety mechanism; one untagged destructive task still runs.

## Interview Questions

- How would you run only a subset of a 200-task playbook without editing it?
- What do the `always` and `never` special tags do?
- Why does `--tags nginx` skip the tasks inside an `include_tasks` tagged `nginx`, and how do you fix it?
- If a tagged task notifies an untagged handler, does the handler run under `--tags`?

## Next

Continue to [Check Mode and Diff Mode](10-check-mode-and-diff-mode.md).
