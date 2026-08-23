---
icon: lucide/key-round
description: Diagnosing Ansible SSH and connection failures — UNREACHABLE, Permission denied (publickey), timeouts, and how to read -vvv output.
tags:
  - Ansible
  - Troubleshooting
  - SSH
---

# SSH and Connection Problems

The concepts behind each of these live in [SSH and Connectivity](../getting-started/05-ssh-and-connectivity.md) — this page is the symptom-first index.

## `UNREACHABLE! Permission denied (publickey)`

```text
fatal: [web01]: UNREACHABLE! => {"changed": false, "msg": "Failed to connect to the host via ssh: Permission denied (publickey)."}
```

SSH connected and was rejected — not a network problem.

```bash
ssh -vvv deploy@web01.example.com
```

Read the output for which keys were **offered** and why each was **rejected**. In order of frequency:

1. The public key was never added to `~/.ssh/authorized_keys` on the target.
2. Wrong username — `ansible_user` doesn't match a real account.
3. `~/.ssh` or `authorized_keys` permissions on the target are too open (`sshd` silently refuses to trust them — requires `700`/`600`).
4. The right key was never `ssh-add`-ed to a running `ssh-agent`.

## `UNREACHABLE! ... Connection timed out`

A **timeout**, not a rejection, means SSH never got a response at all — this is a network/firewall/security-group problem, not a credentials problem.

```bash
nc -zv web01.example.com 22
```

If this hangs or refuses, the issue is network reachability (firewall, security group, VPN/bastion routing), before Ansible or even SSH auth is relevant.

## `UNREACHABLE! ... Host key verification failed`

```text
fatal: [web01]: UNREACHABLE! => {"msg": "Host key verification failed."}
```

The host's SSH key fingerprint doesn't match what's in `~/.ssh/known_hosts` — either the host was rebuilt with a new key (expected after a redeploy) or, less commonly, something is actually intercepting the connection.

```bash
ssh-keygen -R web01.example.com    # remove the stale entry
ssh web01.example.com               # reconnect, verify the NEW fingerprint out-of-band, accept it
```

Never set `host_key_checking = False` as a blanket fix in production — see the security note in [SSH and Connectivity](../getting-started/05-ssh-and-connectivity.md#known_hosts-and-host-key-verification).

## Task Succeeds to Connect, but Fails on the Module Itself

```text
fatal: [web01]: FAILED! => {"msg": "/usr/bin/python: not found"}
```

This is **not** an SSH problem — SSH connected fine. It's a missing Python interpreter, covered by [Architecture and Execution](../getting-started/02-architecture-and-execution.md#why-managed-nodes-need-python) and [Module and Execution Errors](04-module-and-execution-errors.md).

## `become` Fails, but SSH Connected Fine

```text
fatal: [web01]: FAILED! => {"msg": "Missing sudo password"}
```

Two independent layers again — SSH auth succeeded, `become` (privilege escalation) is what's failing. See [Become and Permission Problems](02-become-and-permission-problems.md).

## Quick Reference

| Symptom | Layer | Fix starting point |
|---|---|---|
| `Permission denied (publickey)` | SSH auth | `ssh -vvv`, check `authorized_keys` |
| `Connection timed out` | Network | `nc -zv host port`, check firewall/security group |
| `Host key verification failed` | Known hosts | `ssh-keygen -R`, reconnect and verify |
| `/usr/bin/python: not found` | Managed node | Bootstrap with `raw`, see [Architecture and Execution](../getting-started/02-architecture-and-execution.md) |
| `Missing sudo password` | `become` | See [Become and Permission Problems](02-become-and-permission-problems.md) |

## Interview Questions

- A task fails with `UNREACHABLE! Permission denied (publickey)` — walk through your diagnostic process.
- What's the difference between a connection timeout and a connection rejection, in terms of what's actually broken?

## Next

Continue to [Become and Permission Problems](02-become-and-permission-problems.md).
