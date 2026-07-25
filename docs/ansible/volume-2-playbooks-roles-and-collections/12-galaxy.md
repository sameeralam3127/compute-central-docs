---
icon: lucide/globe
description: Publishing and installing content on Ansible Galaxy — requirements files, semantic versioning, signing, and dependency resolution.
tags:
  - Ansible
  - Volume 2
  - Galaxy
---

# Part 14 — Galaxy

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

Galaxy is the public registry for Ansible roles and collections — this chapter covers both sides: installing content responsibly and publishing it.

## Why This Exists

- A registry only works if consumers can trust what they install and publishers have a predictable process — this chapter covers the mechanics that make both possible.

## Problem Statement

- Without a shared registry and versioning convention, every team would vendor and hand-maintain third-party automation content, duplicating work across the entire ecosystem.

## Internal Architecture

- Galaxy's relationship to Automation Hub (Red Hat's certified/supported content registry, covered fully in Volume 4) — Galaxy is the open community registry; Automation Hub layers certification and support on top for AAP customers.

## Step-by-Step Explanation

- **Installing**: `ansible-galaxy collection install <namespace.name>`, `ansible-galaxy role install <author.role>`, and installing from a `requirements.yml` covering both roles and collections in one file.
- **Publishing**: `ansible-galaxy collection build` (produces a `.tar.gz` artifact from `galaxy.yml`) then `ansible-galaxy collection publish`, requiring a Galaxy API token tied to a registered namespace.
- **Requirements files**: the combined roles+collections `requirements.yml` syntax, with `version:` constraints per entry.
- **Semantic Versioning**: Galaxy collections follow semver (`MAJOR.MINOR.PATCH`); how breaking changes should map to major version bumps, and how consumers should pin accordingly (`>=1.2.0,<2.0.0` style ranges).
- **Signing**: GPG-based collection signing and signature verification (`ansible-galaxy collection verify`, `--keyring`) to confirm installed content matches what was published.
- **Dependencies**: how a collection's `galaxy.yml` declares dependencies on other collections, and how Galaxy resolves (or fails to resolve) version conflicts across a dependency tree.

## Production Best Practices

- Pinning exact or narrowly-ranged versions in `requirements.yml` and committing it to version control, so `ansible-galaxy install -r requirements.yml` is fully reproducible in CI.
- Verifying collection signatures for anything installed from outside a fully trusted internal namespace.

## Common Mistakes

- Installing collections ad hoc on developer machines without a `requirements.yml`, leading to "works on my machine" version drift.
- Publishing a collection without a proper `galaxy.yml` version bump, silently overwriting consumers' expectations of that version's contents (Galaxy generally prevents this, but the intent-level mistake is common).

## Performance Considerations

- Resolving deep, cross-collection dependency trees can be slow; scoping `requirements.yml` to only what's actually used keeps installs fast, especially in Execution Environment builds (Volume 4).

## Security Considerations

- Galaxy is an open registry — namespace squatting and typosquatting are real risks; verify the exact namespace/author before installing, and prefer signed, certified content (Automation Hub) for production-critical automation.

## Interview Questions

- "How do you pin collection and role versions for a reproducible Ansible project?"
- "What's the difference between Ansible Galaxy and Automation Hub?"
- "How does collection signing and verification work?"

## Hands-On Lab

- Write a `requirements.yml` with one pinned role and one pinned collection, install it fresh into an empty `collections/`/`roles/` path with `ansible-galaxy install -r requirements.yml`, and confirm the installed versions match the pins.

## Summary

- Galaxy is the front door to Ansible's ecosystem — treat `requirements.yml` with the same rigor as a language's dependency lockfile, and verify what you install before running it with elevated privileges.

## Next

Volume 2 is complete. Continue to [Volume 3: Core Internals & Python Architecture](../volume-3-core-internals/index.md).
