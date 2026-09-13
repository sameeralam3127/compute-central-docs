---
title: "How to Install Ansible Collections"
icon: lucide/download
description: Installing and using Ansible collections — requirements.yml, version pinning, ansible-galaxy collection install, and offline installs.
tags:
  - Ansible
  - Collections
---

# Installing and Using Collections

## What You'll Learn

- How the `ansible` package and `ansible-core` differ in the collections they include
- How to pin collections in `requirements.yml` and install them per project
- Where Ansible searches for collections, and how to check which version it's using
- How to install from Git, a private Automation Hub, or with no internet at all

## Why This Exists

Most modules you use aren't in `ansible-core`. How a project installs collections decides whether a playbook behaves the same on a laptop, a CI runner, and a controller six months from now.

## ansible vs. ansible-core

| Install | Contains |
|---|---|
| `pip install ansible-core` | The engine, CLI tools, and `ansible.builtin` only |
| `pip install ansible` | `ansible-core` **plus** a large curated set of community collections |

The `ansible` package is convenient for learning. For real projects, install `ansible-core` and declare exactly the collections you need — so nothing changes when someone upgrades the bundle.

## requirements.yml

```yaml title="collections/requirements.yml"
---
collections:
  # Exact pin for anything the playbooks depend on heavily
  - name: amazon.aws
    version: "9.4.0"

  # A range that accepts compatible minor and patch releases
  - name: community.general
    version: ">=10.2.0,<11.0.0"

  - name: ansible.posix
    version: "2.0.0"

  # From Git, pinned to a tag
  - name: https://git.example.com/platform/acme.platform.git
    type: git
    version: v1.4.0
```

Commit this file. Treat it like `requirements.txt` or `package-lock.json` — the definitive list of what the project runs on.

## Installing Per Project

```bash
ansible-galaxy collection install -r collections/requirements.yml -p ./collections
```

```ini title="ansible.cfg"
[defaults]
collections_path = ./collections
```

Installing into the project directory (and ignoring `./collections/ansible_collections/` in Git) means two projects on the same machine can use different versions without interfering.

Add `--force` to reinstall a pinned version you changed, or `--upgrade` to move within a range.

## Where Ansible Looks

In order, Ansible searches:

1. A `collections/` directory **next to the playbook** being run
2. Each path in `collections_path` (`ANSIBLE_COLLECTIONS_PATH`)
3. The default user and system paths (`~/.ansible/collections`, `/usr/share/ansible/collections`)
4. Collections bundled with the `ansible` Python package, if installed

The first match wins. That's why a user-wide install can silently shadow — or be shadowed by — the version a project expects.

## Checking What's Actually Used

```bash
# Every installed collection and where it lives
ansible-galaxy collection list

# One collection
ansible-galaxy collection list community.general

# Where a specific module resolves from
ansible-doc -t module community.general.ufw | head -5
```

If `collection list` shows the same collection in two paths, the one listed under the earlier search path is the one your playbooks load.

## Using Collections in Playbooks

Always use fully qualified names:

```yaml
- name: Harden SSH
  hosts: all
  become: true
  tasks:
    - name: Allow SSH through the firewall
      community.general.ufw:
        rule: allow
        port: "22"
        proto: tcp
```

The play-level `collections:` keyword lets you write short names, but it reintroduces ambiguity and `ansible-lint` flags short names. Prefer FQCNs.

## Private Automation Hub and Galaxy Servers

```ini title="ansible.cfg"
[galaxy]
server_list = private_hub, release_galaxy

[galaxy_server.private_hub]
url = https://hub.example.com/api/galaxy/content/published/
token = ${PRIVATE_HUB_TOKEN}

[galaxy_server.release_galaxy]
url = https://galaxy.ansible.com/
```

Servers are tried in order. Keep tokens out of the file itself; supply them with environment variables such as `ANSIBLE_GALAXY_SERVER_PRIVATE_HUB_TOKEN`.

## Offline and Air-Gapped Installs

On a machine with internet access:

```bash
ansible-galaxy collection download -r collections/requirements.yml -p ./offline-collections
ls offline-collections/
# amazon-aws-9.4.0.tar.gz  ansible-posix-2.0.0.tar.gz  community-general-10.2.0.tar.gz  requirements.yml
```

`download` fetches the pinned collections **and their dependencies** as tarballs, plus a `requirements.yml` pointing at them. Copy the directory across, then on the isolated machine:

```bash
cd offline-collections
ansible-galaxy collection install -r requirements.yml -p /opt/ansible/collections --offline
```

Python libraries those collections need (such as `boto3` for `amazon.aws`) must be mirrored separately. [Execution Environments](../enterprise-platform/03-execution-environments-and-hub.md) solve both problems at once by shipping everything in one image.

## Verifying Integrity

```bash
ansible-galaxy collection verify -r collections/requirements.yml
```

`verify` compares installed files against the checksums of the published version, catching local edits to installed collection code.

## Common Mistakes

- Installing collections user-wide with no `requirements.yml`, so a teammate's environment silently has different versions.
- Not pinning versions, letting a collection update change module behavior underneath an otherwise-unchanged playbook.
- Depending on the `ansible` bundle in CI while developing against a different bundle version locally.
- Committing the installed `ansible_collections/` tree instead of `requirements.yml`.
- Installing collections offline but forgetting the Python dependencies they import.

## Interview Questions

- Why should collection versions be pinned in `requirements.yml` rather than installed ad hoc?
- How would you prepare an air-gapped install of the collections a project needs?
- Two versions of `community.general` are installed. How do you find out which one a playbook uses?
- What's the difference between installing `ansible` and `ansible-core`?

## Next

Continue to [Publishing Collections](03-publishing-collections.md).
