---
icon: lucide/search
description: Ansible lookup and filter plugins — pulling data from outside the play (files, environment variables, external secret managers) and transforming it inline.
tags:
  - Ansible
  - Advanced Execution
---

# Lookup and Filter Plugins

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

A `loop:` needs data from somewhere before it can iterate — lookup plugins pull data in (a file, an environment variable, an external secret manager); filter plugins (covered day-to-day in [Filters and Tests](../jinja2-and-templates/02-filters-and-tests.md)) transform data already in hand.

## What It Will Cover

- `lookup('file', 'path/to/file')`, `lookup('env', 'HOME')`, `lookup('pipe', 'command')`
- `lookup('community.hashi_vault.hashi_vault', ...)` style patterns for pulling secrets from an external manager without committing them at all — cross-referenced from [Secrets and Vault](../production-engineering/03-secrets-and-vault.md)
- The difference between a lookup (runs on the **control node**) and a fact (gathered **from the managed node**)
- Writing a custom lookup plugin as part of a collection — cross-referenced from [Build a Collection From Zero](../build-your-own/03-build-a-collection-from-zero.md)

## Common Mistakes

- Confusing a lookup (control-node-side, e.g. reading a local file) with a fact (managed-node-side data) — they answer different questions about different machines.
- Using `lookup('pipe', ...)` to shell out for something a real module or filter already does.

## Interview Questions

- What's the difference between a lookup plugin and a fact, in terms of which machine the data comes from?
- How would you pull a secret from an external vault without ever committing it to the playbook repository?

## Next

Continue to [Dynamic Inventory](05-dynamic-inventory.md).
