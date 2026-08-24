---
title: "Kubernetes Cluster Administration Guide"
icon: lucide/server
description: How to build, operate, upgrade, back up, and multi-tenant a Kubernetes cluster — kubeadm, etcd, node lifecycle, and version skew.
tags:
  - Kubernetes
  - Cluster Administration
---

# Cluster Administration

Running workloads on a cluster someone else built is one skill. Being the person who built, upgrades, and keeps that cluster alive is another. This section covers the control-plane and node-lifecycle work: standing up a cluster with `kubeadm`, understanding what etcd actually does for you, safely draining and rejoining nodes, upgrading a live cluster without an outage, backing up and restoring cluster state, and isolating tenants inside a shared cluster.

If you're deploying applications *onto* an already-running cluster, [Workloads and Scheduling](../workloads-and-scheduling/index.md) and [Configuration and Packaging](../configuration-and-packaging/index.md) are more directly useful. This section is for the people responsible for the cluster itself.

## Read in this order

1. [kubeadm Cluster Setup](01-kubeadm-cluster-setup.md) — `kubeadm init`/`join`, control-plane prerequisites, and why nodes stay `NotReady` until you install a CNI
2. [etcd and Control Plane Internals](02-etcd-and-control-plane-internals.md) — why etcd is the cluster's single source of truth, and why only the API server ever talks to it
3. [Node Management](03-node-management.md) — `cordon`/`drain`/`uncordon`, adding and removing nodes, and the node conditions that drive eviction
4. [Cluster Upgrades](04-cluster-upgrades.md) — the version skew policy, the kubeadm upgrade order, and how managed platforms change the picture
5. [Backup and Restore](05-backup-and-restore.md) — etcd snapshots and Velero, for both disaster recovery and cluster migration
6. [Multi-Tenancy](06-multi-tenancy.md) — namespace isolation with quotas, `NetworkPolicy`, and RBAC, versus separate clusters or virtual clusters

!!! tip "Managed clusters still need this"
    Even on EKS, GKE, or AKS, where the control plane is someone else's problem, the node-management, upgrade-coordination, backup, and multi-tenancy chapters here still apply directly to your worker nodes and workloads.

## Next

Once the cluster itself is stable, continue to [CI/CD and GitOps](../cicd-and-gitops/index.md) to automate what gets deployed onto it.
