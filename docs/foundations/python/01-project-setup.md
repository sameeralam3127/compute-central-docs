---
title: "Python Project Setup With uv: Versions, venvs, and Lock Files"
icon: lucide/folder-cog
description: "Set up Python automation projects — install Python with uv, virtual environments, pyproject.toml, lock files, and the src layout."
tags:
  - Python
  - uv
---

# Project Setup

## What You'll Learn

- Why system Python and global `pip install` cause problems on servers
- How to install Python versions and manage projects with `uv`
- How `pyproject.toml` and a lock file make installs reproducible
- A project layout that scales from one script to a packaged tool

## Why Not System Python?

Your operating system's Python belongs to the operating system. Package managers and system tools depend on specific library versions in it, and modern distributions mark it as **externally managed** so `pip install` fails:

```text
error: externally-managed-environment
× This environment is externally managed
```

Don't work around this with `--break-system-packages` or `sudo pip`. Give every project its own isolated environment instead.

## Install uv

[uv](https://docs.astral.sh/uv/) installs Python versions, creates virtual environments, resolves and locks dependencies, and runs tools — replacing `pyenv`, `venv`, `pip`, `pip-tools`, and `pipx` with one fast binary.

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh      # Linux and macOS
# or: brew install uv   /   pipx install uv

uv --version
uv python install 3.14
uv python list
```

## Create a Project

```bash
uv init --package opsctl
cd opsctl
uv add httpx typer boto3 pyyaml jinja2 tenacity
uv add --dev pytest ruff mypy respx "moto[ec2]"
```

This creates:

```text
opsctl/
├── .python-version          # the Python version for this project
├── pyproject.toml           # metadata, dependencies, tool settings
├── uv.lock                  # exact resolved versions of everything — commit it
├── README.md
└── src/
    └── opsctl/
        └── __init__.py
```

### `pyproject.toml`

```toml title="pyproject.toml"
[project]
name = "opsctl"
version = "0.1.0"
description = "Operations helpers for the platform team"
readme = "README.md"
requires-python = ">=3.12"
dependencies = [
    "boto3>=1.40",
    "httpx>=0.28",
    "jinja2>=3.1",
    "pyyaml>=6.0",
    "tenacity>=9.0",
    "typer>=0.16",
]

[project.scripts]
opsctl = "opsctl.cli:app"          # installs an "opsctl" command

[dependency-groups]
dev = [
    "moto[ec2]>=5.1",
    "mypy>=1.17",
    "pytest>=8.4",
    "respx>=0.22",
    "ruff>=0.12",
]

[build-system]
requires = ["uv_build>=0.8,<1"]
build-backend = "uv_build"
```

- `dependencies` lists **compatible ranges** for what your code needs.
- `uv.lock` pins **exact versions and hashes** of every package, including transitive dependencies. Everyone and every CI run gets the same environment.

## Daily Commands

```bash
uv sync                          # create .venv and install exactly what's in uv.lock
uv run opsctl --help             # run inside the project environment, no activation needed
uv run pytest
uv add rich                      # add a dependency and update the lock
uv remove rich
uv lock --upgrade-package httpx  # upgrade one dependency deliberately
uv tree                          # dependency tree
```

In CI, fail if the lock file is out of date instead of silently resolving new versions:

```bash
uv sync --locked
```

## Running Standalone Tools

```bash
uvx ruff check .                 # run a tool in a temporary, cached environment
uv tool install ansible-core     # install a CLI tool globally, isolated from other tools
uv tool list
```

## Single-File Scripts With Inline Dependencies

For a one-off script that doesn't need a whole project, declare dependencies at the top of the file ([PEP 723](https://peps.python.org/pep-0723/)):

```python title="check_certs.py"
# /// script
# requires-python = ">=3.12"
# dependencies = ["httpx>=0.28"]
# ///
import ssl, socket, sys
from datetime import datetime, timezone

def days_left(host: str, port: int = 443) -> int:
    ctx = ssl.create_default_context()
    with socket.create_connection((host, port), timeout=5) as sock:
        with ctx.wrap_socket(sock, server_hostname=host) as tls:
            not_after = tls.getpeercert()["notAfter"]
    expires = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
    return (expires - datetime.now(timezone.utc)).days

for host in sys.argv[1:]:
    print(f"{host}: {days_left(host)} days")
```

```bash
uv run check_certs.py api.example.com shop.example.com
```

uv creates a cached environment with those dependencies automatically.

## The Standard Library `venv`

When uv isn't available, the standard library works fine:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"   # if dev dependencies are declared as an optional extra
deactivate
```

Always use `python -m pip`, so you know which interpreter you're installing into.

## Project Layout

```text
opsctl/
├── pyproject.toml
├── uv.lock
├── src/
│   └── opsctl/
│       ├── __init__.py
│       ├── cli.py              # command-line entry point — thin
│       ├── health.py           # logic, importable and testable
│       ├── aws_cleanup.py
│       └── config.py
└── tests/
    ├── test_health.py
    └── test_aws_cleanup.py
```

The `src/` layout forces tests to import the **installed** package, catching packaging mistakes that a flat layout hides. Keep `cli.py` thin: parse arguments, call functions in other modules, and turn results into output and exit codes.

## Deploying Automation

| Where it runs | Recommended approach |
|---|---|
| CI jobs | `uv sync --locked` then `uv run ...`, with uv's cache restored between runs |
| Servers (cron, systemd) | `uv tool install` from a Git tag or internal package index, or a container image |
| Containers | A multi-stage image: `uv sync --locked --no-dev` in the build stage, copy `.venv` into a slim runtime |
| AWS Lambda | Package dependencies into the deployment artifact or a layer, built for the Lambda architecture |

## Common Mistakes

- `sudo pip install` into system Python, breaking OS tools or getting overwritten by package upgrades.
- Not committing the lock file, so production installs different versions than the ones you tested.
- Unpinned or overly broad dependencies like `boto3` with no lower bound, silently pulling breaking changes.
- One giant `script.py` with logic, argument parsing, and AWS calls mixed together, impossible to test.
- Activating the wrong virtual environment and installing packages somewhere unexpected — `uv run` avoids the whole problem.

## Interview Questions

- Why shouldn't you install packages into the system Python on a server?
- What's the difference between the dependency ranges in `pyproject.toml` and a lock file?
- How would you make a Python tool's dependencies reproducible in CI?
- Why use a `src/` layout?

## Next

Continue to [CLI Tools and subprocess](02-cli-tools-and-subprocess.md).
