---
title: "Fix Ansible SSH Permission Denied (publickey)"
icon: lucide/key-round
description: "Fix Ansible SSH failures: UNREACHABLE, Permission denied (publickey), timeouts, host key verification, and no matching host key type (ssh-rsa)."
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

## `Unable to negotiate ... no matching host key type found. Their offer: ssh-rsa`

```text
fatal: [switch01]: UNREACHABLE! => {"msg": "Failed to connect to the host via ssh: Unable to negotiate with 10.0.5.20 port 22: no matching host key type found. Their offer: ssh-rsa"}
```

Your control node's OpenSSH is newer than the target's. Current OpenSSH releases no longer accept the legacy SHA-1 `ssh-rsa` signature algorithm or DSA keys, which old appliances, network gear, and end-of-life distributions still use. It usually appears right after the control node, CI image, or Execution Environment was upgraded, against hosts nobody touched.

The real fix is on the old host: upgrade it, or generate an `ed25519` or RSA-SHA2 host key. As a temporary exception, re-enable the algorithm for those hosts only:

```yaml title="group_vars/legacy_network.yml"
ansible_ssh_common_args: "-o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedAlgorithms=+ssh-rsa"
```

A variant with the same cause is `no matching key exchange method found`; add `-o KexAlgorithms=+diffie-hellman-group14-sha1` the same way. Track these exceptions and remove them when the host is fixed.

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
| `no matching host key type found` | SSH algorithms | Upgrade the old host; per-host `+ssh-rsa` exception meanwhile |
| `/usr/bin/python: not found` | Managed node | Bootstrap with `raw`, see [Architecture and Execution](../getting-started/02-architecture-and-execution.md) |
| `Missing sudo password` | `become` | See [Become and Permission Problems](02-become-and-permission-problems.md) |

## Interview Questions

- A task fails with `UNREACHABLE! Permission denied (publickey)` — walk through your diagnostic process.
- What's the difference between a connection timeout and a connection rejection, in terms of what's actually broken?

## Next

Continue to [Become and Permission Problems](02-become-and-permission-problems.md).
