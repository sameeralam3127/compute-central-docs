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
    classDef foundation fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef kernel fill:#dcfce7,stroke:#16a34a,color:#14532d
    classDef tooling fill:#fef3c7,stroke:#d97706,color:#78350f
    classDef operations fill:#fce7f3,stroke:#db2777,color:#831843
    class A,B,C foundation
    class D,E kernel
    class F,G tooling
    class H operations
```

A container is not a tiny virtual machine. It is a process, or a group of processes, given an isolated view of parts of a Linux system and a prepared filesystem. Docker builds a friendly workflow around creating, packaging, distributing, connecting, and operating those processes.

## Learning path

### Part I — Why containers exist

- [How applications used to run](01-before-containers.md) — physical servers, monoliths, dependencies, configuration, and deployment conflicts.
- [Virtual machines and KVM](02-virtual-machines-and-kvm.md) — why virtualization was a major improvement and where its costs remain.
- [Application dependencies](03-application-dependencies.md) — why Python, Node.js, and Java applications fail when their runtimes and libraries differ.

### Part II — Containers without Docker

- [Linux namespaces](04-linux-namespaces.md)
- [cgroups and resource limits](05-cgroups.md)
- [Build container-style isolation with Linux](06-build-a-container-with-linux.md)
- [OCI standards](07-oci-standards.md)
- [`runc`, `containerd`, and Docker architecture](08-runc-containerd-and-docker.md)

### Part III — Docker workflows

- [What Docker actually solves](09-what-docker-solves.md)
- [Installation and the Docker Engine](10-installation-and-engine.md)
- [Essential commands as practical lifecycle tools](11-essential-docker-commands.md)
- [Networking foundations](12-networking-fundamentals.md) and [Docker networking](13-docker-networking.md)
- [Caddy web-application lab](14-caddy-web-app-lab.md)
- [Storage](15-storage.md), [images](16-container-images.md), [Dockerfiles](17-dockerfiles.md), and [Compose](18-docker-compose.md)
- [Registries and publishing](19-registries-and-publishing.md)

### Part IV — Beyond Docker

- [Podman](20-podman.md)
- [Kubernetes container runtimes](21-kubernetes-runtimes.md)
- [macOS container architecture](22-macos-containers.md)
- [Monoliths and microservices](23-monoliths-and-microservices.md)
- [Production troubleshooting](24-production-troubleshooting.md)
- [Course wrap-up](25-course-wrap-up.md)

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
