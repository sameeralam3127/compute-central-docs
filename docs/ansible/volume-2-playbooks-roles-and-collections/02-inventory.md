---
icon: lucide/list-tree
description: Static and dynamic Ansible inventory — INI and YAML formats, cloud inventory plugins for AWS, Azure, VMware, and Kubernetes, host patterns, groups, children, ranges, and aliases.
tags:
  - Ansible
  - Volume 2
  - Inventory
---

# Part 8 — Inventory

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

Inventory answers the first question Ansible needs answered: which hosts, and organized how. This chapter covers static files through live cloud-sourced inventory.

## Why This Exists

- Every playbook run starts by resolving `hosts:` against an inventory — get this wrong and nothing else in the series matters, because tasks run against the wrong (or no) machines.

## Problem Statement

- Hardcoding host lists doesn't survive autoscaling, cloud environments, or teams larger than one person — inventory needs to be structured, groupable, and often dynamically sourced from the infrastructure's source of truth (a cloud API, not a text file).

## Internal Architecture

- The `InventoryManager` / inventory plugin architecture: how Ansible loads one or more inventory sources, merges them, and builds the in-memory host/group graph that variables and patterns are resolved against.

## Step-by-Step Explanation

- **Static INI format**: hosts, `[group]` headers, `:vars`, `:children`.
- **Static YAML format**: the `all:`/`children:`/`hosts:`/`vars:` nested structure.
- **Dynamic inventory**: inventory plugins (`amazon.aws.aws_ec2`, `azure.azcollection.azure_rm`, `community.vmware.vmware_vm_inventory`, `kubernetes.core.k8s`) that query a live API and construct inventory at run time, versus legacy inventory *scripts*.
- **Host patterns**: `all`, `webservers:dbservers` (union), `webservers:!staging` (exclusion), `webservers:&datacenter1` (intersection).
- **Groups and children**: nested group hierarchies and how variables inherit down them.
- **Ranges**: `www[01:50].example.com` style numeric expansion.
- **Aliases**: `ansible_host` to give a friendly inventory name a different real connection address.

## Production Best Practices

- Preferring dynamic (cloud-sourced) inventory over static files for any environment that autoscales or changes frequently, so inventory can't silently drift from reality.
- Keeping inventory environment-scoped (separate prod/staging/dev inventories or group structures) so a `--limit` mistake can't reach the wrong environment.

## Common Mistakes

- Stale static inventory files that no longer match real infrastructure.
- Overlapping group definitions that cause surprising variable-precedence results (deferred fully to Part 9).
- Misusing host patterns (e.g., assuming `webservers:dbservers` intersects instead of unions).

## Performance Considerations

- Dynamic inventory plugins that hit a live cloud API on every run add latency; caching strategies (`fact_caching`-adjacent inventory caching) mitigate this at scale — previewed here, covered fully in Volume 6.

## Security Considerations

- Cloud inventory plugins need credentials (IAM roles, service principals) with only the read scope required to list resources — least-privilege applies to inventory lookups too, not just to the hosts being managed.

## Interview Questions

- "What's the difference between static and dynamic inventory, and when would you use each?"
- "How do host patterns like `webservers:!staging` work?"
- "How would you source inventory from AWS EC2 automatically?"

## Hands-On Lab

- Write a small YAML static inventory with two groups and a child group, then run `ansible-inventory --graph` to visualize how Ansible parsed it.

## Summary

- Inventory is the map Ansible operates on — static files work for small, stable environments; dynamic inventory plugins are the production default for cloud and Kubernetes environments that change on their own.

## Next

Continue to [Part 9 — Variables and Precedence](03-variables-and-precedence.md).
