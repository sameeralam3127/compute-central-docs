---
title: "Linux Kernel Tuning: sysctl, Kernel Modules, and Limits"
icon: lucide/cpu
description: "Tune the Linux kernel safely: persist sysctl settings, the values worth changing, kernel modules for Kubernetes nodes, and per-process resource limits."
tags:
  - Linux
  - Performance
---

# Kernel Tuning: sysctl, Modules, and Limits

Most servers never need kernel tuning, and copying a list of "performance sysctls" from a blog post causes more incidents than it prevents. Change a kernel setting when a specific error or measurement points to it, such as a full connection-tracking table, a database that refuses to start, or a node prerequisite. Then persist it in a file you can review.

## What You'll Learn

- How to read, change, and persist kernel parameters with `sysctl`
- Which parameters DevOps teams actually change, and the error that tells you to
- How to load, configure, and block kernel modules
- Why `limits.conf` doesn't affect systemd services, and what does
- How kernel settings behave inside containers and Kubernetes

## Mental Model

> The kernel exposes its tunable settings as files under `/proc/sys`. `sysctl` is a friendlier way to read and write them. A change takes effect immediately and disappears at reboot unless it's also written to a file in `/etc/sysctl.d/`, which systemd applies early in every boot.

```text
net.ipv4.ip_forward   <->   /proc/sys/net/ipv4/ip_forward
(dots in the name)          (slashes in the path)
```

## Read and Change Settings

```bash
sysctl net.ipv4.ip_forward                    # read one
cat /proc/sys/net/ipv4/ip_forward             # same value, as a file
sysctl -a 2>/dev/null | grep conntrack        # search all of them

sudo sysctl -w net.ipv4.ip_forward=1          # change now; lost at reboot
```

Persist it in a drop-in file named for its purpose:

```ini title="/etc/sysctl.d/90-kubernetes.conf"
# Required by Kubernetes nodes: route traffic between pods and the network
net.ipv4.ip_forward = 1
```

```bash
sudo sysctl --system                          # apply every sysctl file now
sudo sysctl -p /etc/sysctl.d/90-kubernetes.conf   # apply just one
```

Files in `/etc/sysctl.d/`, `/run/sysctl.d/`, and `/usr/lib/sysctl.d/` are read in filename order, and when two files set the same key, the later one wins. A file in `/etc/sysctl.d/` replaces a file with the same name in `/usr/lib/sysctl.d/`. Start your filenames with a high number such as `90-` so they apply after the distribution's defaults.

## Settings Worth Knowing

Each row starts from a symptom. If you don't have the symptom, leave the default.

| Setting | Default | Change it when |
|---|---|---|
| `net.ipv4.ip_forward` | `0` | The host routes traffic: Kubernetes nodes, VPN gateways, NAT instances |
| `net.core.somaxconn` | `4096` (kernel 5.4+) | A busy server drops new connections, `ss -lnt` shows a listener's `Recv-Q` (queued connections) reaching its `Send-Q` (the backlog limit), and `nstat -az TcpExtListenOverflows` keeps rising. The app's own backlog setting must be raised too. |
| `net.ipv4.ip_local_port_range` | `32768 60999` | A proxy or client making many outbound connections logs `Cannot assign requested address` |
| `net.netfilter.nf_conntrack_max` | Scales with RAM | The kernel log shows `nf_conntrack: table full, dropping packet` |
| `net.ipv4.tcp_keepalive_time` | `7200` (seconds) | Idle connections through a load balancer or NAT gateway are silently dropped after a few minutes |
| `vm.max_map_count` | `65530` on most distributions | Elasticsearch or OpenSearch refuses to start and asks for `262144` |
| `vm.swappiness` | `60` | Latency-sensitive services get swapped out while there's plenty of page cache to drop |
| `vm.overcommit_memory` | `0` | Redis warns about it at startup and recommends `1` |
| `fs.inotify.max_user_instances` | `128` | File watchers, IDEs, or a multi-node kind cluster fail with "too many open files" |
| `fs.inotify.max_user_watches` | Scales with RAM | A file watcher reports it hit the watch limit |

Confirm a symptom before changing anything. For example, a full connection-tracking table:

```bash
sudo dmesg -T | grep -i conntrack
cat /proc/sys/net/netfilter/nf_conntrack_count /proc/sys/net/netfilter/nf_conntrack_max
```

On Kubernetes nodes, kube-proxy sets `nf_conntrack_max` itself at startup, so change its configuration (`conntrack.maxPerCore`) instead of the sysctl.

