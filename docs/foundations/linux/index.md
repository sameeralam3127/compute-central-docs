---
title: "Linux for DevOps and SRE: Administration and Troubleshooting"
icon: lucide/terminal-square
description: "Linux for DevOps and SRE — permissions, processes, systemd, storage, SSH, patching, performance, boot recovery, SELinux, kernel tuning, and networking."
tags:
  - Linux
  - Overview
---

# Linux for DevOps

Linux is the operating system under almost everything you'll run: cloud instances, Kubernetes nodes, containers, and CI runners. This track covers the administration and troubleshooting skills you'll use every week, with commands you can run on any modern distribution. Examples use Ubuntu 24.04 LTS and note where RHEL-family systems differ.

## What You'll Learn

- How the filesystem, users, and permissions control access
- How processes, signals, and systemd services behave, and how to read their logs
- How to manage disks, filesystems, and LVM without losing data
- How to secure SSH and sudo, keep packages patched, and diagnose a slow server
- How to recover a server that won't boot, fix SELinux and AppArmor denials, tune the kernel, and configure networking

## Read in This Order

1. [Filesystem and Permissions](01-filesystem-and-permissions.md) — the directory layout, ownership, modes, special bits, ACLs, and `umask`
2. [Processes and Signals](02-processes-and-signals.md) — process states, `ps` and `/proc`, signals, zombies, priorities, and open files
3. [systemd and journald](03-systemd-and-journald.md) — units, writing a service, overrides, timers, sandboxing, and `journalctl`
4. [Storage, Disks, and LVM](04-storage-disks-and-lvm.md) — block devices, filesystems, `fstab`, LVM, growing cloud disks, and "disk full" incidents
5. [Users, sudo, and SSH Hardening](05-users-sudo-and-ssh-hardening.md) — accounts, groups, sudoers, key-based SSH, and a hardened `sshd` configuration
6. [Packages and Patching](06-package-management-and-updates.md) — apt and dnf, pinning, unattended security updates, and reboot handling
7. [Performance Troubleshooting](07-performance-troubleshooting.md) — the USE method and a 60-second triage for CPU, memory, disk, and network
8. [Boot Process and Recovery](08-boot-process-and-recovery.md) — GRUB, the initramfs, rescue and emergency mode, a broken `fstab`, and cloud instance recovery
9. [SELinux and AppArmor](09-selinux-and-apparmor.md) — reading denials and fixing labels, ports, booleans, and profiles instead of disabling them
10. [Kernel Tuning](10-kernel-tuning-sysctl-and-modules.md) — `sysctl`, the settings worth changing, kernel modules, and resource limits
11. [Network Configuration](11-network-configuration.md) — `ip`, static addresses with Netplan and `nmcli`, DNS, hostnames, and safe changes over SSH

## The Commands You'll Use Most

| Task | Command |
|---|---|
| What's using the disk? | `df -h`, `du -xh --max-depth=1 / \| sort -h` |
| What's running? | `ps aux --sort=-%cpu \| head`, `systemctl list-units --failed` |
| Why did the service fail? | `systemctl status app`, `journalctl -u app -e` |
| What's listening? | `ss -tulpn` |
| Who can read this file? | `ls -l`, `stat`, `getfacl` |
| Is the box overloaded? | `uptime`, `vmstat 1`, `iostat -xz 1` |
| Why was access denied by policy? | `sudo ausearch -m AVC -ts recent`, `sudo aa-status` |
| What are the addresses and routes? | `ip -br addr`, `ip route` |
| What did the last boot log? | `journalctl -b -1 -p err` |

## How This Connects to the Rest of the Site

| Linux concept | Shows up again in |
|---|---|
| Processes, namespaces, cgroups | [Docker: Linux namespaces](../../docker/04-linux-namespaces.md) and [cgroups](../../docker/05-cgroups.md) |
| systemd services | [Podman Quadlet units](../../docker/20-podman.md), Kubernetes node services (`kubelet`, `containerd`) |
| Permissions and users | Container `USER` directives, Kubernetes `securityContext` |
| SSH and sudo | [Ansible connectivity and become](../../ansible/getting-started/05-ssh-and-connectivity.md) |
| Performance tools | [Docker production troubleshooting](../../docker/24-production-troubleshooting.md) |

## Next

Start with [Filesystem and Permissions](01-filesystem-and-permissions.md).
