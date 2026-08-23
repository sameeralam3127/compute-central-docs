---
title: "Ansible Modules Reference and Decision Guide"
icon: lucide/package
description: Module reference and decision guides — command vs. shell vs. raw vs. script, decision trees for common tool choices, and category-by-category module coverage.
tags:
  - Ansible
  - Modules
---

# Modules

If [Core Concepts: Modules](../core-concepts/04-modules.md) covered the mental model — check-then-act, FQCNs — this section is the reference: which module to reach for, and the decision trees that make the choice mechanical instead of a guess.

## Read in this order

1. [Command vs. Shell vs. Raw vs. Script](01-command-vs-shell-vs-raw-vs-script.md) — the comparison every Ansible engineer needs memorized
2. [Module Decision Trees](02-module-decision-trees.md) — copy vs. template, import vs. include, and more, as flowcharts
3. [File, Package, Service, and User Modules](03-file-package-service-user-modules.md)
4. [URI and API Automation](04-uri-and-api-automation.md)
5. [Collections Catalog](05-collections-catalog.md) — beyond `ansible.builtin`: cloud, network, database, and container modules by domain

## Next

Continue to [Playbook Engineering](../playbook-engineering/index.md).
