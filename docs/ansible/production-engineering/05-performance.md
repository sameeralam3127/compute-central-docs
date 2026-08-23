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

`forks=5`, no pipelining, host key checking on — Ansible's out-of-the-box defaults are tuned for **correctness on an unknown environment**, not speed on a known one. A playbook that takes two minutes against 10 hosts can take hours against 2,000 with the same untouched defaults. Closing that gap deliberately is what this page is about.

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

A playbook gathering facts and installing one package across 200 hosts, with default settings, processes hosts in batches of 5 with a fresh SSH handshake and full module-file transfer for every task. With the tuned config above, the same run uses batches of 20, reuses connections, and pipes modules directly — the difference is routinely several times faster on a real fleet, though the exact multiplier depends on network latency and target host load.

## Scaling to Thousands of Hosts

- Combine high `forks`, pipelining, `ControlPersist`, and fact caching as the baseline — before reaching for anything more exotic.
- Use `serial` (see [Playbooks, Plays, and Tasks](../core-concepts/03-playbooks-plays-tasks.md)) to batch extremely large runs, not just for blast-radius control but because a single control node has real ceilings on concurrent SSH connections and in-flight result memory.
- Beyond a single control node's ceiling, distribute execution across multiple control/execution nodes rather than scaling one node vertically forever — this is what Red Hat Ansible Automation Platform's Automation Mesh is built for, if that's part of the stack.

## A Note on Mitogen

You may see **Mitogen** referenced in older Ansible performance discussions — a third-party strategy plugin that kept a persistent Python interpreter and connection state on the control node, avoiding repeated interpreter startup cost. It was a meaningful speedup at the time. As pipelining and `ControlPersist` matured in Ansible core, and Mitogen's own maintenance slowed, its relevance faded — worth knowing the name if it comes up, not something to reach for by default today.

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
