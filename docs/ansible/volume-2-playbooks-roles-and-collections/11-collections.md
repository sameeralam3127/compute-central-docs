---
icon: lucide/package
description: Why Ansible Collections were introduced, namespace and versioning rules, publishing, and how collection dependencies work.
tags:
  - Ansible
  - Volume 2
  - Collections
---

# Part 13 — Collections

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

Collections are the packaging unit that let Ansible content (modules, plugins, roles) ship and version independently of `ansible-core` itself. This chapter explains why that split happened and how to work with it.

## Why This Exists

- Before Collections, every module lived inside the single `ansible` repository and shipped only on `ansible-core`'s release cadence — a single vendor's module bug fix meant waiting for (or backporting into) a full Ansible release.

## Problem Statement

- Cloud providers, network vendors, and community maintainers all wanted to ship and version modules independently, at their own pace, without being coupled to core release cycles or bloating the core distribution with content most users don't need.

## History / Context

- Collections were introduced starting around Ansible 2.9/2.10 as the mechanism to split the old monolithic `ansible` repository into `ansible-core` plus independently versioned collections (`amazon.aws`, `community.general`, `ansible.posix`, etc.), with the `ansible` community package becoming a curated bundle of collections on top of `ansible-core`.

## Internal Architecture

- **Namespaces**: `namespace.collection_name` (e.g., `community.general`, `amazon.aws`) — namespaces are typically an organization or community group, registered on Galaxy/Automation Hub.
- **Collection directory structure**: `plugins/modules/`, `plugins/filter/`, `roles/`, `playbooks/`, `galaxy.yml` (collection metadata and version).
- How the module loader resolves a fully-qualified collection name (FQCN) like `amazon.aws.ec2_instance` at runtime, and how `collections:` at the play level allows short (unqualified) names.

## Workflow

- Installing (`ansible-galaxy collection install`), referencing (`requirements.yml`), and resolving version constraints when a playbook depends on multiple collections with their own version ranges.

## Production Best Practices

- Always using fully-qualified collection names (FQCNs) in shared/production playbooks, even when short names would resolve, for unambiguous clarity and forward compatibility.
- Pinning collection versions in `requirements.yml` and committing lockfile-equivalent version pins for reproducible CI runs.

## Common Mistakes

- Relying on unqualified module names that happen to resolve today but break when a new collection introduces a name collision.
- Not pinning collection versions, leading to CI builds that behave differently week to week as collections update.

## Performance Considerations

- Installing far more collections than a project actually uses adds install time and disk footprint, especially inside Execution Environments (Volume 4).

## Security Considerations

- Reviewing third-party collection source before installing, since a collection can ship arbitrary Python plugin code that runs with the same trust as core modules; signature verification is covered in Part 14.

## Interview Questions

- "Why were Collections introduced, and what problem did they solve that the old monolithic `ansible` repo couldn't?"
- "What is a fully-qualified collection name (FQCN) and why is it recommended in production?"
- "How does `ansible-core` relate to a collection like `community.general`?"

## Hands-On Lab

- Create a `requirements.yml` pinning `community.general` to a specific version, install it with `ansible-galaxy collection install -r requirements.yml`, and reference one of its modules by FQCN in a playbook.

## Summary

- Collections decoupled Ansible's content ecosystem from its core engine's release cycle — namespaces, FQCNs, and version pinning are the mechanics that make that decoupling safe in production.

## Next

Continue to [Part 14 — Galaxy](12-galaxy.md).
