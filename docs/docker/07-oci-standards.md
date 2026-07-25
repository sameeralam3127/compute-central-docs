---
description: Learn the OCI Image, Runtime, and Distribution Specifications and why standards let container images and runtimes interoperate.
---

# 7. OCI: Container Standards

The Open Container Initiative (OCI) defines open specifications so an image created by one compatible tool can be used by another compatible runtime or registry.

| Specification | Defines |
| --- | --- |
| Image Specification | image manifests, configuration, layers, and layout |
| Runtime Specification | runtime bundle and how a runtime starts the process |
| Distribution Specification | registry API behavior for pushing and pulling content |

```text
Application → OCI image → registry → image layers + config
            → runtime bundle → OCI runtime → isolated process
```

An **OCI image** is a portable artifact: metadata plus content-addressed filesystem layers. A **runtime bundle** is a prepared root filesystem and configuration handed to an OCI runtime. The image is not running; the runtime creates a container process from it.

Interoperability does not mean every feature is identical. A tool's build cache, GUI, networking implementation, policy controls, and extensions may differ. It does mean OCI-compatible images can move across compatible ecosystems instead of being tied to one vendor's image format.
