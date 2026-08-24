---
title: "Kubernetes Configuration and Packaging: ConfigMaps, Secrets, Helm, Kustomize"
icon: lucide/settings
description: How Kubernetes workloads get configured and packaged — ConfigMaps, Secrets, injection patterns, Helm charts, Kustomize overlays, and external secret stores.
tags:
  - Kubernetes
  - Configuration & Packaging
---

# Configuration and Packaging

An application's code shouldn't change between environments — its configuration should. This section covers how Kubernetes separates config from code (ConfigMaps and Secrets), how that config actually reaches a running container, and the two dominant ways teams package and template manifests for multiple environments: Helm and Kustomize. It closes with why native Secrets aren't a full secrets-management story on their own.

## Read in this order

1. [ConfigMaps in Depth](01-configmaps-in-depth.md) — every consumption pattern, immutable ConfigMaps, and why volume-mounted updates propagate but env vars don't
2. [Secrets in Depth](02-secrets-in-depth.md) — Secret types, consumption patterns, the "base64 isn't encryption" caveat, and RBAC scoping
3. [Injecting Config: Env and Volumes](03-injecting-config-env-and-volumes.md) — combining ConfigMaps, Secrets, env vars, and projected volumes into a real 12-factor app
4. [Helm Fundamentals and Writing Charts](04-helm-fundamentals-and-writing-charts.md) — installing Helm, chart anatomy, and writing a minimal chart from scratch
5. [Kustomize](05-kustomize.md) — base/overlay layouts, patches, and when to reach for Kustomize instead of (or alongside) Helm
6. [External Secrets and Secret Stores](06-external-secrets-and-secret-stores.md) — External Secrets Operator, Vault, Sealed Secrets, and cloud-native secret managers

!!! tip "Helm vs. Kustomize isn't either/or"
    A large number of production setups use both: a third-party Helm chart for something like an ingress controller, rendered once, then layered with Kustomize overlays per environment. Read [Kustomize](05-kustomize.md) after Helm to see exactly where that boundary sits.

## Next

Once workloads have durable storage and correctly injected configuration, continue to [Security](../security/index.md) to lock down who and what can access all of it.
