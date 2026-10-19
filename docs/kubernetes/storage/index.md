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

## What Most Engineers Miss

- **Deleting a namespace can delete its disks.** Dynamically provisioned PVs take the StorageClass's `reclaimPolicy`, which defaults to `Delete`. Delete the PVC, or the namespace it lives in, and the cloud disk goes with it. For data you can't lose, use a class with `reclaimPolicy: Retain`, or switch an existing volume:

    ```bash
    kubectl patch pv <pv-name> -p '{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}'
    ```

- **`ReadWriteOnce` means one node, not one Pod.** Two Pods on the same node can mount the same RWO volume at once. `ReadWriteOncePod`, stable since v1.29, is the access mode that guarantees a single Pod.
- **`Immediate` binding can pick the wrong zone.** With `volumeBindingMode: Immediate`, the disk is created as soon as the PVC exists, possibly in a zone where the Pod can't be scheduled. `WaitForFirstConsumer` waits until the scheduler has chosen a node.
- **StatefulSet volumes outlive their Pods.** Scaling a StatefulSet down, or deleting it, leaves its PVCs (and their bills) behind. `persistentVolumeClaimRetentionPolicy`, stable since v1.32, can delete them on scale-down or deletion when that's what you want.
- **`fsGroup` can make a mount take minutes.** With `fsGroup` set, the kubelet changes ownership of every file in the volume at each mount, and on a volume with millions of files the Pod sits in `ContainerCreating`. `fsGroupChangePolicy: OnRootMismatch` skips the walk when the top directory already matches.
- **Volumes only grow.** A PVC can be expanded when its StorageClass has `allowVolumeExpansion: true`, but never shrunk. Shrinking means a new volume and a data copy.

## Check Yourself

!!! quiz "Cleaning up a namespace"
    A team deletes namespace `shop`. Its database used a PVC from the default StorageClass, which has no `reclaimPolicy` set. What happens to the disk?

    - [ ] It's kept, because PersistentVolumes are cluster-scoped
    - [x] It's deleted: dynamically provisioned volumes default to `reclaimPolicy: Delete`
    - [ ] It's detached and kept for 30 days

    The PVC goes with the namespace, and the `Delete` policy removes the PV and the disk behind it. Use `Retain` for anything you can't recreate.

!!! quiz "Two Pods, one RWO volume"
    Two Pods on the **same** node mount the same `ReadWriteOnce` PVC. What happens?

    - [ ] The second Pod stays `Pending`
    - [x] Both mount it: RWO limits the volume to one node, not one Pod
    - [ ] The volume is mounted read-only in the second Pod

    For a true single-writer guarantee, use `ReadWriteOncePod`.

!!! quiz "Scaling a StatefulSet down"
    A StatefulSet with `volumeClaimTemplates` scales from 3 replicas to 1. What happens to the PVCs of the removed Pods?

    - [ ] They're deleted with their Pods
    - [x] They stay, and are reused if the StatefulSet scales back up
    - [ ] They're kept only for 24 hours

    Unless `persistentVolumeClaimRetentionPolicy` says otherwise, StatefulSet PVCs are retained so that a replica gets its own data back when it returns.

## Next

Once you can reason about how a pod gets durable storage, continue to [Configuration and Packaging](../configuration-and-packaging/index.md) to see how the same workloads get their configuration and secrets injected.
