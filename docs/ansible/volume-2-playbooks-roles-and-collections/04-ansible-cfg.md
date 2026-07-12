---
icon: lucide/settings
description: Every major ansible.cfg setting explained — search order and precedence, forks, SSH args, pipelining, timeouts, interpreter discovery, remote_tmp, and become settings.
tags:
  - Ansible
  - Volume 2
  - Configuration
---

# Part 10 — ansible.cfg

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

`ansible.cfg` is the single file most responsible for whether Ansible feels fast and predictable, or slow and mysterious. This chapter goes setting by setting.

## Why This Exists

- Defaults are safe but conservative; almost every production Ansible setup needs a tuned `ansible.cfg` to perform well and behave predictably — this chapter is the reference for making those changes deliberately instead of by cargo-culting a config from a blog post.

## Problem Statement

- Multiple `ansible.cfg` files can exist on a system, and Ansible silently picks one by a defined search order — not knowing that order leads to "I changed the config and nothing happened" confusion.

## Internal Architecture

- How configuration loads: `ansible.cfg` merges with environment variables (`ANSIBLE_*`) and CLI flags into a single in-memory config object at startup, with a strict precedence between the three.

## Search Order (highest to lowest)

1. `ANSIBLE_CONFIG` environment variable (explicit path)
2. `./ansible.cfg` (current directory)
3. `~/.ansible.cfg` (home directory)
4. `/etc/ansible/ansible.cfg` (system-wide default)

## Precedence Between Config Sources

- CLI flags (e.g., `-f 20`) > environment variables (`ANSIBLE_FORKS`) > `ansible.cfg` file value > built-in default.

## Step-by-Step Explanation — Key Settings by Category

- **`[defaults]` core behavior**: `inventory`, `remote_user`, `host_key_checking`, `retry_files_enabled`, `roles_path`, `collections_path`.
- **Forks**: `forks` — how many hosts are processed in parallel per batch (default 5, almost always raised in production).
- **SSH args**: `[ssh_connection] ssh_args`, `control_path`, `control_path_dir` — `ControlMaster`/`ControlPersist` tuning.
- **Pipelining**: `pipelining = True` — reduces the number of SSH operations per task (full mechanics covered in Volume 3).
- **Timeouts**: `timeout` (connection timeout).
- **Interpreter**: `interpreter_python` (`auto`, `auto_silent`, or an explicit path) — full discovery mechanics in Volume 3.
- **Remote tmp**: `remote_tmp` — where Ansible stages module code on the managed node.
- **Become**: `[privilege_escalation] become`, `become_method`, `become_user`, `become_ask_pass`.

## Production Best Practices

- Committing a project-level `ansible.cfg` to version control so behavior is consistent across every engineer's machine and CI, rather than relying on individual `~/.ansible.cfg` files.
- Explicitly setting `forks`, `pipelining`, and `host_key_checking` rather than leaving them at conservative defaults, once the security tradeoffs are understood.

## Common Mistakes

- Editing `/etc/ansible/ansible.cfg` and being surprised a project-local `./ansible.cfg` overrides it.
- Disabling `host_key_checking` globally without understanding the MITM-risk tradeoff it introduces.

## Performance Considerations

- `forks`, `pipelining`, and SSH `ControlPersist` settings are the three highest-leverage performance knobs in this file — previewed here, covered in full with benchmarks in Volume 6.

## Security Considerations

- `host_key_checking = False` disables SSH host key verification — convenient for ephemeral cloud instances, dangerous if disabled carelessly on long-lived infrastructure.
- Where `become_ask_pass` and privilege-escalation settings intersect with credential handling (deferred fully to Volume 6's security chapter).

## Interview Questions

- "What is the search order Ansible uses to find `ansible.cfg`?"
- "How do CLI flags, environment variables, and `ansible.cfg` values relate in precedence?"
- "What does `pipelining` do and why does it improve performance?"

## Hands-On Lab

- Create a project-local `ansible.cfg` setting `forks = 20` and `pipelining = True`, then confirm the effective value with `ansible-config dump --only-changed`.

## Summary

- `ansible.cfg` is not optional tuning — it's the difference between Ansible's cautious defaults and a configuration matched to your actual environment; know the search order so you're editing the file that's actually in effect.

## Next

Continue to [Part 11 — Playbooks](05-playbooks.md).
