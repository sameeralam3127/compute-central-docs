---
title: "Kubernetes Storage: Volumes, PVs, PVCs, and StorageClasses"
icon: lucide/database
description: How Kubernetes storage actually works — from ephemeral pod volumes through PersistentVolumes and dynamic provisioning to StatefulSet storage patterns.
tags:
  - Kubernetes
  - Storage
---

# Storage

Pods are disposable, but data usually isn't. This section builds the storage mental model in layers: the ephemeral volumes attached directly to a pod spec, the PersistentVolume/PersistentVolumeClaim abstraction that survives a pod being rescheduled, the StorageClasses that provision that storage on demand, and the patterns StatefulSets use to give each replica its own durable disk.

## Kubernetes Storage at a Glance

| Object | What it is | How long the data lasts | Usually created by |
|---|---|---|---|
| Volume (`emptyDir`, `hostPath`, `configMap`, ...) | Storage declared inside a pod spec | `emptyDir` lives as long as the pod; `hostPath` stays on that one node | The app team, in the pod spec |
| PersistentVolume (PV) | A piece of real storage: a cloud disk, an NFS share, a local disk | Independent of any pod | An admin, or a StorageClass automatically |
| PersistentVolumeClaim (PVC) | A request for storage: size, access mode, and class | Until the claim is deleted; the PV's `reclaimPolicy` then decides whether the data is kept | The app team |
| StorageClass | A template that creates PVs on demand through a CSI driver | Cluster-wide configuration | The platform team |

The everyday pattern for persistent storage is a PVC plus a pod that mounts it. The StorageClass creates the disk behind the claim:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data
spec:
  accessModes: ["ReadWriteOnce"]
  storageClassName: standard      # list the classes in your cluster: kubectl get storageclass
  resources:
    requests:
      storage: 10Gi
---
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
    - name: app
      image: nginx:1.27
      volumeMounts:
        - name: data
          mountPath: /usr/share/nginx/html
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: data
```

## Read in this order

1. [Volumes](01-volumes.md) — ephemeral volume types (`emptyDir`, `hostPath`, `configMap`, `secret`, `projected`), and why none of them survive a pod being rescheduled to a different node
2. [PersistentVolumes and PersistentVolumeClaims](02-persistentvolumes-and-claims.md) — the PV/PVC lifecycle and binding, access modes, and reclaim policies
3. [StorageClasses and Dynamic Provisioning](03-storageclasses-and-dynamic-provisioning.md) — CSI drivers, the dynamic provisioning flow end to end, and volume expansion
4. [StatefulSet Storage Patterns](04-statefulset-storage-patterns.md) — `volumeClaimTemplates`, one PVC per replica, and what happens to that storage when pods and StatefulSets are deleted

!!! tip "If you only remember one thing"
    A Pod's `volumes:` block describes *how* storage is attached to that pod. It says nothing about *where the bytes actually live* or *whether they outlive the pod* — that's what PersistentVolumes, PersistentVolumeClaims, and StorageClasses are for.

## Next

Once you can reason about how a pod gets durable storage, continue to [Configuration and Packaging](../configuration-and-packaging/index.md) to see how the same workloads get their configuration and secrets injected.
