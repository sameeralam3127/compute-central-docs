---
description: Learn Linux cgroups, CPU and memory control, accounting, cgroup v1 and v2, and what really happens when a container exceeds memory limits.
---

# 5. cgroups: Resource Control and Accounting

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
