---
title: "Kubernetes Security: RBAC, Pod Security, and Supply Chain"
icon: lucide/shield
description: Start here for Kubernetes security — authentication and authorization, RBAC, service accounts, Pod Security Admission, image supply chain, and secrets encryption.
tags:
  - Kubernetes
  - Security
---

# Security

Kubernetes ships with no security posture by default — anyone who can reach the API server can do nothing until you configure who they are, what they're allowed to do, and what their workloads are allowed to run as. This section builds that posture layer by layer: identity first, then authorization, then the pod-level and supply-chain controls that keep a compromised container from becoming a compromised cluster.

## Read in this order

1. [Authentication and Authorization](01-authentication-and-authorization.md) — how the API server decides *who you are* and *what you can do*, and where admission control fits after that decision
2. [RBAC](02-rbac.md) — Roles, ClusterRoles, and the bindings that connect them to real users and workloads
3. [Service Accounts](03-service-accounts.md) — the identity every pod gets by default, and how to make that identity least-privilege
4. [Pod Security Standards](04-pod-security-standards.md) — the built-in admission controller that replaced PodSecurityPolicy, and the `securityContext` fields it enforces
5. [Image and Supply Chain Security](05-image-and-supply-chain-security.md) — scanning, signing, and admission-time policy for what actually runs in your cluster
6. [Secrets and Encryption at Rest](06-secrets-and-encryption-at-rest.md) — why a Kubernetes Secret is not automatically an encrypted secret, and how to make it one

!!! tip "Security is a pipeline, not a checklist"
    Every request that reaches your cluster passes through the same three gates in order: authentication, authorization, admission control. Almost every security decision in this section slots into one of those three stages — keeping that pipeline in mind makes the rest of this section much easier to place.

## Next

Once identity, RBAC, and pod-level hardening are in place, continue to [Observability](../observability/index.md) to make sure you can actually see what's happening inside the cluster you just locked down.
