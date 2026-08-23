---
icon: lucide/box
description: Ansible interview questions on roles, collections, and custom modules, with concise answers and links to the full concept pages.
tags:
  - Ansible
  - Interview Preparation
---

# Interview Prep: Roles, Collections & Modules

!!! info "Section status: outline"
    This page lists the questions with concise answers; the full leveled treatment (misconceptions, senior follow-ups) will be filled in alongside the other interview pages.

## Roles

- What is the standard directory structure of an Ansible role? — see [Role Structure](../roles/01-role-structure.md)
- What's the practical difference between `defaults/main.yml` and `vars/main.yml`? — see [Role Structure](../roles/01-role-structure.md#defaults-vs-vars-the-roles-public-interface)
- How do role dependencies in `meta/main.yml` work, and what's the risk if not guarded correctly? — see [Role Structure](../roles/01-role-structure.md)
- Why namespace role variables instead of using short, generic names? — see [Role Variables and Interfaces](../roles/02-role-variables-and-interfaces.md)

## Collections

- What's the difference between a role and a collection? — see [Collections](../collections/index.md)
- What does `galaxy.yml` declare, and why does it matter for dependency resolution? — see [Collection Structure](../collections/01-collection-structure.md)
- Why should collection versions be pinned in `requirements.yml` rather than installed ad hoc? — see [Installing and Using Collections](../collections/02-installing-and-using-collections.md)

## Custom Modules

- What does a module have to do to correctly support check mode — not just declare it? — see [Build a Custom Module](../build-your-own/01-build-a-custom-module.md)
- How does `argument_spec` relate to both input validation and `ansible-doc`'s generated documentation? — see [Build a Custom Module](../build-your-own/01-build-a-custom-module.md)
- What changes — and what doesn't — when a standalone `library/` module gets moved into a collection? — see [Build a Collection From Zero](../build-your-own/03-build-a-collection-from-zero.md)

## Next

Continue to [Senior & Architect Questions](05-senior-and-architect-questions.md).
