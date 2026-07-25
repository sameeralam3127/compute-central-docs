---
description: Learn Docker and Linux containers from first principles: application deployment, virtual machines, Linux isolation, OCI runtimes, Docker workflows, networking, storage, and production troubleshooting.
---

# Docker and Linux Containers: From First Principles

This course starts **before Docker**. You will first understand the deployment problems containers solve, the Linux features that make containers possible, and only then the Docker workflow that makes those features practical.

!!! tip "How to use this course"
    Read the chapters in order the first time. Run experiments only in a disposable Linux machine, VM, or local lab. Later chapters deliberately refer back to the mental models built early in the course.

## The idea in one picture

```mermaid
flowchart LR
    A[Traditional server deployment] --> B[Virtual machines]
    B --> C[Linux processes]
    C --> D[Namespaces + cgroups + root filesystem]
    D --> E[Container isolation]
    E --> F[OCI + runc + containerd]
    F --> G[Docker workflows]
    G --> H[Production operations]
```

A container is not a tiny virtual machine. It is a process, or a group of processes, given an isolated view of parts of a Linux system and a prepared filesystem. Docker builds a friendly workflow around creating, packaging, distributing, connecting, and operating those processes.

## Learning path

### Part I — Why containers exist

1. [How applications used to run](01-before-containers.md) — physical servers, monoliths, dependencies, configuration, and deployment conflicts.
2. [Virtual machines and KVM](02-virtual-machines-and-kvm.md) — why virtualization was a major improvement and where its costs remain.
3. [Application dependencies](03-application-dependencies.md) — why Python, Node.js, and Java applications fail when their runtimes and libraries differ.

### Part II — Containers without Docker

4. [Linux namespaces](04-linux-namespaces.md)
5. [cgroups and resource limits](05-cgroups.md)
6. [Build container-style isolation with Linux](06-build-a-container-with-linux.md)
7. [OCI standards](07-oci-standards.md)
8. [`runc`, `containerd`, and Docker architecture](08-runc-containerd-and-docker.md)

### Part III — Docker workflows

9. [What Docker actually solves](09-what-docker-solves.md)
10. [Installation and the Docker Engine](10-installation-and-engine.md)
11. [Essential commands as practical lifecycle tools](11-essential-docker-commands.md)
12. [Networking foundations](12-networking-fundamentals.md) and [Docker networking](13-docker-networking.md)
13. [Caddy web-application lab](14-caddy-web-app-lab.md)
14. [Storage](15-storage.md), [images](16-container-images.md), [Dockerfiles](17-dockerfiles.md), and [Compose](18-docker-compose.md)
15. [Registries and publishing](19-registries-and-publishing.md)

### Part IV — Beyond Docker

16. [Podman](20-podman.md)
17. [Kubernetes container runtimes](21-kubernetes-runtimes.md)
18. [macOS container architecture](22-macos-containers.md)
19. [Monoliths and microservices](23-monoliths-and-microservices.md)
20. [Production troubleshooting](24-production-troubleshooting.md)
21. [Course wrap-up](25-course-wrap-up.md)

## Before you start

You do not need Docker experience for Part I. Familiarity with a shell is useful, but every Linux-specific term will be introduced before it is used in a lab.

For the hands-on Linux isolation chapters, plan to use a disposable Linux VM. Some exercises require root privileges because creating network namespaces, changing mounts, and configuring cgroups are administrative operations.

## Existing quick references

If you already use Docker and need an immediate reference, the existing [Docker guide](docker.md) and [basic command reference](basic.md) remain available. They are supporting material—not the recommended starting point for a beginner.

## Course outcomes

By the end, you will be able to explain and investigate this chain:

```text
application → image → container process → namespaces + cgroups + filesystem
            → OCI runtime → container runtime → Docker or Kubernetes workflow
```

You will also know where the abstractions stop: a container shares a kernel, an image is not a running service, a published port is not a complete network design, and Docker does not make a distributed system simple by itself.
