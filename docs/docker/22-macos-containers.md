---
description: Understand Linux containers on macOS, Docker Desktop virtualization, and Apple's current container tooling.
---

# macOS and Apple Container Technology

Linux containers need Linux kernel primitives. On macOS, Docker Desktop therefore uses a Linux VM to run Linux containers; the Docker client integrates with that VM rather than turning the macOS kernel into a Linux container kernel.

Apple’s open-source [`container`](https://github.com/apple/container) tool creates and runs Linux containers as lightweight virtual machines on Apple silicon and consumes/produces OCI-compatible images. Its Containerization package uses Virtualization.framework and places each Linux container in a lightweight VM. Apple documents macOS 26 and Apple silicon requirements, and the project has been actively evolving; confirm the current release documentation before adopting it for production. This is architecturally different from native Linux containers, which share the Linux host kernel. [Apple container source and status](https://github.com/apple/container) and [Apple Virtualization documentation](https://developer.apple.com/documentation/virtualization/creating-and-running-a-linux-virtual-machine) provide the current primary references.
