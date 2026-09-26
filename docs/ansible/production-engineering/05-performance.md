---
title: "Ansible Performance Tuning Guide"
icon: lucide/gauge
description: Ansible performance tuning end to end — forks, pipelining, ControlPersist, fact caching, strategy, and scaling to thousands of hosts.
tags:
  - Ansible
  - Production
  - Performance
---

# Performance

## What You'll Learn

- The five highest-leverage performance settings, in the order to try them
- Why raising `forks` alone isn't enough at real scale
- What actually changes once you're managing thousands of hosts, not dozens

## Why Ansible's Defaults Are Conservative

`forks=5`, no pipelining, facts gathered on every play — Ansible's out-of-the-box defaults are tuned for **correctness on an unknown environment**, not speed on a known one. (SSH connection reuse through `ControlPersist` is already on by default, as long as you don't override `ssh_args` without it.) A playbook that takes two minutes against 10 hosts can take hours against 2,000 with the same untouched defaults. Closing that gap deliberately is what this page is about.

## The Core Levers, in Order of Leverage

1. **`forks`** — the parallelism ceiling per task. Raise it to match control-node headroom (CPU, memory, open file descriptors) and real target capacity. See [Forks, Serial, Strategy, and Throttle](../advanced-execution/01-forks-serial-strategy-throttle.md) for the full mental model.
2. **Pipelining** — eliminates the "copy module file, then execute" round trip in favor of piping module code directly. One of the single highest-leverage settings available, and free once `requiretty` is disabled in sudoers on the managed nodes.
3. **SSH multiplexing (`ControlPersist`)** — reuses one SSH connection across every task in a run instead of a fresh handshake per task. Configured via `ssh_args` in [ansible.cfg](02-ansible-cfg.md).
4. **Fact caching** — skips re-gathering facts on every run when they haven't meaningfully changed. See [Fact Caching](../advanced-execution/02-fact-caching.md).
5. **Strategy** — `free` lets fast hosts proceed without waiting on stragglers, at the cost of losing strict per-task ordering across hosts. Only correct when a play has no real cross-host ordering dependency.

## Before / After

```ini title="ansible.cfg — before"
[defaults]
forks = 5
```

```ini title="ansible.cfg — after"
[defaults]
forks = 20

[ssh_connection]
pipelining = True
ssh_args = -o ControlMaster=auto -o ControlPersist=60s
```

A playbook gathering facts and installing one package across 200 hosts, with default settings, processes hosts in batches of 5 and, for every task, creates a remote temp directory, uploads the module file, runs it, and cleans up. With the tuned config above, the same run uses batches of 20 and pipes each module straight into the remote Python in one operation — routinely several times faster on a real fleet, though the exact multiplier depends on network latency and target host load.

Measure instead of guessing. Enable the task profiler and the slowest tasks are listed at the end of every run:

```ini title="ansible.cfg"
[defaults]
callbacks_enabled = ansible.posix.profile_tasks, ansible.posix.timer
```

```text
Thursday 24 September 2026  10:42:17 +0000 (0:00:41.220)       0:03:12.004 *****
===============================================================================
common : Install base packages ----------------------------------------- 41.22s
Gathering Facts --------------------------------------------------------- 18.90s
nginx : Render vhosts ---------------------------------------------------- 9.31s
```

Here a per-item package loop is the real problem. Passing the whole list to one `package` task fixes more than any `forks` change would.

## Scaling to Thousands of Hosts

- Combine high `forks`, pipelining, `ControlPersist`, and fact caching as the baseline — before reaching for anything more exotic.
- Use `serial` (see [Playbooks, Plays, and Tasks](../core-concepts/03-playbooks-plays-tasks.md)) to batch extremely large runs, not just for blast-radius control but because a single control node has real ceilings on concurrent SSH connections and in-flight result memory.
- Beyond a single control node's ceiling, distribute execution across multiple control/execution nodes rather than scaling one node vertically forever — this is what Red Hat Ansible Automation Platform's Automation Mesh is built for, if that's part of the stack.

## A Note on Mitogen

You may see **Mitogen** referenced in Ansible performance discussions — a third-party strategy plugin that keeps a persistent Python interpreter on each target, avoiding repeated interpreter startup cost. It can still be a real speedup, but it hooks deep into Ansible internals, has historically lagged behind new `ansible-core` releases, and isn't supported in Automation Platform. Check its compatibility with your exact `ansible-core` version before depending on it; for most teams, pipelining plus the settings above get most of the benefit with none of the risk.

## Common Mistakes

- Raising `forks` without also checking SSH/OS-level connection limits on the control node — hitting a file-descriptor or connection-count wall unrelated to Ansible itself.
- Enabling pipelining without disabling `requiretty` in sudoers — produces `become` failures that look unrelated to the actual cause.
- Assuming `strategy: free` is always faster — for a play with real cross-host ordering dependencies, it produces **incorrect behavior**, not just different timing.
- Tuning `forks`/pipelining while leaving `gather_facts: true` (the default) on plays that never reference a fact — wasted time that neither setting fixes.

## Interview Questions

- What are the highest-leverage Ansible performance settings, and in what order would you try them?
- How would you scale Ansible to manage 10,000 hosts?
- What was Mitogen, and why is it less commonly used today?

See the full reasoning walkthrough in [Interview Prep: Scenario-Based Questions](../interview-prep/03-scenario-based-questions.md).

## Next

Continue to [CI/CD and Linting](06-cicd-and-linting.md).
