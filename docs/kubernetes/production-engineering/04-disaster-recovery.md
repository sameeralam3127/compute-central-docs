---
title: "Kubernetes Disaster Recovery: RTO, RPO, Backups, and Failover"
icon: lucide/shield-alert
description: Kubernetes disaster recovery in practice — RTO/RPO targets, Velero and etcd snapshot backup strategy, multi-region failover, and what a real DR runbook needs.
tags:
  - Kubernetes
  - Production Engineering
---

# Disaster Recovery

## What You'll Learn

- How to apply RTO and RPO targets specifically to a Kubernetes cluster, not just "the business" in the abstract
- A concrete backup strategy combining Velero and etcd snapshots, and what each one does and doesn't cover
- What a real DR runbook needs to contain to be useful during an actual incident, not just an audit

## Why This Matters

Most teams have *a* backup running. Far fewer have tested a *restore*, and fewer still have a runbook that tells a half-asleep on-call engineer exactly what to type at 3 a.m. Disaster recovery that isn't tested is a belief, not a capability — and Kubernetes adds a wrinkle most teams miss: backing up etcd captures cluster *state*, but not necessarily the *data* inside your PersistentVolumes, which needs its own backup path entirely.

## Mental Model

> RTO (Recovery Time Objective) is how long you're down. RPO (Recovery Point Objective) is how much data you lose. Every DR decision in Kubernetes is really a trade between these two: snapshotting more often lowers RPO but costs more storage and I/O; a warm standby cluster lowers RTO but costs double the infrastructure. Pick numbers for both *before* the incident, not during it.

| Scenario | What failed | What restores it | Typical RTO/RPO shape |
|---|---|---|---|
| Bad deploy / config error | Application state only | Rollback via GitOps revert | Minutes / near-zero |
| Namespace or resource accidentally deleted | Cluster objects | Velero resource restore | Minutes to an hour / since last backup |
| etcd corruption | Entire cluster control plane | etcd snapshot restore | Tens of minutes / since last snapshot |
| Full region/cluster loss | Everything | Failover to standby cluster in another region | Depends on failover model chosen below |

## How It Works

### Backup strategy: Velero + etcd snapshots are complementary, not redundant

- **etcd snapshots** back up the cluster's control-plane state — every object definition, every Secret, every CRD instance — but not the contents of a PersistentVolume, and not container images.
- **Velero** backs up Kubernetes API objects (optionally including PV data via CSI snapshots or a compatible plugin) at the namespace or cluster level, and can restore them into the *same* cluster or a *different* one — which etcd restore cannot do.

Take an etcd snapshot on a schedule appropriate to your RPO (hourly for most production clusters is a reasonable starting point):

```bash
ETCDCTL_API=3 etcdctl snapshot save /backup/etcd-snapshot-$(date +%Y%m%d%H%M).db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

ETCDCTL_API=3 etcdctl snapshot status /backup/etcd-snapshot-*.db --write-out=table
```

Run Velero backups for namespace-level and PV-level recovery, which is the far more common real-world restore ("bring back the `payments` namespace as it was an hour ago") compared to a full etcd disaster:

```bash
velero backup create payments-hourly \
  --include-namespaces payments \
  --snapshot-volumes \
  --ttl 168h0m0s

velero schedule create payments-hourly-schedule \
  --schedule="0 * * * *" \
  --include-namespaces payments \
  --snapshot-volumes
```

Restoring a namespace from a Velero backup — practice this before you need it:

```bash
velero restore create --from-backup payments-hourly
velero restore describe <restore-name>
```

Managed clusters (EKS, GKE, AKS) generally don't expose etcd directly — their control plane, including etcd, is the provider's responsibility to back up and restore. On managed clusters, Velero (for namespace/object/PV recovery) is almost always your primary and only DR tool; cross-link to [Backup and Restore](../cluster-administration/05-backup-and-restore.md) for the full operational walkthrough of both tools.

### Multi-region failover patterns

| Pattern | RTO | RPO | Cost | Complexity |
|---|---|---|---|---|
| Backup/restore into a cold standby cluster | Hours | Since last backup | Lowest | Lowest |
| Warm standby (cluster running, scaled down, synced via GitOps) | Minutes | Near-zero for config, depends on data replication | Moderate | Moderate |
| Active-active (both regions serving live traffic) | Seconds (traffic just shifts) | Near-zero, requires active data replication | Highest | Highest |

Application state (databases, message queues) almost always drives the real RPO ceiling — Kubernetes-level backups can't out-run an application data layer that only replicates every 15 minutes. Align your Kubernetes DR tier with your data layer's actual replication guarantees, not the other way around.

### What a real DR runbook needs to contain

A runbook that only exists as institutional knowledge is not a DR plan. A usable one is written down and contains, at minimum:

- **Trigger conditions** — the specific, observable signal that means "declare a disaster" (not a vague feeling that something's wrong).
- **Exact commands**, not descriptions — `etcdctl snapshot restore ...` with real flags, not "restore etcd from the snapshot."
- **Who has authority to declare** a DR event and who executes each step, so nobody is blocked waiting for a decision mid-incident.
- **Dependency order** — restore etcd/cluster state before applications; restore stateful data stores before the applications that depend on them.
- **Validation steps** after restore — what "it worked" looks like concretely (`kubectl get nodes` all Ready, key Deployments' rollout status, a synthetic transaction succeeding), not just "the restore command exited 0."
- **Rollback instructions** if the restore itself goes wrong.
- **A tested last-run date.** A runbook nobody has executed in 12 months is a hypothesis.

## Common Mistakes

- Backing up etcd and believing that also protects PersistentVolume data — it doesn't.
- Never actually running a restore, so the first real test happens during an actual outage.
- Setting an aggressive Kubernetes-level RPO while the application's database only replicates hourly — the weakest link sets the real number.
- A runbook that lives only in one engineer's head, or as a wiki page describing steps in prose instead of exact commands.
- Assuming a managed Kubernetes service's control-plane durability means you don't need Velero — it protects the control plane, not your namespaces, PVs, or accidental `kubectl delete` incidents.

## Interview Questions

- What's the difference between what an etcd snapshot backs up and what Velero backs up?
- How would you set RTO/RPO targets for a stateful application running on Kubernetes, and what usually ends up being the limiting factor?
- What does a DR runbook need to contain to actually be useful during an incident?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Production Readiness Checklist](05-production-readiness-checklist.md) to see where backups, probes, and the rest of production hygiene come together as a single gate.
