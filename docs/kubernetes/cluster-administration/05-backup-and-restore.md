---
title: "Kubernetes Backup and Restore: etcd Snapshots and Velero"
icon: lucide/database-backup
description: How to back up and restore Kubernetes cluster state with etcdctl snapshot save/restore, and application-level backup and migration with Velero.
tags:
  - Kubernetes
  - Cluster Administration
---

# Backup and Restore

## What You'll Learn

- How to take and restore an etcd snapshot with `etcdctl snapshot save`/`restore`
- How Velero backs up and restores whole clusters or individual namespaces, including persistent volume data
- When to reach for etcd snapshots versus Velero, and how they fit into a broader disaster-recovery strategy

## Why This Matters

Recall from [etcd and Control Plane Internals](02-etcd-and-control-plane-internals.md) that etcd is the *only* copy of your cluster's state. If it's gone with no backup, the cluster's state is gone — full stop, regardless of whether the underlying containers happen to still be running somewhere. Backups aren't optional infrastructure hygiene here; they're the only thing standing between a bad `kubeadm upgrade` or a failed disk and a from-scratch rebuild.

## Mental Model

Think of these as two different layers of recovery:

- **etcd snapshots** back up the cluster's control-plane state — every object definition, in one bundle, restorable to get an identical cluster back.
- **Velero** backs up at the Kubernetes API level — it asks the API server for resources (optionally scoped to a namespace or label selector) and can also snapshot the underlying persistent volumes, making it suitable for partial restores, cross-cluster migration, and application-level recovery that etcd snapshots can't do.

### etcd snapshot save and restore

```bash
# Take a snapshot on a control-plane node
sudo ETCDCTL_API=3 etcdctl snapshot save /var/backups/etcd-snapshot-$(date +%Y%m%d-%H%M%S).db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# Verify it's a valid, complete snapshot before you trust it
sudo ETCDCTL_API=3 etcdctl snapshot status /var/backups/etcd-snapshot-20260824-020000.db -w table
```

Run this on a schedule (a systemd timer or cron job calling the script above) and, critically, ship the resulting file off the node it was taken on — a snapshot sitting on the same disk as the etcd it backs up doesn't survive a disk failure.

Restoring is not "load the file back into the running etcd" — it builds a **new** data directory from the snapshot, which then replaces the old one:

```bash
sudo ETCDCTL_API=3 etcdctl snapshot restore /var/backups/etcd-snapshot-20260824-020000.db \
  --data-dir /var/lib/etcd-restored \
  --initial-cluster "cp-1=https://10.0.0.10:2380" \
  --initial-advertise-peer-urls https://10.0.0.10:2380 \
  --name cp-1

# Stop etcd (kubeadm runs it as a static pod, so move the manifest out to stop it)
sudo mv /etc/kubernetes/manifests/etcd.yaml /tmp/

# Point etcd's static pod manifest at the restored data directory,
# swapping the volume hostPath from /var/lib/etcd to /var/lib/etcd-restored

sudo mv /tmp/etcd.yaml /etc/kubernetes/manifests/
# kubelet notices the manifest and starts the static pod against the restored data
```

For a multi-member etcd cluster, every member restores from the *same* snapshot with its own `--name` and `--initial-advertise-peer-urls`, so they form a fresh cluster with identical data rather than trying to sync from each other.

!!! warning "Restoring loses everything written after the snapshot"
    An etcd restore is a point-in-time rollback of the *entire* cluster — every Deployment, every Secret, every Pod scheduling decision reverts to the moment of the snapshot. Anything created or changed after that point is gone. This is a last-resort operation, not a routine one.

### Velero for whole-cluster and namespace-scoped backup

Velero backs up via the Kubernetes API rather than etcd directly, which is what lets it target a single namespace, use label selectors, and coordinate persistent volume snapshots through your cloud provider or CSI driver.

```bash
# Install Velero with an AWS S3 backup location and EBS snapshots (adjust for your cloud)
velero install \
  --provider aws \
  --plugins velero/velero-plugin-for-aws:v1.9.2 \
  --bucket my-velero-backups \
  --backup-location-config region=us-west-2 \
  --snapshot-location-config region=us-west-2 \
  --secret-file ./credentials-velero

# Back up an entire cluster
velero backup create full-cluster-2026-08-24 --wait

# Back up a single namespace, including PV data
velero backup create checkout-ns-backup \
  --include-namespaces checkout \
  --snapshot-volumes \
  --wait

# Restore that namespace — to the same cluster, or a different one entirely
velero restore create --from-backup checkout-ns-backup --wait

# Schedule recurring backups
velero schedule create daily-checkout-backup \
  --schedule="0 2 * * *" \
  --include-namespaces checkout
```

Restoring `--from-backup` on a *different* cluster (pointed at by whatever kubeconfig context is active) is exactly how Velero doubles as a cluster-migration tool — back up on the old cluster, restore on the new one, including the PV data if you enabled `--snapshot-volumes`.

## etcd Snapshots vs. Velero

| | etcd snapshot | Velero |
|---|---|---|
| Scope | Entire cluster, atomically | Cluster-wide, namespace-scoped, or label-selected |
| Includes PV data | No — only Kubernetes object metadata like the PVC/PV objects | Yes, via cloud snapshots or the File System Backup (restic/Kopia) fallback |
| Restore granularity | All-or-nothing | Per-namespace, per-resource-type, or per-label-selector |
| Good for | Disaster recovery of the control plane itself, pre-upgrade safety net | Application-level backup, namespace recovery, cross-cluster migration |
| Requires | Direct access to control-plane nodes and etcd certs | Just API access plus a configured backup storage location |

Most production setups run both: scheduled etcd snapshots as the control-plane safety net, and Velero for application-level and namespace-level recovery that doesn't require rebuilding the entire control plane to fix.

!!! note "This is cluster-level recovery, not your DR strategy"
    Backup and restore mechanics are only one piece of disaster recovery — RTO/RPO targets, multi-region failover, and runbook testing are the broader picture. See [Disaster Recovery](../production-engineering/04-disaster-recovery.md) for that strategy layer.

## Common Mistakes

- Storing etcd snapshots on the same disk or node as etcd itself, so a disk failure takes out the backup along with the data.
- Never actually testing a restore — a snapshot you've never restored from is a hope, not a backup.
- Assuming Velero backs up PV contents by default — it doesn't, unless `--snapshot-volumes` (or File System Backup) is explicitly configured.
- Restoring an etcd snapshot without understanding it rolls back the *entire* cluster state, then being surprised recent changes vanished.
- Forgetting that restoring a multi-member etcd cluster requires each member to restore from the same snapshot with distinct identity flags — not a rolling one-by-one restore.

## Interview Questions

- Walk through backing up and restoring etcd on a 3-node control plane.
- What can Velero do that an etcd snapshot can't, and vice versa?
- How would you use Velero to migrate a namespace from one cluster to another?
- Why is a restored etcd snapshot described as a "point-in-time rollback," and what are the consequences?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Multi-Tenancy](06-multi-tenancy.md) to see how a single cluster — backed up as one unit here — can still safely isolate multiple teams or customers.
