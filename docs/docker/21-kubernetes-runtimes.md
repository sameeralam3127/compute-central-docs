---
description: Learn CRI, containerd, CRI-O, runc, dockershim history, and why Kubernetes can run Docker-built OCI images without Docker Engine.
---

# 21. Kubernetes Container Runtimes

Kubernetes schedules Pods and talks to a compatible runtime through the Container Runtime Interface (CRI). Common runtimes include containerd and CRI-O; they ultimately use an OCI runtime such as `runc` to start Linux container processes.

Kubernetes removing dockershim did not mean it stopped running Docker-built images. Docker builds OCI-compatible images, and compatible CRI runtimes can pull and run them. The misconception comes from confusing Docker Engine's API with the OCI image format.
