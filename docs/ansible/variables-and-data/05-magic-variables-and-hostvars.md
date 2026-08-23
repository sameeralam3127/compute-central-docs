---
title: "Ansible hostvars and Magic Variables Explained"
icon: lucide/sparkles
description: Ansible's automatically-provided magic variables — hostvars, groups, group_names, inventory_hostname, and ansible_play_hosts.
tags:
  - Ansible
  - Variables
---

# Magic Variables and Hostvars

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

Ansible provides a handful of variables automatically, without you ever defining them — they're how one host's tasks can reference *another* host's facts or variables, which is essential for anything involving load balancers, clusters, or cross-host coordination.

## What It Will Cover

- `hostvars` — the full dictionary of every host's variables, keyed by inventory name; the mechanism behind `hostvars['db01']['ansible_default_ipv4']['address']`
- `inventory_hostname` — the current host's name, as Ansible knows it
- `groups` — a dictionary of every group name to its member hosts
- `group_names` — the list of groups the *current* host belongs to
- `ansible_play_hosts` — the hosts targeted by the current play
- A worked example: a web server task templating a database connection string using `hostvars[groups['db'][0]]['ansible_default_ipv4']['address']`

## Common Mistakes

- Trying to reference another host's facts without `hostvars`, and getting an "undefined variable" error — a task only has direct access to the current host's own variables by default.
- Confusing `groups` (all groups, everywhere) with `group_names` (only the current host's groups).

## Interview Questions

- How would a web server task read a fact from a database host in the same inventory?
- What's the difference between `groups` and `group_names`?

## Next

Continue to [set_fact and combine](06-set-fact-and-combine.md).
