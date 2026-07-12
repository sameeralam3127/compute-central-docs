---
icon: lucide/box
description: How Ansible modules are architected — the Python API, argument specs, return values, JSON contract, error handling, idempotency, check mode, diff mode, and writing a custom module from scratch.
tags:
  - Ansible
  - Volume 5
  - Modules
---

# Part 25 — Module Architecture

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

This chapter turns "modules are Python scripts that return JSON" (Volume 3) into a full implementation guide, ending with a custom module built from scratch.

## Why This Exists

- Every playbook is ultimately a sequence of module calls — understanding module internals is what separates "consumes Ansible" from "can fix or extend it."

## Problem Statement

- A module has to satisfy a strict contract (accept arguments a specific way, return JSON a specific way, support `--check`/`--diff`) so that the execution engine, callback plugins, and `-C`/`--diff` flags all work uniformly across thousands of different modules written by different authors.

## Internal Architecture

- **`AnsibleModule` (the Python API)**: the base class handling argument parsing/validation, `no_log` redaction, exit/fail helpers (`exit_json`, `fail_json`), and check-mode awareness.
- **Ansiballz packaging**: how a module's source, plus the `AnsibleModule` boilerplate and any `module_utils` imports, get assembled into a single self-contained zipapp shipped to the managed node (previewed in Volume 3, Part 17).
- **Argument spec**: the `argument_spec` dict declaring each parameter's type, required-ness, defaults, choices, and mutual exclusivity — the same spec both validates input and generates `ansible-doc` documentation.
- **Return values**: the `RETURN` docstring block and the actual JSON keys a module emits (`changed`, `failed`, module-specific data) — contract that downstream tasks' `register:` results depend on.

## Step-by-Step Explanation — Writing a Module From Scratch

1. Define `DOCUMENTATION`, `EXAMPLES`, and `RETURN` YAML docstrings (source of truth for `ansible-doc`).
2. Define `argument_spec` and instantiate `AnsibleModule(argument_spec=..., supports_check_mode=True)`.
3. Implement the check-current-state-then-act pattern: read current state, compare to desired state from arguments, only change what differs.
4. Respect `module.check_mode`: compute and report what *would* change without actually changing it.
5. Call `module.exit_json(changed=bool, **result_data)` on success or `module.fail_json(msg=...)` on failure.
6. Handle diff mode by populating a `before`/`after` structure when `--diff` is requested.

## Production Best Practices

- Writing modules to be idempotent by construction (check-then-act), not by accident — this is the single most important property a module must have (ties directly to Volume 1, Part 5).
- Using `module_utils` to share logic across a family of related modules instead of duplicating code.
- Never logging sensitive argument values — using `no_log=True` on any password/token/secret argument in the spec.

## Common Mistakes

- Writing a module that always reports `changed=True` regardless of actual state, breaking idempotency and handler-notification behavior for consumers.
- Not implementing check-mode support (`supports_check_mode=True` combined with actually honoring `module.check_mode`), silently making the module unsafe to use with `--check`.
- Swallowing exceptions instead of calling `fail_json` with a clear message, producing confusing downstream failures.

## Performance Considerations

- Expensive current-state lookups (e.g., large API calls) inside a module run on every task execution — caching or scoping those lookups matters at scale.

## Security Considerations

- `no_log` for sensitive arguments; validating and sanitizing any values passed to subprocess calls inside a module to avoid command injection when a module shells out.

## Interview Questions

- "What does a module have to do to correctly support check mode?"
- "How does argument_spec relate to both validation and ansible-doc's generated documentation?"
- "Why is the check-then-act pattern central to writing an idempotent module?"

## Hands-On Lab

- Write a minimal custom module (e.g., one that ensures a line exists in a file) supporting `argument_spec`, check mode, and diff mode, place it in a project's `library/` directory, and call it from a playbook.

## Summary

- A well-built module is defined by its contract (`DOCUMENTATION`/`EXAMPLES`/`RETURN`, `argument_spec`, JSON exit contract) and its behavior (check-then-act idempotency, check-mode and diff-mode support) — both halves matter equally.

## Next

Continue to [Part 26 — Plugin Architecture](02-plugin-architecture.md).
