---
icon: lucide/hammer
description: ansible-dev-tools (ADT) — the single pip-installable bundle of ansible-builder, ansible-creator, ansible-dev-environment, ansible-lint, ansible-navigator, ansible-sign, molecule, pytest-ansible, and tox-ansible, with real commands for each.
tags:
  - Ansible
  - Production
  - Tooling
---

# ansible-dev-tools

## What You'll Learn

- What `ansible-dev-tools` (ADT) is, and why it exists as one package instead of ten separate installs
- What each bundled tool actually does, with real commands — including the ones nothing else in this documentation covers yet: `ansible-creator`, `ansible-dev-environment`, and `ansible-sign`
- How this relates to `ansible-lint`, Molecule, and Execution Environments, which already have their own pages

## Why This Exists

Building, testing, and shipping Ansible content well requires more than `ansible-core` — a linter, a test runner, a way to scaffold new collections consistently, a way to install a collection you're actively developing without publishing it first, and (for anything security-sensitive) a way to sign what you ship. Historically that meant `pip install`ing each of these separately and hoping the versions were mutually compatible. **`ansible-dev-tools`** is a single meta-package that installs all of them together, version-matched.

```bash
pip install ansible-dev-tools
```

Requires **Python 3.10+**. As with any Ansible tooling, prefer pipx or a project virtualenv over a global install — see [Installing Ansible](../getting-started/04-installing-ansible.md) for why.

```bash
$ adt --version
ansible-builder                          3.1.1
ansible-core                             2.21.1
ansible-creator                          26.8.0
ansible-dev-environment                  26.8.0
ansible-dev-tools                        0.1.dev50
ansible-lint                             26.8.0
ansible-navigator                        26.8.0
ansible-sign                             0.1.6
molecule                                 26.8.0
pytest-ansible                           26.8.0
tox-ansible                              26.8.0
```

`adt --version` is the fast way to confirm exactly what's installed and at what version — useful when comparing a teammate's environment to CI's, the same way `ansible --version` is for `ansible-core` alone.

## What's Bundled

| Tool | Purpose | Covered in depth |
|---|---|---|
| `ansible-core` | The engine itself | Everything in [Getting Started](../getting-started/index.md) onward |
| `ansible-builder` | Builds [Execution Environment](../enterprise-platform/03-execution-environments-and-hub.md) container images | [Execution Environments and Hub](../enterprise-platform/03-execution-environments-and-hub.md) |
| `ansible-creator` | Scaffolds new collections, playbook projects, and plugins | Below |
| `ansible-dev-environment` (`ade`) | Installs a collection you're actively developing into an isolated venv, editable | Below |
| `ansible-lint` | Lints playbooks, roles, and collections against best-practice rules | [CI/CD and Linting](06-cicd-and-linting.md) |
| `ansible-navigator` | TUI for running and inspecting playbooks, including against an Execution Environment | Below |
| `ansible-sign` | GPG-signs and verifies a project directory's contents | Below |
| `molecule` | Tests roles/collections against disposable instances | [Molecule Testing](07-molecule-testing.md) |
| `pytest-ansible` | pytest plugin: unit-tests collection code, exposes Molecule scenarios as fixtures | Below |
| `tox-ansible` | Generates a test matrix across Python/`ansible-core` version combinations | Below |

## `ansible-creator` — Scaffold Content Consistently

```bash
$ ansible-creator --help
usage: ansible-creator [-h] command ...

The fastest way to generate all your ansible content.

Positional arguments:
  command
    add           Add resources to an existing Ansible project.
    init          Initialize a new Ansible project.

Options:
  --version       Print ansible-creator version and exit.
  -h, --help      Show this help message and exit
```

```bash
ansible-creator init collection yourname.utils
ansible-creator add plugin yourname.utils lookup my_lookup
```

This is the modern counterpart to `ansible-galaxy collection init` (see [Build a Collection From Zero](../build-your-own/03-build-a-collection-from-zero.md)) — `init` scaffolds a new project (a collection or a playbook project) with a consistent, current layout, and `add` drops a new resource (a plugin, a role, a plugin filter) into an existing one without hand-creating the boilerplate each time.

## `ansible-dev-environment` (`ade`) — Editable Collection Installs

