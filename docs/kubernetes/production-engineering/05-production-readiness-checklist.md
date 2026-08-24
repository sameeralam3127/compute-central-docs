---
title: "Kubernetes Production Readiness Checklist"
icon: lucide/clipboard-check
description: A concrete production readiness checklist for Kubernetes workloads — probes, resource limits, PodDisruptionBudgets, RBAC, NetworkPolicies, monitoring, backups, and upgrade planning.
tags:
  - Kubernetes
  - Production Engineering
---

# Production Readiness Checklist

## What You'll Learn

- The concrete, checkable items a workload should satisfy before it takes real production traffic
- Why "backups are scheduled" and "backups are tested" are different claims, and only one of them is actually true readiness
- Where in these docs each checklist item is actually taught, so a gap becomes a reading assignment, not a guess

## Why This Matters

"Is this ready for production?" is a question teams answer with a feeling far too often. A checklist turns it into something you can actually verify with a command, forces the same bar on every service regardless of who wrote it, and gives whoever is reviewing a launch something more useful than "looks fine to me."

## Mental Model

> Treat this as a gate, not a suggestion list. Every unchecked item is a specific, predictable way the workload will fail in production — a missed probe means a bad pod stays in rotation, a missing PDB means a routine node drain becomes an outage, an untested backup means "we have backups" is a belief, not a fact.

## The Checklist

### Workload configuration

- [ ] **Liveness and readiness probes are configured**, and readiness fails independently of liveness when a dependency (database, cache) is unavailable. Taught in [Workloads and Scheduling](../workloads-and-scheduling/index.md).
- [ ] **Resource requests and limits are set** on every container, derived from measured usage, not guesses. Memory limits are set close to actual peak usage (memory is not compressible — an unbounded container can OOM the node). Taught in [Cost Optimization](02-cost-optimization.md) and [Cluster Sizing and Capacity Planning](01-cluster-sizing-and-capacity-planning.md).
- [ ] **A PodDisruptionBudget exists** for every multi-replica Deployment/StatefulSet, so a node drain or cluster upgrade can't take out every replica at once. Taught in [Workloads and Scheduling](../workloads-and-scheduling/index.md).
- [ ] **At least 2 replicas**, spread across nodes/zones with `topologySpreadConstraints` or anti-affinity, for anything that isn't explicitly single-instance-by-design.

```bash
# Spot-check: does this Deployment have a matching PDB?
kubectl get deployment payments-api -n payments
kubectl get pdb -n payments -l app=payments-api
```

### Access and network security

- [ ] **RBAC follows least privilege** — no workload or human identity holds `cluster-admin` or wildcard verbs/resources it doesn't need. Taught in [Security](../security/index.md).
- [ ] **NetworkPolicies are applied**, with a default-deny baseline per namespace and explicit allow rules for required traffic only. Taught in [Networking](../networking/index.md) and [Security](../security/index.md).
- [ ] **Secrets are not stored as plain manifests in Git** — sourced from a secrets manager, sealed, or otherwise encrypted at rest and in the repo. Taught in [Configuration and Packaging](../configuration-and-packaging/index.md).

```bash
kubectl auth can-i --list --as=system:serviceaccount:payments:payments-api -n payments
kubectl get networkpolicy -n payments
```

### Observability

- [ ] **Metrics, logs, and traces are wired up** for the workload — not just "the cluster has Prometheus," but this specific service emits metrics that are actually scraped and dashboarded. Taught in [Observability](../observability/index.md).
- [ ] **Alerting exists for the failure modes that matter** (error rate, latency, restart count, PVC nearing full) and routes to someone who can act on it, not just a channel nobody watches. Taught in [Observability](../observability/index.md).

### Resilience and continuity

- [ ] **Backups are scheduled — and separately, tested.** A schedule proves nothing about restorability; a completed test restore into a scratch namespace or cluster does. Taught in [Disaster Recovery](04-disaster-recovery.md) and [Backup and Restore](../cluster-administration/05-backup-and-restore.md).
- [ ] **RTO/RPO targets are written down** for this workload specifically, not inherited vaguely from "the platform team's DR plan." Taught in [Disaster Recovery](04-disaster-recovery.md).
- [ ] **A documented upgrade plan exists** — for the workload's own rollout strategy (`maxSurge`/`maxUnavailable`, canary or blue-green if warranted) and for how it behaves during a cluster/Kubernetes version upgrade. Taught in [Cluster Administration](../cluster-administration/index.md).

```bash
kubectl get pdb -n payments
kubectl rollout status deployment/payments-api -n payments
# Confirm a real restore has been executed and dated, not just scheduled
velero backup describe payments-hourly --details
```

## How It Works

Run this as a gate at two points: before a new workload's first production deploy, and periodically (quarterly is reasonable) for existing services, since requests drift, RBAC accumulates permissions nobody removes, and NetworkPolicies get "temporarily" loosened and never tightened back. A workload that passes every item above has addressed the failure modes that account for the overwhelming majority of real Kubernetes production incidents — not eliminated risk, but converted it from "unknown" to "understood and accepted."

## Common Mistakes

- Treating "backup job runs successfully" as equivalent to "we can recover from this backup" — they are not the same claim.
- Adding probes and PDBs to a workload but never re-checking them after a refactor changes startup time or replica count.
- RBAC and NetworkPolicy reviewed once at launch and never again, while both quietly accumulate scope over the workload's life.
- Treating this checklist as a one-time launch gate instead of a recurring review — production readiness decays without maintenance.

## Interview Questions

- Walk through what you'd check before approving a new service for production traffic on Kubernetes.
- Why is a scheduled backup not sufficient evidence of disaster-recovery readiness?
- What's the actual failure mode of deploying a multi-replica Deployment with no PodDisruptionBudget during a node drain?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

This is the last page in Production Engineering. Continue to [OpenShift](../openshift/index.md) to see how a major enterprise Kubernetes distribution builds several of these same guarantees into the platform itself.
