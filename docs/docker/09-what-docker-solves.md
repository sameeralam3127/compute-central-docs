---
description: Map Docker workflows to the Linux container concepts they automate.
---

# What Docker Actually Solves

Docker makes building images, distributing content, creating isolated processes, networking, storage, logging, and lifecycle management convenient.

| Docker action | Underlying idea |
| --- | --- |
| `docker run` | image + filesystem + process + isolation + network/resource settings |
| `docker ps` | managed process lifecycle visibility |
| `docker exec` | additional process in existing namespaces |
| `docker logs` | captured stdout/stderr |
| `docker build` | repeatable image construction |

Docker does not make state disappear, secure secrets automatically, or design an application's network architecture. It makes the underlying Linux mechanisms practical to use consistently.
