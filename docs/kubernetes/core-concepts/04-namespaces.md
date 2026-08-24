---
title: "Kubernetes Namespaces: Scope, Defaults, and When to Split"
icon: lucide/folder
description: What namespaces actually scope in Kubernetes, cluster-scoped vs. namespaced resources, the built-in default/kube-system/kube-public namespaces, and when to split by namespace vs. by cluster.
tags:
  - Kubernetes
  - Core Concepts
---

# Namespaces

## What You'll Learn

- What a namespace actually scopes, and the resource types it explicitly does not
- What lives in `default`, `kube-system`, and `kube-public` out of the box
- When splitting environments by namespace is the right call, and when it isn't

## Why This Matters

"Just put it in its own namespace" is common advice that's half-right. Namespaces give you a name-collision boundary and a unit for RBAC and ResourceQuota — they do not give you network isolation, node isolation, or a security boundary by themselves. Knowing exactly what a namespace does and doesn't scope prevents a false sense of isolation that shows up as an incident later.

## Mental Model

> A namespace is a way to divide a single cluster's resources into multiple virtual clusters — a name-collision and access-control boundary, not a hard security or network boundary.

Two Pods named `web` can coexist in the same physical cluster only if they're in different namespaces — `web.dev.svc.cluster.local` and `web.prod.svc.cluster.local` are distinct DNS names built from the namespace. But by default, a Pod in `dev` can still send traffic to a Pod in `prod` unless a [NetworkPolicy](../security/index.md) explicitly blocks it — namespaces alone don't stop that.

```bash
kubectl create namespace dev
kubectl get namespaces
kubectl get pods -n dev
kubectl config set-context --current --namespace=dev
```

## Namespaced vs. Cluster-Scoped Resources

Not everything lives inside a namespace. Some resource types are cluster-wide by design, because they describe the cluster itself rather than an application running on it.

| Namespaced (lives inside one namespace) | Cluster-scoped (exists once, cluster-wide) |
|---|---|
| Pod, Deployment, ReplicaSet, StatefulSet | Node |
| Service, Ingress, NetworkPolicy | Namespace itself |
| ConfigMap, Secret | PersistentVolume (the PVC that claims it is namespaced) |
| Job, CronJob | ClusterRole, ClusterRoleBinding |
| Role, RoleBinding | StorageClass |
| ServiceAccount | CustomResourceDefinition |

```bash
# List every resource type and whether it's namespaced
kubectl api-resources --namespaced=true
kubectl api-resources --namespaced=false
```

This split matters concretely: a `Role` only grants permissions within its namespace, but a `ClusterRole` can be bound cluster-wide via a `ClusterRoleBinding` — a common source of "why can this ServiceAccount see pods in every namespace" surprises.

## Built-In Namespaces

| Namespace | Purpose |
|---|---|
| **default** | Where objects land if you don't specify a namespace — fine for learning, risky as a real convention since everything collides here |
| **kube-system** | Control-plane and cluster-add-on components — CoreDNS, kube-proxy, and similar. Don't deploy application workloads here |
| **kube-public** | Readable by all users, including unauthenticated ones, by convention — used for cluster info that's meant to be public, rarely used directly by application teams |
| **kube-node-lease** | Holds Lease objects nodes use for fast heartbeat/health-check signaling to the control plane |

## When to Split by Namespace vs. by Cluster

| Split by namespace when | Split by cluster when |
|---|---|
| Environments share the same Kubernetes version and blast-radius tolerance (e.g., multiple feature teams' dev workloads) | You need a hard security or compliance boundary (e.g., prod vs. dev, or different customers' data) |
| You want lightweight quota and RBAC separation without the operational overhead of another control plane | A misconfiguration or compromise in one environment must be structurally unable to affect another |
| Teams are trusted to not need network-level isolation, or you're pairing namespaces with strict NetworkPolicies | You need independent upgrade cadences, node pools, or cloud accounts per environment |

A common real-world pattern: one cluster per environment tier that actually needs isolation (e.g., separate prod and non-prod clusters), and namespaces *within* each cluster for team or service separation.

## Common Mistakes

- Treating namespace separation as a security boundary on its own — without NetworkPolicies and RBAC configured deliberately, Pods across namespaces can still reach each other.
- Deploying application workloads into `kube-system` or `default` out of convenience, making cleanup and quota management harder later.
- Forgetting `-n <namespace>` (or a namespace-scoped context) and being confused why `kubectl get pods` shows nothing — it's silently scoped to `default` or whatever the current context sets.
- Assuming a `ClusterRole` bound via `RoleBinding` (not `ClusterRoleBinding`) grants cluster-wide access — it doesn't; a `RoleBinding` scopes even a ClusterRole's permissions to its own namespace.

## Interview Questions

- What does a namespace actually isolate, and what does it explicitly not isolate?
- Name three cluster-scoped resource types and explain why they can't be namespaced.
- When would you choose separate namespaces over separate clusters for two environments?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Labels, Selectors, and Annotations](05-labels-selectors-and-annotations.md) to see the mechanism Services, Deployments, and NetworkPolicies all use to find the right objects within (or across) namespaces.
