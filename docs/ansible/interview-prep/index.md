---
icon: lucide/graduation-cap
description: Ansible interview preparation, organized by subject and by level — every question ties back to a real concept page, not a memorized answer list.
tags:
  - Ansible
  - Interview Preparation
---

# Interview Preparation

Every question on the pages below links back to the concept page that actually teaches it. That's deliberate: memorizing "role defaults are lowest precedence" is worth far less than understanding *why* — which is the difference between passing a screening question and holding up under a senior follow-up.

## How This Is Organized

By **subject**, since that's how you'll actually study:

1. [Core Concepts](01-core-concepts-questions.md) — idempotency, precedence, modules, command vs. shell
2. [Architecture & Performance](02-architecture-and-performance-questions.md) — execution model, SSH, forks/strategy
3. [Scenario-Based Questions](03-scenario-based-questions.md) — reasoning through an open-ended production problem, not a fact lookup
4. [Roles, Collections & Modules](04-roles-collections-and-modules-questions.md)
5. [Senior & Architect Questions](05-senior-and-architect-questions.md)

## By Level, Roughly

| Level | Where to focus |
|---|---|
| Beginner | [Core Concepts](01-core-concepts-questions.md) — first half |
| Intermediate | [Core Concepts](01-core-concepts-questions.md) full, [Roles, Collections & Modules](04-roles-collections-and-modules-questions.md) |
| Advanced | [Architecture & Performance](02-architecture-and-performance-questions.md) |
| Senior / Architect | [Scenario-Based Questions](03-scenario-based-questions.md), [Senior & Architect Questions](05-senior-and-architect-questions.md) |

!!! tip "How senior interviews actually differ"
    A senior interview rarely asks "what is `forks`" in isolation — it asks you to *reason* through a situation ("2-hour playbook run, 500 hosts, go") using several concepts at once. [Scenario-Based Questions](03-scenario-based-questions.md) is built around exactly that shape.

## Next

Start with [Core Concepts](01-core-concepts-questions.md).