Two pieces of old advice to ignore: `net.ipv4.tcp_tw_recycle` was removed in kernel 4.12 because it broke clients behind NAT, and raising `fs.file-max` rarely helps on a modern system. The per-process limit is what processes actually hit (see [Resource Limits](#resource-limits)).

## Kernel Modules

Drivers and optional kernel features are packaged as modules that load on demand.

```bash
lsmod | grep -E 'overlay|br_netfilter'        # is it loaded?
modinfo br_netfilter                          # description, parameters, file
sudo modprobe br_netfilter                    # load now (and its dependencies)
sudo modprobe -r br_netfilter                 # unload, if nothing is using it
```

Load modules at every boot with a file in `/etc/modules-load.d/`. This is the standard Kubernetes node setup:

```ini title="/etc/modules-load.d/kubernetes.conf"
overlay
br_netfilter
```

```ini title="/etc/sysctl.d/90-kubernetes.conf"
net.ipv4.ip_forward = 1
# Needed by CNI plugins that bridge pod traffic through iptables
net.bridge.bridge-nf-call-iptables = 1
net.bridge.bridge-nf-call-ip6tables = 1
```

The `net.bridge.*` settings only exist once `br_netfilter` is loaded, so load the module before running `sysctl --system`.

### Module options and blocking

```ini title="/etc/modprobe.d/hardening.conf"
# Block filesystems and devices a server never needs (CIS benchmark style)
install cramfs /bin/false
blacklist cramfs
install usb-storage /bin/false
blacklist usb-storage
```

`blacklist` only stops a module loading automatically. The `install ... /bin/false` line also stops anyone loading it with `modprobe`. If the module is included in the initramfs, rebuild it afterwards (see [Rebuild the initramfs](08-boot-process-and-recovery.md#rebuild-the-initramfs)).

## Resource Limits

Limits such as open files (`nofile`) and processes (`nproc`) apply to each process, and children inherit them. Where they come from depends on how the process started:

| Process started by | Limits come from |
|---|---|
| An SSH or console login, `su`, `sudo` | `/etc/security/limits.conf` and `/etc/security/limits.d/` (through PAM) |
| A systemd service | The unit's `LimitNOFILE=`, `LimitNPROC=`, and so on |
| All systemd services by default | `DefaultLimitNOFILE=` in `/etc/systemd/system.conf` |
| A container | The container runtime's defaults, or `--ulimit` / the pod spec |

That's why raising `nofile` in `limits.conf` doesn't fix "Too many open files" in a service: systemd services don't go through PAM. Set it in the unit instead:

```bash
sudo systemctl edit orders-api
```

```ini
[Service]
LimitNOFILE=65536
```

```bash
sudo systemctl restart orders-api
cat /proc/$(systemctl show -p MainPID --value orders-api)/limits | grep -i 'open files'
```

Reading `/proc/<pid>/limits` shows the limits a running process actually has, which settles any argument about which configuration file won.

## Containers and Kubernetes

Containers share the host kernel, so most kernel settings are host-wide:

- **Namespaced** settings, mostly under `net.*`, can differ per container. Docker sets them with `--sysctl`; Kubernetes with `securityContext.sysctls` on the pod. A small set of safe sysctls is allowed by default; others must be allowed on the node with the kubelet's `--allowed-unsafe-sysctls`.
- **Node-level** settings, including all of `vm.*` and `fs.inotify.*`, can only be set on the host. If OpenSearch in a pod needs `vm.max_map_count`, set it on the nodes, through node configuration or a privileged DaemonSet.
- Kernel **modules** can't be loaded from inside an unprivileged container. Load them on the node.

## Make Changes Safely

1. Find the error or metric that points to a setting.
2. Test with `sysctl -w` on one machine and measure the result.
3. Persist it in a commented file in `/etc/sysctl.d/`.
4. Roll it out with configuration management, for example the `ansible.posix.sysctl` module, so every host has the same value and the change is reviewed.

## Common Mistakes

- Pasting a list of tuning sysctls from the internet without a symptom to fix.
- Changing a value with `sysctl -w` and losing it at the next reboot.
- Raising `nofile` in `limits.conf` and expecting a systemd service to pick it up.
- Setting `net.bridge.*` keys before `br_netfilter` is loaded, so `sysctl --system` reports "No such file or directory."
- Trying to set node-level sysctls such as `vm.max_map_count` from inside a container.
- Raising `nf_conntrack_max` without asking why there are so many connections.

## Interview Questions

- How do you change a kernel parameter so it survives a reboot?
- A service logs "Too many open files" even though `limits.conf` sets `nofile` to 65536. Why?
- Which kernel settings does a Kubernetes node need, and why?
- What does `nf_conntrack: table full, dropping packet` mean, and how do you respond?
- Which sysctls can a container change, and which can't it?

## Next

Continue to [Network Configuration](11-network-configuration.md).
