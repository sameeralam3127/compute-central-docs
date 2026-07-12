---
icon: lucide/clipboard-check
description: Ansible production best practices — naming conventions, repository layout, Git workflow, CI, roles and collections structure, variables, secrets, documentation, and versioning.
tags:
  - Ansible
  - Volume 6
  - Best Practices
---

# Part 35 — Best Practices

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

This chapter consolidates the best-practice notes scattered across every prior chapter into one production playbook (in the non-Ansible sense of the word).

## Why This Exists

- Individual best practices make more sense as a coherent whole than as isolated tips — this chapter is the "if you only read one chapter before starting a real project" reference.

## Problem Statement

- Ansible is permissive by design (many ways to structure variables, many ways to organize roles) — permissiveness without convention leads to inconsistent, hard-to-onboard-into repositories at scale.

## Internal Architecture — A Reference Repository Layout

```
inventory/
  production/
    hosts.yml
    group_vars/
    host_vars/
  staging/
    hosts.yml
    group_vars/
    host_vars/
roles/
  common/
  webserver/
  database/
collections/
  requirements.yml
playbooks/
  site.yml
  deploy.yml
group_vars/
  all.yml
ansible.cfg
requirements.yml
.ansible-lint
.yamllint
README.md
```

## Step-by-Step Explanation — Conventions

- **Naming**: consistent, descriptive task names (shown in output — `name:` is documentation, not decoration); consistent variable naming with a role-specific prefix to avoid collisions (e.g., `nginx_worker_processes` instead of a bare `worker_processes`).
- **Repository layout**: environment-scoped inventories (Volume 2, Part 8) so `--limit` mistakes can't cross environments; roles kept focused and composable (Volume 2, Part 12).
- **Git**: feature-branch workflow with PR review required before merging to the branch that CI/CD deploys from; meaningful commit messages describing *why* a playbook changed.
- **CI**: the full pipeline assembled from Volume 5 — `ansible-lint`/`yamllint` → `ansible-test sanity` → Molecule → `--check --diff` dry runs against a staging-like target before real deploys.
- **Roles**: one responsibility per role, complete `defaults/main.yml`, accurate `meta/main.yml`.
- **Collections**: internal collections for shared modules/plugins/roles across projects, versioned and pinned (Volume 2, Parts 13-14).
- **Variables**: role defaults for overridable values, `group_vars`/`host_vars` for environment-specific values, `-e` reserved for genuine one-off overrides (Volume 2, Part 9).
- **Secrets**: Vault or an external secret manager, never plaintext, `no_log` on every sensitive task (Part 31).
- **Documentation**: a README per role/collection describing purpose, variables, and examples — treating internal automation with the same documentation bar as a published Galaxy collection.
- **Versioning**: semantic versioning for internal collections (Volume 2, Part 14), and tagging playbook repository releases that correspond to significant infrastructure changes.

## Production Best Practices

- (This chapter's entire content is production best practices — organized here as the consolidated reference rather than repeated per-topic.)

## Common Mistakes

- A single sprawling repository with no environment separation, no role boundaries, and no CI gate — the state most unmanaged Ansible repositories drift into over time without deliberate structure.

## Performance Considerations

- Repository structure itself doesn't affect runtime performance, but a well-organized repo makes the Part 32 performance levers easier to apply consistently across environments.

## Security Considerations

- Repository layout is itself a security control: environment-scoped inventories and CI gating are what make Part 31's security practices enforceable rather than aspirational.

## Interview Questions

- "How would you structure a production Ansible repository for a team of 10 engineers?"
- "What CI checks would you require before an Ansible playbook can be merged?"
- "How do you keep role variables from colliding across a large codebase?"

## Hands-On Lab

- Restructure a flat, single-file playbook into the reference layout above (separate inventory, roles, `group_vars`, `ansible.cfg`, `requirements.yml`) and verify it still runs identically with `ansible-playbook --check`.

## Summary

- Best practice in Ansible is less about any single rule and more about consistent structure — environment-scoped inventory, focused roles, disciplined variables, mandatory CI, and real documentation, applied together.

## Next

Continue to [Part 36 — Real Production Projects](06-real-production-projects.md).
