---
icon: lucide/package-open
description: Ansible Collections — the packaging and distribution unit for modules, plugins, and roles together, and how ansible-core relates to them.
tags:
  - Ansible
  - Collections
---

# Collections

## What You'll Learn

- What a collection actually is, and how it relates to `ansible-core`
- How to install one and use it correctly with FQCNs
- Where to find collections, and how to pin their versions

## Why Collections Exist

`ansible-core` ships the engine and a small `ansible.builtin` module set — everything else (cloud providers, network vendors, community tooling) is distributed as a **collection**: a versioned, installable bundle of modules, plugins, and roles under one namespace.

```text
amazon.aws.ec2_instance      # namespace.collection.module
community.general.timezone
ansible.posix.mount
```

This is precisely why FQCNs matter in practice (see [Modules](../core-concepts/04-modules.md#why-fqcns-not-short-names)) — `namespace.collection.module` tells you exactly which package a module came from, with no ambiguity about which collection's version of a same-named module is running.

## Minimal Example

```yaml title="requirements.yml"
collections:
  - name: community.general
    version: ">=8.0.0"
  - name: amazon.aws
    version: "8.1.0"
```

```bash
ansible-galaxy collection install -r requirements.yml
```

Pin collection versions the same way you'd pin any other dependency — an unpinned `ansible-galaxy collection install community.general` today and next month can silently resolve to different module behavior.

## Read in this order

1. [Collection Structure](01-collection-structure.md) — what's actually inside one
2. [Installing and Using Collections](02-installing-and-using-collections.md) — `requirements.yml`, version pinning, offline installs
3. [Publishing Collections](03-publishing-collections.md) — sharing your own

To build one from scratch, see [Build a Collection From Zero](../build-your-own/03-build-a-collection-from-zero.md) in the next section.

## Next

Continue to [Build Your Own](../build-your-own/index.md).
