---
icon: lucide/user
description: Who Michael DeHaan is, why he created Ansible, the design bets he made (SSH, agentless, Python, YAML, idempotency), and the road to Red Hat and Ansible Automation Platform.
tags:
  - Ansible
  - Volume 1
  - History
---

# Part 2 — Michael DeHaan and the Birth of Ansible

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

Tools inherit the biases of the people who build them. This chapter is about the specific frustrations Michael DeHaan carried out of his prior work (including Cobbler and Fedora/Red Hat provisioning tooling) and how they turned into five deliberate design bets.

## Why This Exists

- Understanding Ansible's design as a series of *reactions* to specific real-world pain (from Cobbler, Func, and enterprise Puppet/Chef deployments DeHaan had seen) rather than an abstract engineering exercise.

## Problem Statement

- What DeHaan and early contributors found frustrating about existing tools going into 2012: agent sprawl, PKI/certificate management overhead, DSLs that felt like programming languages without being good ones, and the gap between "ad hoc SSH command" and "full configuration management system."

## History / Context — Timeline

- Prior work: **Cobbler** (provisioning) and **Func** (remote execution framework) as direct predecessors/influences.
- **February 2012**: first Ansible commit / public release.
- **AnsibleWorks** founded as the commercial entity.
- **2013–2014**: rapid module ecosystem growth, Ansible Galaxy launch, Ansible Tower (commercial control plane) introduced.
- **October 2015**: Red Hat acquires Ansible/AnsibleWorks.
- **2019–2020**: Collections model introduced, decoupling content from ansible-core release cadence.
- **2020–present**: Ansible Tower open-sourced as **AWX**; commercial product rebranded **Red Hat Ansible Automation Platform (AAP)**; Automation Mesh and Execution Environments introduced.

## Internal Architecture — The Five Founding Design Bets

- **Why SSH**: no new daemon, no new port, no new PKI — reuse infrastructure every server already has and every admin already trusts.
- **Why agentless**: eliminates agent installation, agent upgrades, and agent-as-attack-surface; tradeoff is needing a Python interpreter on the managed node (covered fully in Part 6/Volume 1 Ch. 4 equivalent — actually Volume 3).
- **Why Python**: mature standard library, strong SSH/JSON tooling (paramiko), readable enough for ops engineers who aren't full-time software developers, already the dominant sysadmin scripting language by 2012.
- **Why YAML**: human-readable, diffable in code review, no braces/semicolons, approachable to non-programmers — detailed fully in [Part 4 — Why YAML?](04-why-yaml.md).
- **Why idempotency as a first-class principle**: playbooks describe desired end state, not a sequence of one-time actions, so they're safe to re-run — this is the throughline into [Part 5 — Declarative vs. Imperative](05-declarative-vs-imperative.md).

## Workflow

- How the name "Ansible" was chosen — a science-fiction reference (Ursula K. Le Guin's instantaneous communication device) chosen to evoke simple, instant, distance-independent communication with remote machines.

## Production Best Practices

- How the Red Hat acquisition changed release cadence, support guarantees, and enterprise trust — relevant when choosing OSS `ansible-core` vs. subscribing to AAP (fully covered in Volume 4).

## Common Mistakes

- Conflating "Ansible the open-source project" with "Ansible Automation Platform the commercial product" — a distinction this chapter sets up and Volume 4 covers exhaustively.

## Interview Questions

- "Why did Ansible choose SSH instead of building a custom agent protocol?"
- "What does the word 'Ansible' come from, and why is that meaningful for the tool's design goals?"
- "What's the difference between Ansible Tower, AWX, and Ansible Automation Platform?"

## Hands-On Lab

- None for this chapter — it is conceptual/historical. Points forward to Part 6's installation lab.

## Summary

- Ansible's architecture is not arbitrary: SSH, agentless, Python, YAML, and idempotency are five specific, traceable answers to five specific failures of the tools that came before it.

## Next

Continue to [Part 3 — What Exactly Is Ansible?](03-what-exactly-is-ansible.md).
