---
icon: lucide/scan-search
description: Ansible facts — the setup module, ansible_facts, gathering subsets, caching, and custom facts.
tags:
  - Ansible
  - Variables
  - Facts
---

# Facts

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

Most plays begin with an implicit `setup` module run that discovers dozens of details about the host — OS family, IP addresses, memory, mounted disks — before your first real task even starts. Facts are how a playbook adapts to the machine it's actually running against instead of assuming.

## What It Will Cover

- The implicit `Gathering Facts` task and `gather_facts: false` to skip it
- `ansible_facts['os_family']`, `ansible_facts['default_ipv4']`, and the rest of the namespaced fact dictionary (vs. the older top-level `ansible_*` fact variables)
- `ansible.builtin.setup` run ad hoc, and `filter:`/`gather_subset:` to scope what's collected
- Custom facts via `/etc/ansible/facts.d/*.fact`
- **Fact caching** (`fact_caching = jsonfile`/`redis`) to avoid re-gathering on every run — previewed here, covered in full in [Fact Caching](../advanced-execution/02-fact-caching.md)

## Common Mistakes

- Leaving `gather_facts: true` (the default) on every play, including ones that never reference a fact — real cost at scale, covered in [Performance](../production-engineering/05-performance.md).
- Using the deprecated top-level `ansible_distribution` style instead of the namespaced `ansible_facts['distribution']` form in new playbooks.

## Interview Questions

- What does `gather_facts` actually do, and when would you disable it?
- What's the difference between a fact and a registered variable?
- How does fact caching change the cost of repeated runs?

## Next

Continue to [Registered Variables](04-registered-variables.md).
