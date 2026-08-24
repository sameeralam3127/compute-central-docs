---
title: "Kubernetes Case Studies: Real-World Worked Examples"
icon: lucide/folder-tree
description: End-to-end Kubernetes case studies — scenario, requirements, full YAML solution, verification, and what could go wrong for each.
tags:
  - Kubernetes
  - Case Studies
---

# Case Studies

Every earlier section teaches one concept at a time. These case studies put several together the way a real production task actually requires — a realistic scenario, real manifests, real `kubectl` commands, and a failure path with its fix, not just the happy path.

## Full Case Studies

1. [Rolling Deployment with Zero Downtime](01-rolling-deployment-with-zero-downtime.md) — tuned readiness probes and `maxSurge`/`maxUnavailable`, verified with a live request-loss counter
2. [Blue-Green and Canary Releases](02-blue-green-and-canary-releases.md) — a Service-selector cutover and a weighted-Ingress canary, both with a rollback path
3. [Multi-Tenant Namespace Setup](03-multi-tenant-namespace-setup.md) — onboarding a new team with `ResourceQuota`, `LimitRange`, RBAC, and default-deny `NetworkPolicy`
4. [Autoscaling Under Load](04-autoscaling-under-load.md) — HPA on CPU and a custom metric during a real traffic spike, tuned to stop flapping
5. [Secrets Rotation](05-secrets-rotation.md) — rotating a database credential with no pod ever holding the stale value and no downtime
6. [Debugging a CrashLoopBackOff Incident](06-debugging-a-crashloopbackoff-incident.md) — a bad deploy, a real incident narrative, and the `describe`/`logs --previous`/`events` trail that finds the root cause

## Next

Continue to [Troubleshooting](../troubleshooting/index.md).
