---
description: Learn how Linux namespaces isolate a container process's view of process IDs, networking, mounts, hostnames, IPC, users, and cgroups.
---

# 4. Linux Namespaces: Isolating a Process View

A container starts as a normal Linux process. **Namespaces** give that process an isolated view of selected kernel resources. They are not a magical VM and they do not, by themselves, limit CPU or memory.

| Namespace | Isolates | Simple analogy | Runtime use |
| --- | --- | --- | --- |
| PID | process-ID tree | a private process list | container sees its own PID 1 |
| network | interfaces, routes, ports | a private network room | its own `eth0`, loopback, and port space |
| mount | mount points | a private filesystem map | image root filesystem and mounts |
| UTS | hostname/domain name | a private name badge | container hostname |
| IPC | shared memory and message queues | a private noticeboard | avoids IPC collisions |
| user | user/group ID mappings | translated identities | rootless and least-privilege setups |
| cgroup | cgroup root view | a private resource-tree view | hides unrelated cgroup paths |

## Safe observation lab

Use a disposable Linux VM. These commands inspect, rather than modify, namespaces:

```bash
ps -o pid,user,comm -p 1
lsns
readlink /proc/1/ns/pid
readlink /proc/1/ns/net
```

An isolated shell can be created with `unshare` on a Linux host. The exact flags and privileges vary by distribution:

```bash
sudo unshare --fork --pid --mount-proc bash
ps -ef
exit
```

Inside, the shell is PID 1 in its new PID namespace. This is an educational experiment, not a full container: it has no image management, safe networking setup, lifecycle management, or resource limits.

`nsenter` can enter namespaces held by another process, and `ip netns` manages named network namespaces. Both are powerful troubleshooting tools; use them only against a lab host where you understand the target process.

## What a runtime does

An OCI runtime such as `runc` creates namespaces, mounts a root filesystem, configures IDs and capabilities, then starts the configured process. Docker normally hides those low-level steps. The process remains a process: `docker exec` later starts an additional process in the container's existing namespaces.

Namespaces separate *views*. Next, cgroups control how much of the host's resources the process group can consume.
