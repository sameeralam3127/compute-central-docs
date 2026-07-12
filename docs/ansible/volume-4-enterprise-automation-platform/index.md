---
icon: lucide/book-open
description: Volume 4 of the Ansible book series — ansible-core vs. the ansible package vs. Red Hat Ansible Automation Platform, Automation Controller, Automation Mesh, Execution Environments, and licensing.
tags:
  - Ansible
  - Volume 4
---

# Volume 4: Enterprise Automation Platform (AAP)

!!! info "Volume status"
    This volume is at the outline stage. Each chapter below has its structure and scope defined; full prose is being written chapter by chapter after Volumes 1-3.

!!! note "Scope of this volume"
    The master outline for this series treats AAP as a single topic. Because AAP is a large enough product surface (a web-based controller, RBAC, a mesh networking layer, containerized execution, and its own licensing model) to genuinely warrant its own volume, it's expanded here into four chapters instead of one.

## Who This Volume Is For

Platform engineers and administrators evaluating or already running Red Hat Ansible Automation Platform, and anyone who needs to explain precisely where open-source `ansible-core` ends and the commercial platform begins.

## Prerequisites

[Volume 2: Playbooks, Roles & Collections](../volume-2-playbooks-roles-and-collections/index.md) — AAP is a platform *around* the same playbooks/roles/collections covered there, not a replacement for them.

## Chapters

1. [ansible-core vs. ansible vs. AAP](01-ansible-core-vs-ansible-vs-aap.md) — the three-layer naming that confuses almost everyone at first
2. [Automation Controller and Automation Mesh](02-automation-controller-and-mesh.md) — the web UI/API control plane, RBAC, job templates, workflows, and the mesh networking layer
3. [Execution Environments and Automation Hub](03-execution-environments-and-hub.md) — containerized, reproducible run environments and certified content distribution
4. [Licensing and Adoption](04-licensing-and-adoption.md) — subscription tiers and how to decide between OSS `ansible-core`/AWX and AAP

## What You Will Be Able to Do After This Volume

- Correctly answer "what is AAP and how does it relate to Ansible" in a design review or interview
- Understand what Automation Controller and Automation Mesh actually add operationally over raw `ansible-playbook`
- Explain what an Execution Environment is and why it replaces "just pip install everything on the control node"
- Make an informed build-vs-buy case between AWX/open-source and a paid AAP subscription

## Next

Continue to [Volume 5: Developing Modules, Plugins & Contributing](../volume-5-development-and-contributing/index.md).
