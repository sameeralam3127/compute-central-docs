---
title: "Kubernetes Workloads and Scheduling Guide"
icon: lucide/layers
description: How Deployments, StatefulSets, and DaemonSets roll out changes, how the scheduler places pods, and how requests, limits, and autoscaling keep a cluster healthy.
tags:
  - Kubernetes
  - Workloads & Scheduling
---

# Workloads and Scheduling

How to run application code on a cluster and keep it running: choosing the right workload controller, telling the scheduler where pods are and aren't allowed to go, and sizing/scaling pods so the cluster doesn't starve or waste capacity.

If you already know what a Deployment is and just need Service or Ingress details, skip ahead to [Networking](../networking/index.md).

## Read in this order

1. [Deployment Strategies](01-deployment-strategies.md) — RollingUpdate vs. Recreate, tuning `maxSurge`/`maxUnavailable`, and rollout/rollback with `kubectl`
2. [StatefulSets](02-statefulsets.md) — ordered deployment, stable network identity, and per-pod persistent storage for stateful workloads
3. [DaemonSets](03-daemonsets.md) — running exactly one pod per (matching) node for agents like log collectors and CNI plugins
4. [Scheduling, Affinity, and Taints](04-scheduling-affinity-and-taints.md) — how the scheduler actually picks a node, and how to steer or restrict that choice
5. [Resource Requests, Limits, and QoS](05-resource-requests-limits-and-qos.md) — how requests and limits drive scheduling, throttling, and eviction order
6. [Autoscaling](06-autoscaling.md) — HPA, VPA, and Cluster Autoscaler/Karpenter, and how they interact (and conflict)

!!! tip "Deployments cover most workloads"
    Most application workloads are stateless and belong in a Deployment. Reach for a StatefulSet or DaemonSet only when the workload genuinely needs stable identity/storage or one-per-node placement — both add operational complexity a plain Deployment doesn't have.

## Next

Once your workloads are scheduled and scaling correctly, continue to [Networking](../networking/index.md) to get traffic to and between them.
