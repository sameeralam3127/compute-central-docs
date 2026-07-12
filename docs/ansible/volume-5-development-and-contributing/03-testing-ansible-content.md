---
icon: lucide/check-circle
description: Testing Ansible content — ansible-test sanity/unit/integration tests, Molecule, pytest, and wiring it all into CI/CD with GitHub Actions.
tags:
  - Ansible
  - Volume 5
  - Testing
---

# Part 27 — Testing Ansible Content

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

Untested playbooks and modules are a liability the moment more than one person touches them. This chapter covers the real testing stack: `ansible-test`, Molecule, and pytest, tied into CI.

## Why This Exists

- Ansible content changes behavior on real infrastructure — a testing strategy isn't optional polish, it's the only thing standing between a bad change and a production incident.

## Problem Statement

- Different layers of Ansible content need different testing approaches: module Python code needs unit tests, module behavior against real state needs integration tests, and full role/playbook behavior needs scenario-based testing against real or containerized hosts.

## Internal Architecture

- **`ansible-test`**: the official test runner used by `ansible-core` and collections, providing `sanity` (style/API-contract checks), `unit` (pytest-based Python unit tests), and `integration` (running modules against real or containerized targets) subcommands.
- **Molecule**: a role/collection-level testing framework that provisions ephemeral test instances (Docker, Podman, cloud), runs a role against them, and asserts on the resulting state (often via `testinfra`/`pytest`).
- **pytest**: the underlying Python test framework `ansible-test unit` and Molecule's verifier both build on.

## Step-by-Step Explanation

- **Sanity tests**: `ansible-test sanity` — style, licensing headers, `argument_spec` correctness, documentation completeness checks required for collections targeting Ansible Galaxy/Automation Hub certification.
- **Unit tests**: `ansible-test units` — testing module logic (e.g., a module's parsing/decision functions) in isolation, without a real managed node.
- **Integration tests**: `ansible-test integration` — running a module/role against real or containerized targets and asserting on actual system state.
- **Molecule workflow**: `molecule init role`, then `molecule test` runs through create → converge → idempotence-check → verify → destroy, with the idempotence check specifically re-running the role and failing if anything reports `changed` the second time.
- **CI/CD with GitHub Actions**: wiring `ansible-lint`, `ansible-test sanity`, and `molecule test` into a workflow that runs on every pull request.

## Production Best Practices

- Running Molecule's idempotence check as a hard CI gate — a role that isn't idempotent on a second run is a production risk (directly enforces Volume 1, Part 5's principle).
- Running `ansible-test sanity` even for non-collection internal roles/modules, since its checks catch real correctness issues, not just style.

## Common Mistakes

- Testing only the "happy path" converge step and skipping the idempotence re-run, missing the most common class of real-world role bugs.
- Treating Molecule and `ansible-test` as interchangeable rather than complementary — Molecule tests roles/scenarios, `ansible-test` is the standard for modules/collections destined for Galaxy/Automation Hub.

## Performance Considerations

- Full Molecule matrix testing (multiple platforms/scenarios) can be slow in CI — scoping the test matrix to genuinely-supported platforms keeps CI fast without sacrificing real coverage.

## Security Considerations

- `ansible-test sanity`'s checks catch some classes of insecure module patterns (e.g., missing `no_log`) automatically — running it is a security control, not just a style gate.

## Interview Questions

- "What's the difference between ansible-test's sanity, unit, and integration tests?"
- "What does Molecule's idempotence check catch that a normal converge run wouldn't?"
- "How would you structure a CI pipeline to test an Ansible role before merging?"

## Hands-On Lab

- Scaffold a role with `molecule init role myrole --driver-name docker`, write a trivial task, and run `molecule test`, observing each phase (create, converge, idempotence, verify, destroy).

## Summary

- Real Ansible testing spans three layers — `ansible-test` for module/collection correctness and style, Molecule for role/scenario behavior including idempotence, and CI wiring to make both non-optional before merge.

## Next

Continue to [Part 28 — Development Toolkit](04-development-toolkit.md).
