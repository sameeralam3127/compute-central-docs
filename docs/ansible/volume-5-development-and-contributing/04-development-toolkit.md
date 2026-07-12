---
icon: lucide/wrench
description: The Ansible development toolkit — VS Code, dev containers, Execution Environments, ansible-lint, yamllint, pre-commit, black, ruff, tox, GitHub Actions, debugging, and the language server.
tags:
  - Ansible
  - Volume 5
  - Tooling
---

# Part 28 — Development Toolkit

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

This chapter is the "how I actually set up my editor and repo" companion to the testing chapter — the tools that catch problems before a commit, not just before a merge.

## Why This Exists

- Fast feedback (in-editor linting, pre-commit hooks) catches far more mistakes far more cheaply than waiting for CI — this chapter assembles that feedback loop.

## Problem Statement

- YAML/Jinja2 mistakes, style inconsistencies, and Python quality issues in custom modules/plugins are all preventable before a PR is even opened, but only if the right tools are wired into the editor and pre-commit flow.

## Internal Architecture / Toolchain Map

- **VS Code + the Ansible extension**: syntax highlighting, `ansible-lint` integration, and module/argument autocompletion via the language server.
- **Ansible Language Server**: the LSP backing VS Code's (and other editors') smart completions and inline diagnostics, built on the same `argument_spec` data `ansible-doc` uses.
- **Dev Containers**: a containerized, reproducible editor environment matching an Execution Environment's dependencies, so "works on my machine" applies to the *development* environment too, not just production runs.
- **`ansible-lint`**: rule-based playbook/role linting (production-readiness rules, not just style) — the tool previewed in Volume 2's CLI chapter.
- **`yamllint`**: general YAML style/syntax linting, complementary to (not a replacement for) `ansible-lint`.
- **`pre-commit`**: the hook framework wiring `ansible-lint`, `yamllint`, `black`, and `ruff` into a `git commit`-time gate.
- **`black`** and **`ruff`**: Python formatting and linting for custom modules/plugins (Part 25/26 content).
- **`tox`**: running the full test/lint matrix (multiple Python versions, `ansible-test`, Molecule) locally the same way CI would.
- **GitHub Actions**: the CI layer tying all of the above together on every push/PR (previewed here, its testing role covered in Part 27).

## Step-by-Step Explanation

- Setting up a `.pre-commit-config.yaml` wiring `ansible-lint`, `yamllint`, `black`, and `ruff`, and installing it with `pre-commit install` so checks run automatically on `git commit`.
- Configuring `tox.ini` to run `ansible-test sanity`, `ansible-test units`, and `molecule test` as separate environments, runnable individually or all together.
- Debugging: using `ansible-playbook --step`, breakpoints via the `debugger` keyword on a task, and `ANSIBLE_KEEP_REMOTE_FILES=1` (Volume 3, Part 16) together as a debugging toolkit.

## Production Best Practices

- Making `pre-commit` mandatory (via a CI check that fails if hooks weren't run) rather than optional, so lint/format issues never reach review.
- Keeping the Dev Container definition and the production Execution Environment definition (Volume 4, Part 22) in sync so local development matches what actually runs.

## Common Mistakes

- Installing `ansible-lint`/`yamllint` in CI only, without local pre-commit hooks, so every PR starts with a round of trivial fixup commits.
- Ignoring `ansible-lint` production-readiness rules by disabling them wholesale instead of fixing or deliberately, narrowly suppressing specific ones.

## Performance Considerations

- Running the full `tox` matrix locally on every save is slow — scoping fast pre-commit checks (lint/format) separately from the slower full test suite (Molecule, integration tests) keeps the inner dev loop fast.

## Security Considerations

- `ansible-lint`'s security-relevant rules (e.g., flagging `no_log` omissions, risky `shell`/`command` usage) are a meaningful first line of defense when caught pre-commit rather than post-deploy.

## Interview Questions

- "What's the difference between ansible-lint and yamllint, and why use both?"
- "How would you set up a pre-commit hook pipeline for an Ansible repository?"
- "What debugging tools are available for a failing Ansible task mid-playbook?"

## Hands-On Lab

- Set up a `.pre-commit-config.yaml` with `ansible-lint` and `yamllint`, run `pre-commit install`, then intentionally commit a playbook with a lint violation and observe the commit being blocked.

## Summary

- The development toolkit's job is to move feedback as early as possible — editor-time (language server), commit-time (pre-commit), and CI-time (GitHub Actions/tox) — so problems are cheap to fix, not discovered in production.

## Next

Continue to [Part 29 — Contributing to Ansible](05-contributing-to-ansible.md).
