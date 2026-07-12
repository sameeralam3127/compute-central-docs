---
icon: lucide/folder-tree
description: Ansible role structure and best practices — the standard directory layout, Galaxy role structure, and how to design reusable role architecture.
tags:
  - Ansible
  - Volume 2
  - Roles
---

# Part 12 — Roles

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

Roles are how Ansible content stops being "one big playbook" and becomes reusable, testable, shareable units. This chapter covers the standard structure and how to design roles that age well.

## Why This Exists

- Without roles, teams end up with copy-pasted task blocks across playbooks — roles exist to make automation logic reusable across projects, hosts, and teams.

## Problem Statement

- A flat playbook mixing "install nginx," "configure the firewall," and "deploy the app" in one file becomes unmaintainable past a handful of hosts or a handful of contributors.

## Internal Architecture — The Standard Role Directory Layout

```
myrole/
  tasks/main.yml       # the role's task list
  handlers/main.yml    # handlers the role's tasks can notify
  defaults/main.yml    # lowest-precedence, freely overridable variables
  vars/main.yml        # higher-precedence, role-internal variables
  files/                # static files served by copy/etc.
  templates/            # Jinja2 templates served by template
  meta/main.yml         # role metadata, Galaxy info, dependencies
  library/               # role-local custom modules (rare)
  README.md
```

- How `roles:` inclusion at the play level auto-wires this structure (`tasks/main.yml` runs, `handlers/main.yml` becomes notifiable, `defaults`/`vars` load automatically) without explicit `include_vars` calls.

## Workflow

- The load order when a play includes multiple roles: each role's `vars` and `defaults` load in sequence, task execution proceeds role by role (or interleaved with `pre_tasks`/`post_tasks` as covered in Part 11).

## Production Best Practices

- One role, one responsibility (a `nginx` role shouldn't also manage the database).
- Always populating `defaults/main.yml` with sensible values so a role works out of the box, with `vars/main.yml` reserved for values that shouldn't typically change.
- Writing a `meta/main.yml` with accurate `galaxy_info` and `dependencies` even for internal-only roles, since it documents platform support and requirements.
- Testing roles in isolation (previewed here, Molecule covered fully in Volume 5).

## Common Mistakes

- Putting environment-specific values in `vars/main.yml` instead of `defaults/main.yml`, making the role hard to reuse across projects.
- Giant monolithic roles that try to do everything instead of composing several focused roles.
- Missing `meta/main.yml` dependency declarations, causing roles to work only if included in a specific undocumented order.

## Performance Considerations

- Deeply nested role dependencies (`meta/main.yml` `dependencies:`) can cause unexpected duplicate execution if not guarded with `run_once`/`allow_duplicates: no`.

## Security Considerations

- Auditing third-party roles pulled from Galaxy before running them with `become: true` in production — a role has the same access as any other task.

## Interview Questions

- "What is the standard directory structure of an Ansible role?"
- "What's the difference between `defaults/main.yml` and `vars/main.yml`?"
- "How do role dependencies in `meta/main.yml` work?"

## Hands-On Lab

- Use `ansible-galaxy role init myrole` to scaffold a role, populate `tasks/main.yml` and `defaults/main.yml` to install and configure a package, then include it from a playbook.

## Summary

- Roles are Ansible's unit of reuse — the standard layout (`tasks`, `defaults`, `vars`, `handlers`, `meta`) is a convention worth following exactly, because tooling (Galaxy, Molecule, linting) all assumes it.

## Next

Continue to [Part 13 — Collections](07-collections.md).
