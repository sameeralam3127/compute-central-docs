---
title: "Linux for DevOps and SRE: Administration and Troubleshooting"
icon: lucide/terminal-square
description: "A practical Linux path for DevOps — files and permissions, processes, systemd, storage, SSH hardening, packages, and performance troubleshooting."
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

## Read in This Order

1. [Filesystem and Permissions](01-filesystem-and-permissions.md) — the directory layout, ownership, modes, special bits, ACLs, and `umask`
2. [Processes and Signals](02-processes-and-signals.md) — process states, `ps` and `/proc`, signals, zombies, priorities, and open files
3. [systemd and journald](03-systemd-and-journald.md) — units, writing a service, overrides, timers, sandboxing, and `journalctl`
4. [Storage, Disks, and LVM](04-storage-disks-and-lvm.md) — block devices, filesystems, `fstab`, LVM, growing cloud disks, and "disk full" incidents
5. [Users, sudo, and SSH Hardening](05-users-sudo-and-ssh-hardening.md) — accounts, groups, sudoers, key-based SSH, and a hardened `sshd` configuration
6. [Packages and Patching](06-package-management-and-updates.md) — apt and dnf, pinning, unattended security updates, and reboot handling
7. [Performance Troubleshooting](07-performance-troubleshooting.md) — the USE method and a 60-second triage for CPU, memory, disk, and network

## The Commands You'll Use Most

| Task | Command |
|---|---|
| What's using the disk? | `df -h`, `du -xh --max-depth=1 / \| sort -h` |
| What's running? | `ps aux --sort=-%cpu \| head`, `systemctl list-units --failed` |
| Why did the service fail? | `systemctl status app`, `journalctl -u app -e` |
| What's listening? | `ss -tulpn` |
| Who can read this file? | `ls -l`, `stat`, `getfacl` |
| Is the box overloaded? | `uptime`, `vmstat 1`, `iostat -xz 1` |

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
