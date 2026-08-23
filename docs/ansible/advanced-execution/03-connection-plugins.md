---
icon: lucide/plug
description: Ansible connection plugins — ssh, local, docker, winrm, paramiko — and pipelining and ControlPersist as the two highest-value SSH performance settings.
tags:
  - Ansible
  - Advanced Execution
---

# Connection Plugins

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

`ssh` is the default and covers most cases, but Ansible's connection layer is pluggable — the same modules and JSON contract work over a completely different transport when the target isn't a normal SSH-reachable Linux box.

## What It Will Cover

- `ssh` (default) — shells out to the real local `ssh` binary; see [SSH and Connectivity](../getting-started/05-ssh-and-connectivity.md)
- `local` — runs "on" the control node itself, no network hop (useful for `delegate_to: localhost` tasks)
- `docker` — execs into a running container instead of connecting over the network
- `winrm` — Windows managed nodes, paired with `pywinrm`
- `paramiko` — a pure-Python SSH implementation, a fallback when the system `ssh` binary's behavior is undesirable
- **Pipelining** — skips writing the module to a temp file, piping it directly into a remote Python process instead; one of the highest-value performance settings available, with a `requiretty` sudoers caveat to know about
- **ControlPersist** — SSH connection multiplexing, reusing one connection across multiple tasks in the same run instead of a fresh handshake per task

## Common Mistakes

- Not enabling pipelining, leaving real performance on the table for free.
- Assuming `winrm` needs no extra setup — it requires `pip install pywinrm` and Windows-side configuration, unlike SSH which is on by default on most Linux distributions.

## Interview Questions

- What does pipelining change about how a module reaches the managed node?
- Why would you use the `docker` connection plugin instead of `ssh`?

## Next

Continue to [Lookup and Filter Plugins](04-lookup-and-filter-plugins.md).
