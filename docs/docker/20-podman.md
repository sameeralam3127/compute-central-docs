---
description: Compare Docker and Podman: daemon architecture, rootless containers, OCI compatibility, pods, and operational trade-offs.
---

# 20. Podman

Podman is an OCI-compatible container tool with a familiar CLI. It is commonly described as daemonless: commands manage containers without a central long-running daemon equivalent to Docker Engine. Rootless workflows can reduce host privilege requirements, though they introduce networking, UID-mapping, and volume-permission considerations.

Docker and Podman can both build and run OCI-compatible images. Podman also has a pod concept for grouped containers. Choose based on platform support, existing tooling, security model, operations, and team familiarity—not marketing slogans.
