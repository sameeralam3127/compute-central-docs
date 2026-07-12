---
icon: lucide/terminal
description: Every Ansible CLI tool explained — ansible, ansible-playbook, ansible-config, ansible-doc, ansible-console, ansible-galaxy, ansible-vault, ansible-test, ansible-lint, ansible-navigator.
tags:
  - Ansible
  - Volume 2
  - CLI
---

# Part 7 — CLI Deep Dive

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

Ansible ships more command-line tools than most beginners ever discover. This chapter is a reference-grade tour of each one, what it's for, and the options that actually matter day to day.

## Why This Exists

- Most tutorials teach `ansible-playbook` and stop. Real operators also reach for `ansible-doc` to check module arguments mid-task, `ansible-console` to poke at hosts interactively, and `ansible-vault` constantly — this chapter gives each tool its due.

## Problem Statement

- Without knowing this toolkit exists, engineers reinvent things it already does: grepping module source instead of `ansible-doc`, hand-editing secrets instead of `ansible-vault`, or writing throwaway playbooks instead of `ansible-console`/ad hoc `ansible` commands.

## Internal Architecture

- All CLI entry points are thin wrappers around the same core library (`ansible.cli.*`) — they share config loading, inventory parsing, and connection plugin machinery, which is why flags like `-i`, `-l`, `-e`, `-vvv` behave consistently across tools.

## Step-by-Step Explanation (per tool)

- **`ansible`** — ad hoc module execution (`ansible all -m ping`, `-a`, `-m`, `-b`, `-K`).
- **`ansible-playbook`** — running playbooks; key flags: `--check`, `--diff`, `--limit`, `--tags`, `--skip-tags`, `--start-at-task`, `-e`, `--syntax-check`, `--list-tasks`, `--list-hosts`.
- **`ansible-config`** — `list`, `dump`, `view` subcommands to introspect effective configuration.
- **`ansible-doc`** — `-l` to list modules, `<module>` to show full argspec/docs/examples, `-s` for a snippet.
- **`ansible-console`** — REPL-style ad hoc execution against inventory, with tab completion and `become`.
- **`ansible-galaxy`** — `install`, `init`, `collection install`, `role init`, `list`.
- **`ansible-vault`** — `create`, `edit`, `encrypt`, `decrypt`, `view`, `rekey`, and `encrypt_string` for inline secrets.
- **`ansible-test`** — sanity/unit/integration test runner (previewed here, covered fully in Volume 5).
- **`ansible-lint`** — rule-based playbook/role linting (previewed here, covered fully in Volume 5).
- **`ansible-navigator`** — TUI for running/inspecting playbooks against Execution Environments (previewed here, covered fully in Volume 4).

## Production Best Practices

- Using `--check --diff` in CI/PR pipelines before any real apply.
- Using `ansible-config dump --only-changed` to document non-default settings for a project instead of assuming teammates know the defaults.

## Common Mistakes

- Running `ansible-playbook` without `--check` on unfamiliar playbooks against production inventory.
- Not knowing `ansible-doc <module>` exists and guessing at module argument names instead.

## Performance Considerations

- `-f`/`--forks` and `-vvv`/`-vvvv` verbosity flags and their cost — previewed here, covered fully in Volume 6.

## Security Considerations

- `ansible-vault` key management: password files vs. `--vault-id`, avoiding vault passwords in shell history or CI logs.

## Interview Questions

- "What's the difference between `ansible` and `ansible-playbook`?"
- "How would you look up a module's exact arguments without opening a browser?"
- "How does `ansible-vault` protect secrets in a playbook repository?"

## Hands-On Lab

- Use `ansible-doc -l | grep copy` to find the `copy` module, `ansible-doc copy` to read its arguments, then run it ad hoc with `ansible all -m copy -a "..."` against a local test host.

## Summary

- The CLI surface is larger than `ansible-playbook` alone — `ansible-doc` and `ansible-vault` in particular are tools you should be reaching for constantly, not occasionally.

## Next

Continue to [Part 8 — Inventory](02-inventory.md).
