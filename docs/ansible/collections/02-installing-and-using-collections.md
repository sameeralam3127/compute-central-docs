---
title: "How to Install Ansible Collections"
icon: lucide/download
description: Installing and using Ansible collections — requirements.yml, version pinning, ansible-galaxy collection install, and offline installs.
tags:
  - Ansible
  - Collections
---

# Installing and Using Collections

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## What It Will Cover

- `requirements.yml` as the collection equivalent of `requirements.txt` — always commit it, always pin versions
- `ansible-galaxy collection install -r requirements.yml`, and `-p ./collections` to install project-local instead of user-wide
- `ANSIBLE_COLLECTIONS_PATH` and collection search order (project-local vs. user vs. system)
- Building an offline/air-gapped install with `ansible-galaxy collection download`
- Verifying what's installed: `ansible-galaxy collection list`

## Common Mistakes

- Installing collections user-wide with no `requirements.yml`, so a teammate's environment silently has different versions.
- Not pinning versions, letting a collection update change module behavior underneath an otherwise-unchanged playbook.

## Interview Questions

- Why should collection versions be pinned in `requirements.yml` rather than installed ad hoc?
- How would you prepare an air-gapped install of the collections a project needs?

## Next

Continue to [Publishing Collections](03-publishing-collections.md).
