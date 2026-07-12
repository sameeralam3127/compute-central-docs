---
icon: lucide/book-open
description: Volume 5 of the Ansible book series — module and plugin architecture, writing custom modules and plugins, testing Ansible content, the development toolkit, and contributing to Ansible Core.
tags:
  - Ansible
  - Volume 5
---

# Volume 5: Developing Modules, Plugins & Contributing

!!! info "Volume status"
    This volume is at the outline stage. Each chapter below has its structure and scope defined; full prose is being written chapter by chapter after Volumes 1-4.

## Who This Volume Is For

Python developers and advanced automation engineers who want to extend Ansible rather than just consume it — writing custom modules or plugins for internal use, or contributing to `ansible-core` and community collections upstream.

## Prerequisites

[Volume 3: Core Internals & Python Architecture](../volume-3-core-internals/index.md) — module and plugin development only makes sense once the execution engine, module loader, and connection plugin architecture are understood.

## Chapters

1. [Module Architecture](01-module-architecture.md) — how modules are written, the Python API, arguments, return values, check mode, diff mode, and writing one from scratch
2. [Plugin Architecture](02-plugin-architecture.md) — action, lookup, filter, cache, connection, strategy, inventory, vars, and callback plugins, and writing custom ones
3. [Testing Ansible Content](03-testing-ansible-content.md) — `ansible-test`, Molecule, pytest, sanity/integration/unit tests, and CI/CD
4. [Development Toolkit](04-development-toolkit.md) — VS Code, dev containers, `ansible-lint`, `yamllint`, pre-commit, black, ruff, tox, and the language server
5. [Contributing to Ansible](05-contributing-to-ansible.md) — developer setup, running tests, building docs, submitting PRs, and coding standards

## What You Will Be Able to Do After This Volume

- Write a custom Ansible module that correctly supports check mode, diff mode, and idempotency
- Write a custom plugin (filter, lookup, or callback) to extend Ansible's behavior for your team's needs
- Set up a real testing pipeline for Ansible content, from `ansible-lint` through Molecule to CI
- Submit a well-formed pull request to `ansible-core` or a community collection

## Next

Continue to [Volume 6: Production Best Practices, Performance & Troubleshooting](../volume-6-production-and-performance/index.md).
