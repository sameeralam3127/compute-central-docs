---
title: "How to Install Ansible on Linux, macOS, and Windows"
icon: lucide/download
description: Installing Ansible on Linux, macOS, and Windows (via WSL) — pipx, virtualenv, and OS package managers — and the difference between ansible-core and the ansible package.
tags:
  - Ansible
  - Getting Started
  - Installation
---

# Installing Ansible

## What You'll Learn

- The difference between `ansible-core` and the full `ansible` package
- How to install Ansible cleanly on Linux, macOS, and Windows
- Why a global `sudo pip install` is the wrong way to do it

## `ansible-core` vs. `ansible`

- **`ansible-core`** — the engine: the CLI tools, the execution engine, and the `ansible.builtin` modules. Nothing else.
- **`ansible`** — `ansible-core` plus a large, curated bundle of community and partner **collections** (cloud modules, network modules, and more), for people who want a "batteries included" install.

Most production setups pin `ansible-core` explicitly and add only the specific collections they actually use via `requirements.yml` (see [Collections](../collections/index.md)), rather than installing everything the `ansible` bundle ships.

## Install It Isolated, Not Global

!!! warning "Don't `sudo pip install ansible`"
    A global pip install fights your OS package manager, makes upgrades risky for every other Python tool on the machine, and means every project on the box is stuck on one Ansible version. Use **pipx** or a per-project **virtualenv** instead.

=== "pipx (recommended)"

    ```bash
    python3 -m pip install --user pipx
    pipx ensurepath
    pipx install --include-deps ansible-core
    ansible --version
    ```

    `pipx` builds an isolated virtual environment per tool and exposes only the CLI commands — you get a clean `ansible`/`ansible-playbook` on your `PATH` without polluting system Python.

=== "virtualenv (per project)"

    ```bash
    python3 -m venv .venv
    source .venv/bin/activate
    pip install ansible-core
    ansible --version
    ```

    Best when a project needs a pinned Ansible version tracked in `requirements.txt` alongside the rest of its tooling.

=== "Ubuntu / Debian"

    ```bash
    sudo apt update
    sudo apt install ansible
    ```

    Fast, but the packaged version usually lags behind the latest `ansible-core` release. Fine for learning; pin explicitly for production.

=== "RHEL / Fedora"

    ```bash
    sudo dnf install ansible-core
    ```

=== "macOS"

    ```bash
    brew install ansible
    ```

=== "Windows"

    Windows cannot run Ansible natively as a control node — install [WSL](https://learn.microsoft.com/windows/wsl/install), then follow the Ubuntu/Debian steps **inside** the WSL Linux environment.

## Verify the Install

```bash
$ ansible --version
ansible [core 2.17.4]
  config file = None
  configured module search path = ['/home/user/.ansible/plugins/modules', ...]
  ansible python module location = /home/user/.local/pipx/venvs/ansible-core/lib/python3.12/site-packages/ansible
  ansible collection location = /home/user/.ansible/collections:/usr/share/ansible/collections
  executable location = /home/user/.local/bin/ansible
  python version = 3.12.3 (main, ...) [GCC 13.2.0]
  jinja version = 3.1.4
  libyaml = True
```

This output tells you four things worth reading every time something behaves unexpectedly: the **ansible-core version**, which **config file** (if any) is active, which **Python interpreter** Ansible itself is running under, and whether **libyaml** is available (the fast C-based YAML parser — if `False`, YAML parsing is slower and it's worth installing `libyaml-dev`/`libyaml-devel` and reinstalling PyYAML).

## Common Mistakes

- Installing globally with `sudo pip install ansible`, then fighting version conflicts with the OS package manager forever after.
- Assuming `apt`/`dnf` ship the latest `ansible-core` — they usually lag by a version or more; use pipx/virtualenv when you need currency.
- Trying to run `ansible-playbook` directly on Windows PowerShell instead of inside WSL.
- Confusing "install Ansible on the control node" with "install Ansible on managed nodes" — see [Control Node vs. Managed Nodes](03-control-node-vs-managed-nodes.md). Managed nodes need Python, not Ansible.

## Interview Questions

- What's the difference between installing `ansible-core` and `ansible`?
- Why would you use pipx instead of a plain `pip install` for a CLI tool like Ansible?
- How do you run Ansible on Windows?

## Next

Continue to [SSH and Connectivity](05-ssh-and-connectivity.md) — the step where most beginners get stuck first.
