---
title: "Ansible Execution Environments and Automation Hub"
icon: lucide/container
description: Execution Environments — container images that package ansible-core, Python dependencies, and collections together — and Automation Hub, the certified content registry.
tags:
  - Ansible
  - Enterprise Platform
  - AAP
---

# Execution Environments and Automation Hub

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

A traditional control node accumulates whatever Python packages and collections were `pip install`ed and `ansible-galaxy install`ed on it over time, by whoever had access — with no reproducibility guarantee. Real playbooks depend on specific libraries (`boto3` for AWS modules, `pywinrm` for Windows) and specific collection versions; drift between one engineer's machine, another's, and CI is a constant source of "works for me" failures. Execution Environments exist to end that permanently.

## What It Will Cover

- **Execution Environments (EEs)** — container images, built with `ansible-builder`, that bundle a pinned `ansible-core` version, Python dependencies, and collections into one versioned, immutable artifact. Controller (or `ansible-navigator`) runs jobs *inside* this image instead of directly on a bare control node.
- Defining one: `execution-environment.yml` (base image, `requirements.txt` for Python deps, `requirements.yml` for collections), built with `ansible-builder build`. Both `ansible-builder` and `ansible-navigator` (for running against the resulting image) ship together in [ansible-dev-tools](../production-engineering/08-ansible-dev-tools.md).
- **Automation Hub** — Red Hat's certified, support-backed content registry — the AAP-tier counterpart to the open community Galaxy registry (see [Publishing Collections](../collections/03-publishing-collections.md)), offering vendor-certified collections with support SLAs.
- Treating EE definitions as version-controlled artifacts with the same review process as application code, since they define exactly what runs in production automation.
- Scoping EEs tightly (one per automation domain, not one giant EE with every dependency ever needed) for both image size and blast-radius reasons.

## Common Mistakes

- Treating an EE as a one-time build instead of a maintained, periodically-rebuilt artifact — a stale EE silently drifts from current collection and security patches.
- Mixing Automation Hub (certified) and Galaxy (community) content in the same EE without tracking which pieces carry vendor support and which don't.

## Interview Questions

- What problem do Execution Environments solve that a shared control node doesn't?
- What's the difference between Ansible Galaxy and Automation Hub?

## Next

Continue to [Licensing and Adoption](04-licensing-and-adoption.md).
