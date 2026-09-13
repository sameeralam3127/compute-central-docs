---
title: "cgroups: Limiting and Accounting for Resources"
icon: lucide/gauge
description: Learn Linux cgroups, CPU and memory control, accounting, cgroup v1 and v2, and what really happens when a container exceeds memory limits.
tags:
  - Docker
  - Linux
  - Containers Without Docker
---

# cgroups: Resource Control and Accounting

## What You'll Learn

- What cgroups control and account for: CPU, memory, processes, and I/O
- The difference between cgroup v1 and v2, and how to tell which a host uses
- Why a limit isn't a reservation
- What really happens when a process exceeds its memory limit

Namespaces stop one workload seeing another workload's resources. They do not stop a workload consuming all available CPU or memory. **Control groups (cgroups)** group processes so Linux can account for and constrain their resource use.

| Concern | cgroup role |
| --- | --- |
| CPU | weight, quota, and scheduling controls |
| Memory | accounting, limits, and reclamation behavior |
| Processes | grouped lifecycle and `pids` limit |
| I/O | controls or accounting, depending on configuration |

## v1 and v2

cgroup v1 organized controllers in separate hierarchies. cgroup v2 uses a unified hierarchy and has more consistent semantics. Modern distributions commonly use v2, but production systems may still expose v1 or hybrid layouts. Check a host with:

```bash
stat -fc %T /sys/fs/cgroup
cat /proc/cgroups
```

## Limits are not reservations

A CPU limit generally caps usable CPU time; it does not guarantee that CPU time is always available. A memory limit constrains a cgroup's memory use; it does not pre-allocate RAM for that container.

```text
Container A: 0.5 CPU, 256 MiB memory
Container B: 2 CPUs, 1 GiB memory
```

If A allocates beyond its effective memory limit, the kernel attempts reclaim. If it cannot reclaim enough, it can invoke an out-of-memory decision for processes in that cgroup. The application may be terminated and Docker may report an OOM-related exit. Investigate the application's logs, container state, memory limit, and host kernel logs—do not assume every exit code is an application bug.

!!! warning "Lab safety"
    Altering cgroups can disrupt other processes. Experiment only in a disposable VM, never by moving arbitrary production processes into a test cgroup.

Docker maps flags such as `--memory`, `--cpus`, and `--pids-limit` to runtime resource configuration. Limits improve containment and predictability; they do not replace capacity planning, application load testing, or observability.

## Common Mistakes

- Treating limits as reservations — a CPU or memory limit caps usage; it doesn't guarantee capacity.
- Assuming every exit code 137 is an application bug instead of checking for an OOM kill against the cgroup limit.
- Following cgroup v1 tutorials on a cgroup v2 host, where file names and hierarchy differ.
- Running containers without any limits on shared hosts, letting one workload starve the rest.

## Check Your Understanding

- What's the difference between what namespaces and cgroups do?
- Why doesn't a 1 GiB memory limit reserve 1 GiB of RAM?
- How would you confirm a container was killed by its memory limit?

## Next

Continue to [Build a Container Without Docker](06-build-a-container-with-linux.md) to combine namespaces and cgroups by hand.
