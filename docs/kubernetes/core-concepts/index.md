---
title: "Kubernetes Core Concepts: Pods, Deployments, Services"
icon: lucide/box
description: The vocabulary and daily-driver objects behind every Kubernetes manifest — Pods, ReplicaSets and Deployments, Services, namespaces, labels, ConfigMaps/Secrets, volumes, and Jobs.
tags:
  - Kubernetes
  - Core Concepts
---

# Core Concepts

The objects you'll write YAML for every day. If [Getting Started](../getting-started/index.md) got you a running Deployment and a working `kubectl`, this section is where those objects stop being magic and start being things you can reason about and combine deliberately.

## Read in this order

1. [Pods](01-pods.md) — the smallest deployable unit, multi-container patterns, init containers, and lifecycle phases
2. [ReplicaSets and Deployments](02-replicasets-and-deployments.md) — the reconciliation primitive underneath every Deployment, and basic rolling updates
3. [Services](03-services.md) — stable network identity, and the four Service types at an intro level
4. [Namespaces](04-namespaces.md) — what's scoped by namespace, what isn't, and when to split by namespace vs. by cluster
5. [Labels, Selectors, and Annotations](05-labels-selectors-and-annotations.md) — the mechanism every Service, Deployment, and NetworkPolicy keys off of
6. [ConfigMaps and Secrets](06-configmaps-and-secrets.md) — the basics of injecting configuration and sensitive values into a Pod
7. [Volumes and Storage Basics](07-volumes-and-storage-basics.md) — why Pods are ephemeral, and the two simplest volume types
8. [Jobs and CronJobs](08-jobs-and-cronjobs.md) — run-to-completion and scheduled workloads, as opposed to long-running services

!!! tip "Depth lives elsewhere on purpose"
    This section deliberately stays at the "solid working knowledge" level. Deployment strategy tuning, kube-proxy internals, ConfigMap/Secret depth, and full storage architecture each get their own dedicated section later — every page here links forward to the right one.

## Next

Once these are solid, continue to [Workloads and Scheduling](../workloads-and-scheduling/index.md) for deployment strategies, DaemonSets, StatefulSets, autoscaling, and scheduling controls.
