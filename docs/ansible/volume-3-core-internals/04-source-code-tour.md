---
icon: lucide/code-2
description: A guided tour of the ansible-core source code — the execution engine, CLI, Task Queue Manager, strategy plugins, executor, inventory manager, variable manager, module loader, connection plugins, and Python package structure.
tags:
  - Ansible
  - Volume 3
  - Source Code
---

# Part 19 — Source Code Tour

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

Everything in this volume so far has been behavior. This chapter maps that behavior onto the actual `ansible-core` Python package (`github.com/ansible/ansible`), so the reader can go read (or patch) the real implementation.

## Why This Exists

- This is the bridge chapter into Volume 5 (writing modules/plugins, contributing) — knowing where things live in the source is a prerequisite for both debugging deeply and contributing upstream.

## Problem Statement

- The `ansible-core` repository is large; without a map, new contributors and curious engineers don't know where "the thing that does X" actually lives.

## Internal Architecture — Python Package Structure

- `lib/ansible/cli/` — entry points for `ansible`, `ansible-playbook`, `ansible-vault`, etc. (thin argument-parsing wrappers).
- `lib/ansible/executor/` — the Task Queue Manager, `PlayIterator`, `task_executor.py`, `process/worker.py` — the actual execution engine.
- `lib/ansible/plugins/strategy/` — `linear.py`, `free.py`, `debug.py` — the strategy plugin implementations.
- `lib/ansible/inventory/` — `InventoryManager`, `Group`, `Host` — inventory parsing and the host/group graph.
- `lib/ansible/vars/` — `VariableManager` and the precedence-resolution logic from Volume 2, Part 9.
- `lib/ansible/plugins/loader.py` — the module/plugin loader that resolves FQCNs to actual code across `ansible-core` and installed collections.
- `lib/ansible/plugins/connection/` — `ssh.py`, `local.py`, `winrm.py`, `paramiko_ssh.py` — connection plugin implementations.
- `lib/ansible/modules/` — the small set of modules still shipped directly in `ansible-core` (most content now lives in collections).
- `lib/ansible/parsing/` — the YAML loader (Volume 1, Part 4) and data-postprocessing/validation logic.
- `lib/ansible/playbook/` — the `Play`, `Task`, `Block`, `Role` Python classes that a parsed playbook becomes.

## Workflow

- Tracing one real behavior end to end through the source: following `ansible-playbook`'s entry point (`cli/playbook.py`) into `executor/playbook_executor.py`, into the TQM, into a strategy plugin, into `task_executor.py`, into a connection plugin — matching this chapter's map onto Part 16's runtime trace.

## Step-by-Step Explanation

- How to clone the repository, check out a released tag matching your installed `ansible-core` version, and set up a read-only local checkout for source-diving (distinct from the full contributor dev setup in Volume 5's contributing chapter).
- Using `git blame`/`git log` on a specific file (e.g., `executor/task_executor.py`) to find the PR/discussion that introduced a specific piece of behavior — useful for understanding *why*, not just *what*.

## Production Best Practices

- Reading source before filing a bug report, to confirm the behavior is actually unexpected rather than documented-but-surprising.

## Common Mistakes

- Assuming all modules live in the core repository — most now live in separate collection repositories under the `ansible-collections` GitHub organization.
- Reading source from a different `ansible-core` version than the one actually installed, and being confused when behavior doesn't match.

## Performance Considerations

- N/A directly — this chapter is navigational, not runtime-behavioral.

## Security Considerations

- N/A directly — security-relevant source locations are cross-referenced from Volume 6's security chapter instead (e.g., vault implementation, become/privilege-escalation code paths).

## Interview Questions

- "Where in the ansible-core source would you look to understand how tasks get distributed across forks?"
- "Why do most Ansible modules no longer live in the ansible-core repository?"
- "How would you confirm which version of ansible-core source matches your installed CLI version?"

## Hands-On Lab

- Clone `ansible/ansible`, check out the tag matching your local `ansible --version` output, and locate the exact function responsible for rendering a task's `changed`/`ok`/`failed` status in the default callback plugin.

## Summary

- The behavior traced in Part 16 maps directly onto real files: `executor/` for the engine, `plugins/strategy/` for scheduling, `plugins/connection/` for transport, and `plugins/loader.py` for resolving what runs — this map is the foundation for Volume 5's module/plugin development chapters.

## Next

Volume 3 is complete. Continue to [Volume 4: Enterprise Automation Platform (AAP)](../volume-4-enterprise-automation-platform/index.md).
