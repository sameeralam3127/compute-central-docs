---
title: "Kubernetes Node Management: Cordon, Drain, and Node Conditions"
icon: lucide/wrench
description: How to safely take a Kubernetes node in and out of service with cordon, drain, and uncordon, and how node conditions drive scheduling and eviction.
tags:
  - Kubernetes
  - Cluster Administration
---

# Node Management

## What You'll Learn

- The safe sequence for taking a node out of service for maintenance without dropping traffic
- How to add and remove nodes from a running cluster
- What each node condition (`Ready`, `MemoryPressure`, `DiskPressure`, `PIDPressure`) actually means, and what the cluster does about it automatically

## Why This Matters

Nodes need patching, get replaced, and sometimes just die. Doing that safely — without a `kubectl delete node` that leaves pods orphaned, or a reboot that kills traffic mid-request — is a day-one operational skill, and it's also one of the most commonly tested hands-on scenarios in Kubernetes interviews and certification exams.

## Mental Model

A node has two independent things the scheduler cares about: whether it's **schedulable** (can new pods land here?) and whether it's **healthy** (should existing pods keep running here?). `cordon`/`uncordon` control the first, manually. Node conditions and their controllers govern the second, mostly automatically.

### The safe maintenance workflow

```bash
# 1. Mark the node unschedulable — existing pods keep running
kubectl cordon node-worker-3

# 2. Evict pods safely, respecting PodDisruptionBudgets
kubectl drain node-worker-3 \
  --ignore-daemonsets \
  --delete-emptydir-data \
  --timeout=300s

# 3. Do the actual maintenance: patch, reboot, replace hardware...

# 4. Mark the node schedulable again
kubectl uncordon node-worker-3
```

| Command | Effect on new pods | Effect on existing pods |
|---|---|---|
| `cordon` | Blocked (node marked `SchedulingDisabled`) | Untouched — keep running |
| `drain` | Blocked (implies cordon) | Evicted via the Eviction API, respecting `PodDisruptionBudget` |
| `uncordon` | Allowed again | Untouched |

`drain` without `--ignore-daemonsets` fails immediately, because DaemonSet pods are meant to run on every node and the DaemonSet controller will just recreate them there — draining can't remove them the normal way. `--delete-emptydir-data` is required if any pod uses an `emptyDir` volume, since that data is node-local and drain would otherwise refuse to destroy it silently.

`drain` calls the [Eviction API](https://kubernetes.io/docs/concepts/scheduling-eviction/api-eviction/) rather than just deleting pods — this means a `PodDisruptionBudget` that would be violated causes the eviction to be **retried, not forced**, so `drain` can hang if a PDB genuinely can't be satisfied (e.g., `minAvailable: 1` on a single-replica deployment). That hang is usually a signal your PDB and replica count don't agree with each other, not a bug in `drain`.

### Adding and removing nodes

Adding a node is the `kubeadm join` flow from [kubeadm Cluster Setup](01-kubeadm-cluster-setup.md) — the new node registers itself with the API server and starts reporting status once its kubelet is running. Removing one cleanly is more than deleting the Kubernetes object:

```bash
# Drain first — do not skip this
kubectl drain node-worker-3 --ignore-daemonsets --delete-emptydir-data

# Remove the node object from the cluster
kubectl delete node node-worker-3

# On the node itself, tear down kubelet state and reset iptables/CNI rules
sudo kubeadm reset
```

Deleting the node object without draining first doesn't evict the pods — it just makes the scheduler and other controllers stop tracking that node, while the kubelet (if it's still running) may keep the old pods alive locally, orphaned from the rest of the cluster's view of the world.

## Node Conditions and What They Drive

The kubelet reports several conditions on its own `Node` object roughly every 10 seconds (configurable via `--node-status-update-frequency`). The node's controller-manager component (`node-lifecycle-controller`) watches these and acts on them.

| Condition | Set when | What the cluster does |
|---|---|---|
| `Ready` | kubelet is healthy and can accept pods | `False`/`Unknown` for longer than `--pod-eviction-timeout` (default 5m) → pods evicted and rescheduled elsewhere |
| `MemoryPressure` | Available node memory drops below an eviction threshold | kubelet starts evicting pods locally, lowest-QoS-class first (`BestEffort` before `Burstable` before `Guaranteed`) |
| `DiskPressure` | Available disk or inodes drop below a threshold | kubelet stops scheduling new pods here and may evict existing ones; image garbage collection runs more aggressively |
| `PIDPressure` | Available process IDs drop below a threshold | kubelet stops admitting new pods, to avoid the node running out of PIDs entirely |

```bash
kubectl describe node node-worker-3 | grep -A5 Conditions
kubectl get nodes -o custom-columns=\
NAME:.metadata.name,\
READY:.status.conditions[-1].type,\
STATUS:.status.conditions[-1].status
```

!!! note "Ready vs. reachable"
    A node can be `Ready` and still be unreachable from a specific pod's perspective (a network partition). Kubernetes' `Ready` condition reflects whether the *kubelet* can talk to the *API server* — it is not a full end-to-end network health check of the node.

## Common Mistakes

- Running `kubectl delete node` directly, skipping `drain`, and losing track of pods that the kubelet kept running locally.
- Forgetting `--ignore-daemonsets`, then treating the resulting error as a sign something is broken rather than expected behavior.
- Setting a `PodDisruptionBudget` that can never be satisfied for the current replica count (e.g., `minAvailable: 3` on a 2-replica Deployment), then being confused why `drain` hangs forever.
- Assuming `cordon` evicts pods — it only blocks new scheduling; existing pods are untouched until you also `drain`.
- Ignoring `DiskPressure` warnings until the node stops scheduling entirely, instead of investigating image/log buildup early.

## Interview Questions

- Walk through the exact commands and order for safely taking a node down for a kernel patch.
- Why does `kubectl drain` sometimes hang indefinitely, and how do you diagnose it?
- What's the practical difference between `cordon` and `drain`?
- What does the kubelet do differently when it detects `MemoryPressure` versus `DiskPressure`?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Cluster Upgrades](04-cluster-upgrades.md) to apply this same node-by-node discipline to upgrading the entire cluster's Kubernetes version.
