---
icon: lucide/gauge
description: How Ansible executes across many hosts at once — forks, serial, strategy, throttle, delegation, connection plugins, fact caching, dynamic inventory, and lookup/filter plugins.
tags:
  - Ansible
  - Advanced Execution
---

# Advanced Execution

Everything up to this point assumed "a few hosts, one run." This section is about what changes at 50, 500, or 5,000 hosts — and the knobs that control it.

## Read in this order

1. [Forks, Serial, Strategy, and Throttle](01-forks-serial-strategy-throttle.md) — how many hosts run in parallel, and how a rollout is batched
2. [Fact Caching](02-fact-caching.md)
3. [Connection Plugins](03-connection-plugins.md)
4. [Lookup and Filter Plugins](04-lookup-and-filter-plugins.md)
5. [Dynamic Inventory](05-dynamic-inventory.md)

## Next

Continue to [Production Engineering](../production-engineering/index.md) — the operational discipline that surrounds all of this at scale.
