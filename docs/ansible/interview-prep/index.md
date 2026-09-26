---
title: "Ansible Interview Questions and Answers"
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

## Most Common Ansible Interview Questions, Answered Briefly

**What is Ansible, and why is it called agentless?**
An automation tool that connects to managed nodes over SSH (WinRM or PSRP for Windows), copies a small module program to each host, runs it, and removes it. Nothing stays installed or running on the nodes, which only need Python. [What Is Ansible?](../getting-started/01-what-is-ansible.md)

**Is Ansible declarative or imperative?**
Tasks are declarative (they describe an end state), while a playbook runs tasks in order like a procedure. [Idempotency](../core-concepts/11-idempotency.md)

**What does idempotent mean in Ansible?**
Running the same playbook twice leaves the host in the same state, and the second run reports no changes. [Idempotency](../core-concepts/11-idempotency.md)

**Which variables win in precedence?**
Extra vars passed with `-e` always win; role `defaults/` always lose. [Variable Precedence](../variables-and-data/02-variable-precedence.md)

**What's the difference between `import_tasks` and `include_tasks`?**
`import_tasks` is static and processed when the playbook is parsed; `include_tasks` is dynamic and processed when the task runs, so it can use loops and runtime variables. [Imports vs. Includes](../playbook-engineering/03-imports-vs-includes.md)

**What's the difference between `forks` and `serial`?**
`forks` caps how many hosts run a task at the same time; `serial` splits a play into batches of hosts for rolling updates. [Forks, Serial, Strategy, and Throttle](../advanced-execution/01-forks-serial-strategy-throttle.md)

**When do handlers run?**
Once, after the tasks in the current section of the play finish, and only if a task that reported `changed` notified them. `meta: flush_handlers` runs them earlier. [Handlers](../core-concepts/08-handlers.md)

**`command` vs `shell`?**
`command` runs a program directly with no shell; `shell` runs through `/bin/sh`, so pipes, redirects, and variables work, at the cost of injection risk. [Command vs. Shell vs. Raw vs. Script](../modules/01-command-vs-shell-vs-raw-vs-script.md)

**What changed in ansible-core 2.19?**
Templating was rebuilt: conditionals must evaluate to real booleans, templates embedded inside `when:` expressions are rejected, and values that arrive at run time are never treated as templates. [Upgrade errors after 2.19](../troubleshooting/03-yaml-and-variable-errors.md#upgrade-errors-after-ansible-core-219)

**How do you handle secrets?**
Encrypt them with Ansible Vault or fetch them from a secret manager with a lookup, and set `no_log: true` on tasks that handle them. [Secrets and Vault](../production-engineering/03-secrets-and-vault.md)

**What's the difference between ansible-core, AWX, and AAP?**
`ansible-core` is the engine; AWX is the open-source web UI and API around it (its releases have been paused since 2024); AAP is Red Hat's supported product built from AWX, which adds Automation Hub, Execution Environments, and Event-Driven Ansible. [ansible-core vs. ansible vs. AAP](../enterprise-platform/01-ansible-core-vs-ansible-vs-aap.md)

## Next

Start with [Core Concepts](01-core-concepts-questions.md).
