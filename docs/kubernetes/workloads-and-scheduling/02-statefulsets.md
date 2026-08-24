---
title: "Kubernetes StatefulSets: Ordered, Stateful Workloads Explained"
icon: lucide/database
description: How StatefulSets provide ordered deployment, stable network identity, and per-pod persistent storage for databases, queues, and other stateful workloads.
tags:
  - Kubernetes
  - Workloads & Scheduling
---

# StatefulSets

## What You'll Learn

- Why a Deployment is the wrong controller for databases and other stateful apps
- How ordered deployment/scaling/termination and stable pod identity actually work
- How headless Services and `volumeClaimTemplates` give each pod its own durable identity and storage

## Why This Matters

A Deployment treats pods as interchangeable — kill any one, replace it with an identical pod, no one cares which. That's exactly wrong for a database replica that needs to keep *its own* data directory and *its own* network name across restarts. StatefulSets exist because "which pod is this" sometimes matters as much as "how many pods are running."

## Mental Model

> A StatefulSet gives each replica a **fixed identity** — a predictable name, a stable DNS entry, and its own PersistentVolumeClaim — that survives pod rescheduling. Pods are created, scaled, and deleted **in order**, one at a time, never in parallel by default.

| Deployment | StatefulSet |
|---|---|
| Pod names are random (`app-7d9f8-x2kq1`) | Pod names are ordinal and stable (`app-0`, `app-1`, `app-2`) |
| Any pod can be replaced by any other | Pod `N` is always recreated as `N`, with the same PVC |
| No ordering guarantee on scale up/down | Strictly ordered: `0` before `1` before `2`, reverse on scale-down |
| Shares one Service, no stable per-pod DNS | Needs a headless Service for stable per-pod DNS |
| Usually one shared or no PVC per pod | `volumeClaimTemplates` — a unique PVC per pod, reused across reschedules |

## How It Works

### The manifest

```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres
  labels:
    app: postgres
spec:
  clusterIP: None   # headless — no load-balancing, just DNS
  selector:
    app: postgres
  ports:
    - port: 5432
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres   # must match the headless Service above
  replicas: 3
  podManagementPolicy: OrderedReady   # default; use Parallel to relax ordering
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16.3
          ports:
            - containerPort: 5432
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: fast-ssd
        resources:
          requests:
            storage: 20Gi
```

### Ordered lifecycle

```mermaid
flowchart LR
    A[postgres-0 created, waits Ready] --> B[postgres-1 created, waits Ready]
    B --> C[postgres-2 created, waits Ready]
    C -.scale down.-> B2[postgres-2 terminated first]
    B2 -.scale down.-> A2[postgres-1 terminated next]
```

- **Scale up**: `postgres-0` must be `Running` and `Ready` before `postgres-1` is even created; `postgres-1` before `postgres-2`.
- **Scale down**: reverse order — highest ordinal terminates first.
- **Rolling update**: also proceeds in reverse ordinal order by default (highest first), one pod at a time.

### Stable network identity

The headless Service (`clusterIP: None`) gives each pod a predictable DNS name:

```text
postgres-0.postgres.default.svc.cluster.local
postgres-1.postgres.default.svc.cluster.local
postgres-2.postgres.default.svc.cluster.local
```

This is what lets replication configs, seed lists, and peer-discovery logic reference *a specific pod* by name instead of "whichever pod the Service happens to load-balance to this time."

### Stable storage

`volumeClaimTemplates` creates one PVC per pod (`data-postgres-0`, `data-postgres-1`, `data-postgres-2`). When `postgres-1` is deleted and recreated (crash, node drain, rolling update), the new `postgres-1` pod re-attaches to the **same** PVC — its data survives the pod's death. Deleting the StatefulSet does **not** delete these PVCs; that's deliberate, so scaling down and back up doesn't silently destroy data.

!!! note "Storage depth lives elsewhere"
    Access modes, reclaim policies, StorageClasses, and volume expansion for StatefulSet-backed storage are covered in [StatefulSet Storage Patterns](../storage/04-statefulset-storage-patterns.md).

### Common use cases

- Databases: PostgreSQL, MySQL, MongoDB replica sets, Cassandra
- Coordination/consensus: etcd, ZooKeeper, Consul
- Message queues/streaming: Kafka, RabbitMQ clusters

## Common Mistakes

- Forgetting the headless Service — without `clusterIP: None` and a matching `serviceName`, per-pod DNS never comes up and peer discovery breaks.
- Assuming deleting a StatefulSet cleans up its PVCs. It doesn't — that's a feature, but it means orphaned PVCs pile up (and keep billing you) if you don't clean them up deliberately.
- Using `podManagementPolicy: Parallel` for a workload whose clustering logic actually depends on ordered startup (e.g. an app that assumes pod 0 bootstraps the cluster).
- Reaching for a StatefulSet when a Deployment + a shared external database would do — StatefulSets are heavier to operate and only pay off when pod identity or per-pod storage is a real requirement.

## Interview Questions

- What breaks if you remove the headless Service from in front of a StatefulSet?
- What happens to PersistentVolumeClaims when you scale a StatefulSet down, then back up?
- Why does a StatefulSet create and delete pods in order, and when would you relax that with `Parallel`?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [DaemonSets](03-daemonsets.md) for the controller that runs one pod per node instead of a fixed replica count.
