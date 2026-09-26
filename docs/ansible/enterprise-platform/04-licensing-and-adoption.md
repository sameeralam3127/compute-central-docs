---
title: "AWX vs AAP: Licensing and Adoption Guide"
icon: lucide/scale
description: "AWX is free and community-supported; AAP is a paid Red Hat subscription, priced per managed node, that adds support, certified content, and backported fixes."
tags:
  - Ansible
  - Enterprise Platform
  - AAP
  - AWX
---

# Licensing and Adoption

**AWX is free** and community-supported. **AAP is a paid Red Hat subscription**, priced per managed node, that adds vendor support, certified content, and backported fixes on a stable release cadence.

## What You'll Learn

- How AWX and AAP relate on the support/stability spectrum
- A concrete framework for deciding between them
- Why this is an organizational decision, not a purely technical one

## AWX Is the Upstream, AAP Is the Supported Downstream

**AWX** is the open-source project Automation Controller is built from — the same relationship Fedora has to RHEL — with no formal long-term support guarantees or backports. Its releases have been paused since mid-2024 (see the [note on AWX's status](01-ansible-core-vs-ansible-vs-aap.md#the-four-layers)), which weighs heavily on any new adoption decision. **AAP** is the same underlying Controller technology, stabilized and backported onto a supported release cadence, bundled with [Execution Environments and Automation Hub](03-execution-environments-and-hub.md), and backed by a Red Hat support contract. Red Hat's subscription model is typically **node-based** (counted by managed hosts under automation) rather than per-seat — always confirm exact terms against Red Hat's current published pricing rather than assuming, since commercial terms change independently of the technology.

## A Decision Framework

```mermaid
flowchart TD
    A["Need shared RBAC,\naudit, scheduling?"] -->|No| B[ansible-core CLI is enough]
    A -->|Yes| C{Need vendor support,\nan SLA, or certified content?}
    C -->|No — comfortable self-supporting| D[AWX]
    C -->|Yes| E[AAP subscription]
```

A pragmatic path many teams take: run playbooks from CI with an approval gate first, which covers scheduling, audit history, and access control for many teams, and move to AAP when you need self-service surveys, fine-grained RBAC, Mesh, or vendor support. Red Hat offers trial subscriptions for evaluating AAP itself. Piloting on AWX used to be the default answer; with AWX releases paused, weigh that option against its missing security updates.

## Making the Business Case

The technical case for AAP (Controller, Mesh, Execution Environments) is only half the decision. Engineers frequently make a correct technical recommendation that stalls because the licensing and support conversation wasn't part of the pitch. Worth stating explicitly in an adoption proposal:

- **Vendor-backed CVE response and patch SLAs** — a genuine security argument for AAP over self-supported AWX in regulated environments.
- **Right-sizing subscription scope** to actual managed-node count, rather than over-provisioning "just in case."
- **Mesh topology and Execution Environment strategy have real cost implications at scale** — the licensing and architecture conversations need to happen together, not sequentially.

## Common Mistakes

- Assuming AWX and AAP are functionally identical long-term — AWX has no support guarantees, and with releases paused it currently receives no fixes at all.
- Treating the licensing conversation as separate from the architecture conversation.

## Interview Questions

- What's the relationship between AWX and Ansible Automation Platform?
- What factors would push an organization toward a paid AAP subscription instead of self-supporting AWX?

## Next

Continue to [Event-Driven Ansible](05-event-driven-ansible.md).
