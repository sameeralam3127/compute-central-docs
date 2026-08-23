---
icon: lucide/building-2
description: Ansible's commercial and upstream ecosystem — ansible-core vs. the ansible package vs. AWX vs. Red Hat Ansible Automation Platform (AAP), Automation Controller, Mesh, Execution Environments, and licensing.
tags:
  - Ansible
  - Enterprise Platform
  - AAP
  - AWX
---

# Enterprise Platform (AAP & AWX)

Everything before this section is about `ansible-core` — the open-source engine and CLI. This section is about what gets built **on top of it** once an organization needs shared scheduling, role-based access control, audit history, and vendor support: Red Hat Ansible Automation Platform (AAP) and its open-source upstream, AWX.

You don't need any of this to write and run great playbooks — plenty of teams never touch it. It becomes relevant the moment "a few engineers running playbooks from their laptops" needs to become "automation a whole organization can safely share."

## Read in this order

1. [ansible-core vs. ansible vs. AAP](01-ansible-core-vs-ansible-vs-aap.md) — four names, precisely disambiguated
2. [Automation Controller and Automation Mesh](02-automation-controller-and-mesh.md) — the web UI/API/RBAC layer, and distributed execution
3. [Execution Environments and Automation Hub](03-execution-environments-and-hub.md) — reproducible run environments and certified content
4. [Licensing and Adoption](04-licensing-and-adoption.md) — AWX vs. a paid AAP subscription, and how to decide

## Next

Continue to [Case Studies](../case-studies/index.md).
