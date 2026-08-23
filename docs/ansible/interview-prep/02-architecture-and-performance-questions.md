---
title: "Ansible Interview Questions: Architecture and Performance"
icon: lucide/cpu
description: Leveled Ansible interview questions on execution architecture, SSH, forks, and strategy — with detailed answers, misconceptions, and senior follow-ups.
tags:
  - Ansible
  - Interview Preparation
---

# Interview Prep: Architecture & Performance

## Walk through what happens internally when you run `ansible all -m ping`.

**Short answer:** Inventory resolves → variables load → an SSH connection opens → the module is transferred (or piped) → it runs using the managed node's Python → it prints one JSON result to stdout → temp files are cleaned up → the result displays.

**Detailed:** Full step-by-step with a sequence diagram: [Architecture and Execution](../getting-started/02-architecture-and-execution.md).

**Common misconception:** That Ansible "compiles YAML into Python and runs it." It doesn't — YAML parses into ordinary Python data structures that the engine acts on; the module that actually executes on the managed node is a separate Python program shipped over the connection. See [YAML → Python Mental Model](../yaml-and-execution-model/02-yaml-to-python-mental-model.md).

**Senior follow-up:** "A task fails with a module-not-found-style error on one specific host but works on every other identical host — what's your first diagnostic step?" — `-vvvv` against just that host; the most common cause is a different (or missing) Python interpreter discovered on that specific target.

## Does Ansible run task-by-task or host-by-host by default?

**Short answer:** Task-by-task — every host finishes the current task before any host moves to the next one (the default `linear` strategy).

**Detailed:** [Playbooks, Plays, and Tasks](../core-concepts/03-playbooks-plays-tasks.md) and the full comparison in [Forks, Serial, Strategy, and Throttle](../advanced-execution/01-forks-serial-strategy-throttle.md).

**Common misconception:** That `strategy: free` is a strictly-better, always-faster setting. It's faster only when hosts have genuinely independent task durations *and* nothing later in the play assumes another host already finished an earlier task.

**Senior follow-up:** "You switch a play to `strategy: free` and a later task starts failing intermittently — what's the likely cause?" — a hidden cross-host ordering assumption (e.g., a task on the load balancer assuming every web server already finished updating) that `linear`'s lockstep behavior was silently protecting.

## What's the difference between `forks` and `serial`?

**Short answer:** `forks` bounds how many hosts run **simultaneously** for a given task. `serial` bounds how many hosts go through the **entire play** at once, as a rollout/blast-radius control.

**Detailed:** Full explanation with diagrams: [Forks, Serial, Strategy, and Throttle](../advanced-execution/01-forks-serial-strategy-throttle.md).

**Common misconception:** That raising `forks` makes a rollout safer. It only makes it faster — `serial` is the safety control; `forks` is a pure parallelism ceiling.

**Senior follow-up:** "With `forks: 20` and `serial: 2`, how many hosts does Ansible actually touch at once?" — 2. `serial` is the tighter constraint in that combination; `forks` only matters once a batch is larger than the fork ceiling.

## You manage 5,000 hosts and a playbook run is taking two hours. How would you investigate and improve it?

**Short answer:** Work through forks → gather_facts → task-level bottlenecks → strategy → pipelining/ControlPersist → fact caching, in that order, measuring at each step rather than guessing.

**Detailed:** The full reasoning chain is worth practicing out loud — see [Scenario-Based Questions](03-scenario-based-questions.md) for the complete walkthrough of this exact scenario, and [Performance](../production-engineering/05-performance.md) for each lever in depth.

**This is the single most common senior/architect-level Ansible interview question** — it tests reasoning under an open-ended prompt, not a memorized fact.

## Next

Continue to [Scenario-Based Questions](03-scenario-based-questions.md).
