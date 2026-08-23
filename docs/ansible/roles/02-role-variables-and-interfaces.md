---
title: "Ansible Role Variables and Defaults Design"
icon: lucide/plug-zap
description: Designing a role's public interface through defaults, and documenting what a role expects versus what it provides.
tags:
  - Ansible
  - Roles
---

# Role Variables and Interfaces

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

A well-designed role has a clear "contract" — what a consumer must set, what's optional with sensible defaults, and what's genuinely internal — the same discipline as designing a function signature, applied to `defaults/main.yml`.

## What It Will Cover

- Treating `defaults/main.yml` as a documented public interface, with comments explaining each variable's purpose and valid values
- Namespacing role variables (`nginx_http_port`, not `http_port`) to avoid collisions when multiple roles are included in the same play
- README-documented required vs. optional variables
- Passing variables into a role explicitly at the point of inclusion vs. relying on `group_vars`
- How role variable scope interacts with [Variable Precedence](../variables-and-data/02-variable-precedence.md) when the same role is included twice with different variables

## Common Mistakes

- Unnamespaced role variables (`port` instead of `nginx_port`) colliding with another role's variable of the same name.
- A role with no documented interface — consumers have to read `tasks/main.yml` to discover what's configurable.

## Interview Questions

- Why namespace role variables instead of using short, generic names?
- How would you document a role's required vs. optional variables for other teams to consume it safely?

## Next

Continue to [Production Role Design](03-production-role-design.md).
