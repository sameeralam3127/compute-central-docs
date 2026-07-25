---
description: A safe conceptual lab combining Linux namespaces, a root filesystem, cgroups, and networking to show how container-style isolation works without Docker.
---

# 6. Build Container-Style Isolation Without Docker

Docker did not invent Linux process isolation. It made isolation, packaging, distribution, storage, networking, and lifecycle management usable together. This lab combines the underlying ideas without attempting to recreate Docker.

!!! danger "Use a disposable Linux VM"
    Mount, network, and cgroup operations require administrative privileges and can break host connectivity or processes if used carelessly. Do not run this lab on a shared or production machine.

## Ingredients

```text
prepared root filesystem
        + mount namespace
        + PID namespace
        + network namespace and veth pair
        + cgroup resource settings
        + one foreground process
        = container-style isolated workload
```

1. Obtain a minimal root filesystem built for your Linux distribution and CPU architecture.
2. Create namespaces with `unshare`; mount `/proc` inside the new mount/PID view.
3. Use `chroot` only to demonstrate a changed root directory. It is not a security boundary; production runtimes use safer, more complete setup procedures and may use `pivot_root`.
4. Attach a veth pair: one end in the network namespace, one end to a host bridge. Assign addresses and routes deliberately.
5. Put the workload process in a dedicated cgroup and observe its memory/CPU counters.
6. Start one foreground process. When PID 1 exits, the isolated workload is effectively finished.

```bash
# A small, PID-isolated shell experiment—not a complete container
sudo unshare --fork --pid --mount --uts --mount-proc bash
hostname lab-container
ps -ef
exit
```

`ip netns`, `ip link`, `ip addr`, `mount`, `chroot`, and cgroup files provide the pieces. A real runtime must also handle secure mount propagation, capabilities, user mappings, signals, logging, image layers, cleanup, error handling, and many platform differences. That engineering is why using a runtime is safer than hand-assembling production isolation.
