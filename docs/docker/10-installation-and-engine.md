---
description: Learn Docker Engine, the CLI, daemon, contexts, Docker Desktop, and platform differences.
---

# Docker Installation and Engine

Docker Engine on Linux is normally a daemon and a CLI client. Verify the client/server relationship with `docker version`, `docker info`, and `docker context ls`.

The CLI sends API requests to the daemon through its selected context, commonly a local Unix socket. Membership in the `docker` group is effectively privileged daemon access; treat it as such.

macOS and Windows do not natively offer the Linux kernel features Linux containers need. Docker Desktop runs a Linux environment through virtualization and connects desktop tools to it. Windows commonly uses WSL 2 for Linux containers. Use Docker's current [official install guide](https://docs.docker.com/engine/install/) for distribution-specific installation steps.
