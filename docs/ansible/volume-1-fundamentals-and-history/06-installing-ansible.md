---
icon: lucide/download
description: Installing Ansible on Linux, macOS, Windows/WSL — pip, pipx, virtualenv, dnf, apt, brew, source installs — and the difference between ansible-core and the ansible package.
tags:
  - Ansible
  - Volume 1
  - Installation
---

# Part 6 — Installing Ansible

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

Installing Ansible looks like a five-minute task until you hit your first `ansible-core` vs. `ansible` package confusion, or a system-Python-vs-virtualenv conflict. This chapter is the definitive, no-surprises installation reference.

## Why This Exists

- Bad installs (wrong Python, globally pip-installed packages fighting the OS package manager, mismatched `ansible-core` versions across a team) are one of the most common sources of "it works on my machine" bug reports in real teams.

## Problem Statement

- The control node needs a working Python + Ansible install; the *managed* node's Python requirements are a separate, later concern (Volume 3).
- Multiple install paths exist (OS package manager, pip, pipx, source) and they are not equivalent — this chapter explains which to use when.

## History / Context

- Why `ansible-core` and the full `ansible` package split apart (previewed here, covered fully in Volume 2's collections chapter and Volume 1's own "what is Ansible" framing) — installing "ansible" today means something different than it did before the Collections model.

## Internal Architecture

- How each install method actually places files: OS packages install into system Python site-packages; pip installs into whatever Python environment is active; pipx creates an isolated virtual environment per tool and exposes only the CLI entry points; source installs run from a git checkout with `pip install -e`.

## Step-by-Step Explanation

- **Linux**: `dnf install ansible-core` (Fedora/RHEL family) vs. `apt install ansible` (Debian/Ubuntu) — version currency tradeoffs vs. pip.
- **macOS**: `brew install ansible`.
- **Windows**: not a supported control node natively — use **WSL** (Windows Subsystem for Linux) and install as Linux inside it.
- **Python virtualenv**: `python3 -m venv .venv && source .venv/bin/activate && pip install ansible-core`.
- **pipx**: `pipx install --include-deps ansible` — isolated, recommended for keeping Ansible's dependencies away from other Python projects.
- **pip** (direct, less recommended for daily use): `pip install ansible-core` or `pip install ansible` for the full community package.
- **Source/development installation**: cloning `github.com/ansible/ansible` and running `pip install -e .` for contributors (previewed here, covered fully in Volume 5).
- Verifying an install: `ansible --version`, showing what the version output actually tells you (ansible-core version, config file location, Python version in use, jinja2/libyaml status).

## Production Best Practices

- Pin `ansible-core` (and any collections) to specific versions per project, typically via `requirements.txt`/`pipx`/a project virtualenv, rather than relying on whatever the OS package manager ships.
- Keep control-node Ansible installs isolated per project with pipx or virtualenv so upgrading for one project can't silently break another.

## Common Mistakes

- Installing with `sudo pip install ansible` globally and fighting the OS package manager later.
- Assuming `apt`/`dnf` ship the latest `ansible-core` (they usually lag).
- Trying to run Ansible natively on Windows instead of via WSL.

## Performance Considerations

- Not a major factor at install time; noted briefly (install method doesn't affect runtime performance meaningfully).

## Security Considerations

- Preferring pipx/virtualenv isolation over global installs to limit the blast radius of a compromised or vulnerable dependency.
- Verifying package sources (PyPI package name confusion risks — installing the right `ansible-core`/`ansible` package, not a similarly-named malicious package).

## Interview Questions

- "What's the difference between installing `ansible-core` and `ansible`?"
- "Why would you use pipx instead of a plain `pip install` for a CLI tool like Ansible?"
- "How do you run Ansible on Windows?"

## Hands-On Lab

- Install Ansible fresh using pipx, run `ansible --version`, and identify from the output which Python interpreter and config file Ansible is using.

## Summary

- The recommended path for most users is pipx (or a project virtualenv) with `ansible-core` (adding the full `ansible` community package only when its bundled collections are needed) — isolated from system Python and easy to pin per project.

## Next

Volume 1 is complete. Continue to [Volume 2: Playbooks, Roles & Collections](../volume-2-playbooks-roles-and-collections/index.md).
