---
title: "Fix Ansible YAML Errors and Undefined Variables"
icon: lucide/file-warning
description: Diagnosing Ansible YAML parse errors and undefined-variable failures — reading the line/column error, and the fastest way to trace a variable's source.
tags:
  - Ansible
  - Troubleshooting
  - YAML
---

# YAML and Variable Errors

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

These two error categories both surface **before** a task ever reaches a host — they're the fastest to fix, once you know where to look, and the most common first-week source of "the playbook does nothing" confusion.

## What It Will Cover

- Reading a YAML parser's line/column error precisely — it often points slightly *after* the real mistake (a missing colon or bad indentation one line earlier is a common false trail)
- `ansible-playbook --syntax-check` as the fastest zero-risk first check on any edited playbook
- `'dict object' has no attribute 'X'` — usually a typo in a variable/dictionary key, or a variable that's a different shape than assumed; pair with `ansible.builtin.debug: var=` on the parent object to inspect its real shape
- `'X' is undefined` — tracing which of the [variable sources](../variables-and-data/index.md) was expected to provide it, using `ansible-inventory --host <name>` per [Variable Precedence](../variables-and-data/02-variable-precedence.md)
- The YAML "Norway problem" (`no`/`yes`/country codes parsing as booleans) surfacing as a confusing type error deep in a task, not at parse time

## Interview Questions

- A task fails with `'X' is undefined` — what's your process for finding where it should have come from?
- Why does a YAML syntax error sometimes point to the wrong line?

## Next

Continue to [Module and Execution Errors](04-module-and-execution-errors.md).