```bash
git clone git@github.com:yourname/ansible-collection-utils.git
cd ansible-collection-utils
ade install -e .[test] --venv .venv
```

`ade install -e` creates an isolated virtual environment, installs the collection's Python test requirements, installs `ansible-core`, builds the collection, and symlinks it into place for discovery — so changes to the collection's source are picked up immediately, with no rebuild-and-reinstall cycle. This is the missing piece between "editing collection source" and "actually seeing the change take effect" during active development.

```bash
ade uninstall yourname.utils
```

tears the environment back down.

## `ansible-navigator` — Run and Inspect Interactively

```bash
ansible-navigator run site.yml --mode stdout
ansible-navigator run site.yml --eei your-registry/your-ee:1.0.0
```

A text-based UI for running playbooks, browsing inventory, and inspecting task results interactively — `--mode stdout` gives the familiar linear output; the default interactive mode lets you drill into any task's full result without re-running with `-vvv`. `--eei` runs the playbook **inside** a specific Execution Environment image rather than on the bare control node — see [Execution Environments and Hub](../enterprise-platform/03-execution-environments-and-hub.md).

## `ansible-sign` — Sign and Verify a Project

```bash
$ ansible-sign project gpg-sign .
[OK   ] GPG signing successful!
[NOTE ] Checksum manifest: ./.ansible-sign/sha256sum.txt
[NOTE ] GPG summary: signature created
```

```bash
$ ansible-sign project gpg-verify .
[OK   ] GPG signature verification succeeded.
[OK   ] Checksum validation succeeded.
```

`gpg-sign` builds a checksum manifest of the project directory and signs it with a GPG key; `gpg-verify` checks a signed project's checksums and signature both still match. This is a supply-chain integrity control — proof a collection or playbook repository wasn't tampered with between being signed and being consumed — worth pairing with the practices in [Security](04-security.md) for anything distributed outside a tightly trusted team.

## `pytest-ansible` — Unit Testing Collection Code

```bash
pytest --collection yourname.utils
```

A pytest plugin that lets `pytest` act as a unit-test runner for collection content (custom modules, plugins) and exposes Molecule scenarios as pytest fixtures — useful when a project's test suite already standardizes on pytest and you want Ansible content tested the same way as everything else, rather than as a separate tool with its own invocation.

## `tox-ansible` — a Version Matrix, Not Just One Environment

`tox-ansible` is a `tox` plugin purpose-built for Ansible content: it generates a full test matrix across Python interpreter and `ansible-core` version combinations, runs `ansible-test sanity` for sanity checks and `pytest` for unit/integration tests, and leaves each `.tox/` environment intact afterward for local debugging. Its explicit design goal is that **a local `tox` run and a CI run produce the same result** — no more "passes on my machine, fails in the pipeline" caused by a Python or `ansible-core` version mismatch that a single fixed CI environment would have hidden.

## Why Bundle All of This

The alternative — `pip install`ing `ansible-lint`, `molecule`, `ansible-builder`, and the rest separately — works, but each tool's own dependency constraints can drift out of compatibility with the others over time, and nothing guarantees a teammate's separately-assembled toolchain matches yours or CI's. `ansible-dev-tools` pins a known-compatible set together, and `adt --version` gives one command to compare across machines.

## Common Mistakes

- Installing each tool separately out of habit instead of `ansible-dev-tools`, then debugging a version-mismatch issue between, say, `ansible-lint` and the `ansible-core` version actually in use.
- Using `ansible-galaxy collection init` and `ansible-creator init collection` interchangeably without realizing they can produce different scaffolds — pick one per project and stay consistent.
- Skipping `ade install -e` during collection development and instead repeatedly rebuilding and reinstalling the collection to test a one-line change.

## Interview Questions

- What problem does `ansible-dev-tools` solve that installing each tool separately doesn't?
- What does `ade install -e` do that a normal `ansible-galaxy collection install` doesn't?
- What does `ansible-sign` actually protect against, and where does that fit relative to [Vault](03-secrets-and-vault.md) (which protects something different)?

## Next

Continue to [Molecule Testing](07-molecule-testing.md) if you haven't already, or to [Case Studies](../case-studies/index.md).
