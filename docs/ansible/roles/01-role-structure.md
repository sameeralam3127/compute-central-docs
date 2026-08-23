---
icon: lucide/folder-tree
description: The standard Ansible role directory structure — tasks, handlers, defaults, vars, files, templates, and meta — and how including a role auto-wires all of it.
tags:
  - Ansible
  - Roles
---

# Role Structure

## What You'll Learn

- The standard role directory layout
- What loads automatically just from being in the right place, with no explicit `include_vars`
- How to scaffold one with `ansible-galaxy role init`

## The Standard Layout

```text
myrole/
├── tasks/
│   └── main.yml        # the role's task list
├── handlers/
│   └── main.yml         # handlers this role's tasks can notify
├── defaults/
│   └── main.yml         # lowest-precedence, freely overridable variables
├── vars/
│   └── main.yml         # higher-precedence, role-internal variables
├── files/               # static files served by copy, etc.
├── templates/            # Jinja2 templates served by template
├── meta/
│   └── main.yml          # role metadata, Galaxy info, dependencies
└── README.md
```

Scaffold it instead of building by hand:

```bash
ansible-galaxy role init myrole
```

## What Auto-Wires, With No Extra Configuration

```yaml
- name: Configure web servers
  hosts: web
  become: true
  roles:
    - myrole
```

Simply listing `myrole` under `roles:` automatically:

- runs `tasks/main.yml`
- makes `handlers/main.yml` notifiable by any task in the role
- loads `defaults/main.yml` and `vars/main.yml` — no `include_vars` needed
- makes `files/` and `templates/` the default search path for `copy`/`template` tasks inside this role's own `src:` references

## `defaults/` vs. `vars/` — the Role's Public Interface

```yaml title="defaults/main.yml"
http_port: 80
worker_connections: 768
```

```yaml title="vars/main.yml"
nginx_config_path: /etc/nginx/nginx.conf   # rarely correct to override per-consumer
```

`defaults/main.yml` is the role's **public interface** — the lowest-precedence source (see [Variable Precedence](../variables-and-data/02-variable-precedence.md)), meant to be freely overridden by anyone consuming the role. `vars/main.yml` is higher-precedence and meant for values that are genuinely internal to how the role works, not something a consumer should typically need to change.

## `meta/main.yml`

```yaml title="meta/main.yml"
galaxy_info:
  author: your-team
  description: Installs and configures nginx
  min_ansible_version: "2.15"
  platforms:
    - name: Ubuntu
      versions: [jammy, noble]

dependencies:
  - role: firewall
    vars:
      firewall_allowed_ports: [80, 443]
```

`dependencies:` pulls in another role automatically before this one runs — even for internal-only roles, an accurate `meta/main.yml` documents platform support and requirements instead of leaving them as tribal knowledge.

## Common Mistakes

- Putting environment-specific values in `vars/main.yml` instead of `defaults/main.yml`, making the role hard to reuse across projects without editing its internals.
- Building a giant role that tries to do everything (install nginx **and** manage the database **and** configure the firewall) instead of composing several focused roles.
- Missing `meta/main.yml` dependency declarations, so the role only works correctly if included in a specific, undocumented order.
- Deeply nested role dependencies without `allow_duplicates: no`, causing the same dependency role to run more than once unintentionally.

## Interview Questions

- What is the standard directory structure of an Ansible role?
- What's the practical difference between `defaults/main.yml` and `vars/main.yml`?
- How do role dependencies in `meta/main.yml` work, and what's the risk if not guarded correctly?

## Next

Continue to [Role Variables and Interfaces](02-role-variables-and-interfaces.md).
