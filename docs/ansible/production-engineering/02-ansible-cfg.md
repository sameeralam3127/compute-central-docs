---
icon: lucide/settings
description: Every ansible.cfg setting that matters in production — search order and precedence, forks, SSH args, pipelining, timeouts, and privilege escalation.
tags:
  - Ansible
  - Production
  - Configuration
---

# ansible.cfg

## What You'll Learn

- Where Ansible looks for `ansible.cfg`, and which one wins if several exist
- The settings that actually matter day to day, grouped by purpose
- Why committing a project-level config beats relying on each engineer's own

## Search Order (Highest to Lowest)

1. `ANSIBLE_CONFIG` environment variable — an explicit path, always wins
2. `./ansible.cfg` — current directory
3. `~/.ansible.cfg` — home directory
4. `/etc/ansible/ansible.cfg` — system-wide default

Most "I changed the config and nothing happened" confusion is this list: someone edits `/etc/ansible/ansible.cfg` while a project-local `./ansible.cfg` (which wins) sits untouched two directories up.

Precedence between sources for any single setting: **CLI flag** (`--forks 20`) > **environment variable** (`ANSIBLE_FORKS=20`) > **`ansible.cfg` value** > **built-in default**.

```bash
ansible-config dump --only-changed
```

shows exactly which settings differ from their defaults, and which file each came from — the fastest way to confirm what's actually in effect.

## A Practical Production `ansible.cfg`

```ini title="ansible.cfg"
[defaults]
inventory = inventories/production/hosts.ini
remote_user = deploy
host_key_checking = True
forks = 20
retry_files_enabled = False
roles_path = roles
collections_path = collections

[ssh_connection]
pipelining = True
ssh_args = -o ControlMaster=auto -o ControlPersist=60s
control_path_dir = /tmp/.ansible-cp

[privilege_escalation]
become = True
become_method = sudo
become_user = root
become_ask_pass = False
```

## Settings by Category

| Category | Setting | Purpose |
|---|---|---|
| Core | `inventory` | Default inventory path — skips `-i` on every command |
| Core | `remote_user` | Default SSH user |
| Core | `host_key_checking` | See [SSH and Connectivity](../getting-started/05-ssh-and-connectivity.md) — do not disable carelessly |
| Performance | `forks` | Parallelism ceiling — see [Forks, Serial, Strategy](../advanced-execution/01-forks-serial-strategy-throttle.md) |
| Performance | `pipelining` | Skips the module-file-copy round trip — one of the highest-leverage settings available |
| Performance | `ssh_args` (ControlPersist) | Reuses one SSH connection across tasks instead of a fresh handshake per task |
| Behavior | `interpreter_python` | `auto` (default), or pin explicitly for a known fleet to skip probing cost |
| Behavior | `remote_tmp` | Where module code is staged on the managed node |
| Security | `become`, `become_method`, `become_user` | Privilege escalation defaults — see [Security](04-security.md) |

## Common Mistakes

- Editing `/etc/ansible/ansible.cfg` and being surprised a project-local `./ansible.cfg` overrides it.
- Relying on each engineer's own `~/.ansible.cfg` instead of committing a project-level file — behavior then silently differs machine to machine and diverges from CI.
- Enabling `pipelining` without disabling `requiretty` in the managed nodes' sudoers file — causes `become` failures that look unrelated to the actual cause.
- Disabling `host_key_checking` globally "to make errors go away" without understanding the MITM-risk tradeoff — see [SSH and Connectivity](../getting-started/05-ssh-and-connectivity.md).

## Interview Questions

- What is the search order Ansible uses to find `ansible.cfg`, and how does that interact with CLI flags and environment variables?
- What does `pipelining` do, and what's the one sudoers setting that has to change alongside it?
- Why commit a project-level `ansible.cfg` instead of relying on individual machine configuration?

## Next

Continue to [Secrets and Vault](03-secrets-and-vault.md).
