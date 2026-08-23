---
icon: lucide/tag
description: Ansible tags — running or skipping part of a playbook with --tags and --skip-tags, without editing the file.
tags:
  - Ansible
  - Core Concepts
---

# Tags

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

A large playbook shouldn't need editing just to run a subset of it during debugging or a partial deploy — tags give every task, block, or role a label that `--tags`/`--skip-tags` can filter on at run time.

## What It Will Cover

- Applying `tags:` to a task, a block, and an entire role
- `ansible-playbook site.yml --tags config,restart`
- `ansible-playbook site.yml --skip-tags slow_checks`
- The special `always` and `never` tags
- `ansible-playbook --list-tags` to discover what a playbook supports without reading the whole file

## Common Mistakes

- Tagging every task with the same tag, making `--tags` filtering meaningless.
- Forgetting that `import_tasks` resolves tags at parse time while `include_tasks` resolves them at run time — see [Imports vs. Includes](../playbook-engineering/03-imports-vs-includes.md) — which changes what `--list-tags` can see ahead of a run.

## Interview Questions

- How would you run only a subset of a 200-task playbook without editing it?
- What do the `always` and `never` special tags do?

## Next

Continue to [Check Mode and Diff Mode](10-check-mode-and-diff-mode.md).
