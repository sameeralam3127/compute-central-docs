---
title: "Ansible First Playbook Tutorial: Ping to Deploy"
icon: lucide/play-circle
description: A hands-on lab — set up an inventory and ansible.cfg, run your first ad-hoc ping, then write and run a real playbook, with full expected output.
tags:
  - Ansible
  - Getting Started
  - Lab
---

# Your First Playbook

A runnable lab, start to finish. You need one Linux machine you can already SSH into (a cloud VM, a local VM, or a container is fine) — if you're not there yet, finish [SSH and Connectivity](05-ssh-and-connectivity.md) first.

## The Setup

```text
Your Laptop (control node)
      |
      | SSH (key-based)
      v
Linux Server (managed node)
```

Create a small project directory:

```text
ansible-lab/
├── ansible.cfg
├── inventory.ini
└── site.yml
```

```ini title="inventory.ini"
[web]
web01 ansible_host=203.0.113.10 ansible_user=deploy
```

```ini title="ansible.cfg"
[defaults]
inventory = inventory.ini
host_key_checking = True
```

`ansible.cfg` in the project directory means you don't have to pass `-i inventory.ini` on every command — Ansible picks it up automatically from the current directory.

## Step 1 — Prove the Connection

```bash
$ ansible web -m ping
web01 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3"
    },
    "changed": false,
    "ping": "pong"
}
```

This is an **ad-hoc command**: one module (`ping`), no playbook file. `SUCCESS` plus `"pong"` means SSH auth works and Ansible found a Python interpreter on the target. If this fails, stop here and work through [SSH and Connectivity](05-ssh-and-connectivity.md) — nothing past this point will work until `ping` succeeds.

## Step 2 — One More Ad-Hoc Command

```bash
$ ansible web -m command -a "uptime"
web01 | CHANGED | rc=0 >>
 14:32:01 up 3 days,  2:14,  1 user,  load average: 0.08, 0.03, 0.01
```

Ad-hoc commands are the right tool for a one-off check like this — see [Ad-Hoc Commands](../core-concepts/02-ad-hoc-commands.md) for when to reach for them versus a playbook.

## Step 3 — Write a Real Playbook

```yaml title="site.yml"
---
- name: Install and start nginx
  hosts: web
  become: true

  tasks:
    - name: Install nginx
      ansible.builtin.package:
        name: nginx
        state: present

    - name: Ensure nginx is running and enabled
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true
```

## Step 4 — Dry-Run It First

```bash
$ ansible-playbook site.yml --check --diff
```

`--check` runs every task's state comparison without making changes; `--diff` shows what would change. This costs nothing and catches syntax and logic errors before touching a real machine — see [Check Mode and Diff Mode](../core-concepts/10-check-mode-and-diff-mode.md).

## Step 5 — Run It

```bash
$ ansible-playbook site.yml

PLAY [Install and start nginx] ************************************

TASK [Gathering Facts] *********************************************
ok: [web01]

TASK [Install nginx] ***********************************************
changed: [web01]

TASK [Ensure nginx is running and enabled] *************************
changed: [web01]

PLAY RECAP **********************************************************
web01                      : ok=3    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

## Step 6 — Run It Again

```bash
$ ansible-playbook site.yml

PLAY RECAP **********************************************************
web01                      : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

`changed=0` on the second run is the whole point. Nothing changed because nothing *needed* to change — nginx was already installed and already running. This is [idempotency](../core-concepts/11-idempotency.md) made visible in one line of output, and it's what makes "just run the playbook again" a safe operational default instead of a gamble.

## What Actually Happened

| Line | What it means |
|---|---|
| `hosts: web` | Targets the `[web]` group from `inventory.ini` |
| `become: true` | Escalates privilege for this play's tasks (install/start need root) |
| `ansible.builtin.package` | A cross-distro module — resolves to `apt`, `dnf`, etc. depending on the target OS |
| `state: present` | Desired state: installed, don't care about exact version |
| `ansible.builtin.service` | Manages the running/enabled state of a service |
| `changed: [web01]` | The module compared current state to desired state and made a change |
| `ok: [web01]` | State already matched — nothing to do |

## Common Mistakes

- Skipping `--check --diff` and running straight against production on a playbook you just wrote.
- Forgetting `become: true` and getting a confusing "permission denied" from the *module*, not from SSH — easy to misdiagnose as a connection problem when it's actually a privilege problem. See [Troubleshooting](../troubleshooting/index.md).
- Not noticing `changed=2` on the first run and `changed=0` on the second — that comparison is your fastest idempotency check on any new playbook.

## Interview Questions

- What's the difference between an ad-hoc command and a playbook?
- Why run `--check --diff` before a real run?
- What does it mean if a task reports `changed` on every single run?

## Next

Continue to [Core Concepts](../core-concepts/index.md) to build the vocabulary behind every line you just wrote — inventory, modules, tasks, and variables.
