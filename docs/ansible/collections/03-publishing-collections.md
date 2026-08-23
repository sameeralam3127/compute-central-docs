---
title: "How to Publish an Ansible Collection"
icon: lucide/upload
description: Publishing an Ansible collection to Galaxy or a private Automation Hub — building, versioning, and releasing.
tags:
  - Ansible
  - Collections
---

# Publishing Collections

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## What It Will Cover

- `ansible-galaxy collection build` producing a `.tar.gz` artifact from `galaxy.yml` + the collection tree
- `ansible-galaxy collection publish` to public Galaxy, or to a private Automation Hub/Nexus/Artifactory-hosted collection index for internal-only collections
- Semantic versioning discipline for a collection other teams depend on
- CI-driven publishing: building and publishing a new collection version automatically on a tagged release
- The full build-from-zero workflow, including a custom module and role packaged together, is in [Build a Collection From Zero](../build-your-own/03-build-a-collection-from-zero.md)

## Common Mistakes

- Publishing a breaking module argument change as a patch version instead of a major version bump.
- No CI validation (`ansible-test sanity`) before publishing — see [CI/CD and Linting](../production-engineering/06-cicd-and-linting.md).

## Interview Questions

- How would you version a collection so consumers can safely pin to a major version?
- What's the difference between publishing to public Galaxy and a private Automation Hub?

## Next

Continue to [Build Your Own](../build-your-own/index.md).
