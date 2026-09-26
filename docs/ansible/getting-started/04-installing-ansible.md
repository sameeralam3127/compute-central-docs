---
title: "How to Install Ansible on Linux, macOS, and Windows"
icon: lucide/download
description: "Install Ansible on Linux, macOS, or Windows (WSL) with pipx, uv, or a virtualenv, check which Python version you need, and fix externally-managed-environment."
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
    # Install pipx from the OS package manager, not with pip
    sudo apt install pipx          # Debian / Ubuntu
    sudo dnf install pipx          # Fedora / RHEL 9+ (EPEL on RHEL)
    brew install pipx              # macOS

    pipx ensurepath                # then open a new shell
    pipx install ansible-core
    ansible --version
    ```

    `pipx` builds an isolated virtual environment per tool and exposes only the CLI commands — you get a clean `ansible`/`ansible-playbook` on your `PATH` without polluting system Python.

    Need `ansible-lint` or a Python library such as `boto3` in the same environment? Inject it: `pipx inject ansible-core ansible-lint boto3`.

=== "uv"

    ```bash
    uv tool install ansible-core
    ansible --version
    ```

    [uv](https://docs.astral.sh/uv/) does the same job as pipx, much faster, and can fetch a suitable Python for you. Add extra libraries with `uv tool install ansible-core --with boto3`.

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
ansible [core 2.20.x]
  config file = None
  configured module search path = ['/home/user/.ansible/plugins/modules', ...]
  ansible python module location = /home/user/.local/share/pipx/venvs/ansible-core/lib/python3.12/site-packages/ansible
  ansible collection location = /home/user/.ansible/collections:/usr/share/ansible/collections
  executable location = /home/user/.local/bin/ansible
  python version = 3.12.3 (main, ...) [GCC 13.3.0]
  jinja version = 3.1.6
  pyyaml version = 6.0.2 (with libyaml v0.2.5)
```

This output tells you four things worth reading every time something behaves unexpectedly: the **ansible-core version**, which **config file** (if any) is active, which **Python interpreter** Ansible itself is running under, and whether PyYAML was built **with libyaml** (the fast C-based YAML parser — if it's missing, YAML parsing is slower and it's worth installing `libyaml-dev`/`libyaml-devel` and reinstalling PyYAML).

## Which Python Version Do You Need?

Every `ansible-core` release supports a window of Python versions: one window for the **control node** (where you run Ansible) and a wider one for **managed nodes** (where modules run). Each new release drops the oldest versions.

| ansible-core | Control node Python | Managed node Python |
|---|---|---|
| 2.17 | 3.10 – 3.12 | 3.7 – 3.12 |
| 2.18 | 3.11 – 3.13 | 3.8 – 3.13 |
| 2.19 | 3.11 – 3.13 | 3.8 – 3.13 |
| 2.20 | 3.12 – 3.14 | 3.9 – 3.14 |

The official [support matrix](https://docs.ansible.com/ansible/latest/reference_appendices/release_and_maintenance.html) is the source of truth and lists newer releases as they ship. Two consequences in practice:

- **pip quietly installs an older release on an older Python.** On a control node with Python 3.10, `pip install ansible-core` gives you 2.17, not the latest. `ansible --version` tells you which one you actually got.
- **Old managed nodes need a newer Python, not an older Ansible.** RHEL 8 ships Python 3.6 as its platform Python but offers newer ones as packages (`dnf install python3.12`). Point `ansible_python_interpreter` at the newer one for those hosts.

## "ansible-playbook: command not found"

The install worked, but the directory that holds the commands isn't on your `PATH`, or the commands were never exposed:

| Installed with | Cause | Fix |
|---|---|---|
| `pipx install ansible-core` | `~/.local/bin` isn't on `PATH` | `pipx ensurepath`, then open a new shell |
| `pipx install ansible` (without `--include-deps`) | The commands belong to the `ansible-core` dependency, which pipx doesn't expose by default | `pipx install --include-deps ansible`, or install `ansible-core` instead |
| `uv tool install ansible-core` | uv's tool directory isn't on `PATH` | `uv tool update-shell`, then open a new shell |
| `pip install --user` | `~/.local/bin` (Linux) or `~/Library/Python/3.x/bin` (macOS) isn't on `PATH` | Add that directory to `PATH` in your shell profile |
| A virtualenv | The environment isn't active in this shell | `source .venv/bin/activate` |

Check with `command -v ansible-playbook`. If it prints nothing, the shell can't find the command.

## "error: externally-managed-environment"

```text
$ pip install ansible-core
error: externally-managed-environment

× This environment is externally managed
╰─> To install Python packages system-wide, try apt install
    python3-xyz, where xyz is the package you are trying to
    install.
```

Ubuntu 23.04+, Debian 12+, Fedora, and Homebrew's Python mark the system interpreter as owned by the OS package manager ([PEP 668](https://peps.python.org/pep-0668/)), so a bare `pip install` is refused. This is the protection working as intended. Don't reach for `--break-system-packages`; install into an isolated environment instead:

```bash
pipx install ansible-core                 # a CLI tool for your user
# or
python3 -m venv .venv && . .venv/bin/activate && pip install ansible-core   # per project
```

The same error from `python3 -m pip install --user pipx` means pipx itself should come from the OS package manager (`apt install pipx`).

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
