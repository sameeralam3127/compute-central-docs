---
icon: lucide/gauge
description: Ansible performance tuning — forks, SSH multiplexing, pipelining, fact caching, async and poll, strategy plugins, Mitogen's history, and scaling Ansible to 10,000 hosts.
tags:
  - Ansible
  - Volume 6
  - Performance
---

# Part 32 — Performance and Scaling

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

Every performance lever referenced as "previewed here, covered fully in Volume 6" throughout the series lands in this chapter, with concrete tuning guidance.

## Why This Exists

- Ansible's safe defaults (forks=5, no pipelining) are tuned for correctness on an unknown environment, not speed on a known one — this chapter is about closing that gap deliberately.

## Problem Statement

- A playbook that takes 2 minutes against 10 hosts can take hours against 2,000 hosts if the same defaults are used unchanged — performance work is what makes Ansible viable at real fleet scale.

## Internal Architecture

- How each lever maps back to the execution engine from Volume 3: **forks** control worker-process parallelism in the Task Queue Manager; **pipelining** and **SSH multiplexing (ControlPersist)** reduce per-task connection overhead; **strategy plugins** control whether hosts proceed in lockstep or independently; **fact caching** avoids repeating the implicit `setup` module run on every play.

## Step-by-Step Explanation — The Levers

- **Forks**: raising `forks` (Volume 2, Part 10) from the default 5 to match control-node CPU/memory/network headroom and real target parallelism needs.
- **SSH multiplexing (ControlPersist)**: reusing one SSH connection across multiple tasks in a run instead of a fresh handshake per task.
- **Pipelining**: eliminating the "copy module file, then execute" round trip (Volume 3, Part 16) in favor of piping module code directly — requires `requiretty` to be disabled in sudoers on the managed node.
- **Fact caching**: caching gathered facts (Redis, JSON file, Memcached backends via cache plugins from Part 26) across runs instead of re-gathering every time, especially valuable when `gather_facts` cost dominates small playbooks.
- **Async and poll**: `async:`/`poll:` for long-running tasks, allowing a task to be fired off and polled (or fired-and-forgotten with `poll: 0`) instead of blocking the whole run.
- **Strategy plugins**: `free` strategy lets fast hosts proceed without waiting for slow stragglers on every task, at the cost of losing strict per-task ordering guarantees.
- **Mitogen (history)**: a third-party strategy plugin that dramatically sped up Ansible by keeping a persistent Python interpreter and connection state on the control node, avoiding repeated interpreter startup cost — largely superseded in relevance as pipelining/ControlPersist matured and Mitogen's maintenance slowed, but historically important to understand.

## Production Best Practices — Scaling to 10,000 Hosts

- Combining high `forks`, pipelining, ControlPersist, and fact caching as the baseline before considering more exotic options.
- Splitting extremely large runs across batches (`serial`) not just for blast-radius control (Volume 2, Part 11) but because a single control node has real limits on concurrent SSH connections and memory for in-flight results.
- Considering Automation Mesh (Volume 4, Part 21) for distributing execution across multiple execution nodes rather than scaling one control node vertically forever.

## Common Mistakes

- Raising `forks` without also tuning SSH/OS-level connection limits on the control node, hitting a wall unrelated to Ansible itself.
- Enabling `pipelining` without disabling `requiretty` in sudoers, causing become-related failures instead of the expected speedup.
- Assuming `strategy: free` is always faster — for playbooks with real cross-host ordering dependencies, it can produce incorrect behavior, not just different timing.

## Performance Considerations

- This chapter is the performance chapter — quantifying the levers above with benchmark-style before/after guidance is its explicit purpose in the full-content pass.

## Security Considerations

- `host_key_checking = False` and disabling `requiretty` (common performance-motivated changes) both carry security tradeoffs discussed fully in Part 31 — flagged here as a reminder that performance tuning isn't security-neutral.

## Interview Questions

- "What are the highest-leverage performance settings in Ansible, and why?"
- "How would you scale Ansible to manage 10,000 hosts?"
- "What was Mitogen, and why is it less commonly used today?"

## Hands-On Lab

- Run the same playbook against a multi-host test inventory twice — once with default settings, once with `forks` raised and `pipelining` enabled — and compare wall-clock time.

## Summary

- Forks, pipelining, ControlPersist, fact caching, and strategy choice are the core performance toolkit — used together, and combined with Automation Mesh at very large scale, they're what makes Ansible practical against thousands of hosts.

## Next

Continue to [Part 33 — Windows Automation](03-windows-automation.md).
