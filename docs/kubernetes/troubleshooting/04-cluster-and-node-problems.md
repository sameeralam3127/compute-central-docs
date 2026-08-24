---
title: "Fix Kubernetes Node NotReady and Control Plane Failures"
icon: lucide/server
description: Diagnosing Node NotReady, DiskPressure and MemoryPressure evictions, and unreachable control-plane components like the API server and etcd.
tags:
  - Kubernetes
  - Troubleshooting
  - Nodes
---

# Cluster and Node Problems

Everything on this page sits below the workload layer — a perfectly healthy Deployment can still fail if the node it lands on is unhealthy, or if the control plane itself can't schedule or record anything. Confirm the layer with `kubectl get nodes` and `kubectl get componentstatuses` before chasing application-level explanations.

## Node `NotReady`

```bash
kubectl get nodes
# NAME    STATUS     ROLES    AGE   VERSION
# node1   NotReady   <none>   30d   v1.30.2
```

**Likely causes:**

1. `kubelet` on the node has stopped or crashed.
2. The node lost network connectivity to the API server (firewall change, CNI failure, node-level networking issue).
3. The CNI plugin itself isn't running or is unhealthy on that node.

**Diagnosis:**

```bash
kubectl describe node node1 | grep -A10 Conditions
kubectl get pods -n kube-system -o wide | grep node1   # is the CNI daemonset pod running there?

# On the node itself
ssh node1
systemctl status kubelet
journalctl -u kubelet -n 100 --no-pager
```

The `Conditions` block in `describe node` names the exact reason — `KubeletNotReady`, `NetworkUnavailable`, or a specific message from the kubelet's own health checks.

**Fix:**

```bash
# kubelet stopped — restart it and watch it come back
systemctl restart kubelet
journalctl -u kubelet -f

# CNI plugin unhealthy — restart its pods on the affected node
kubectl delete pod -n kube-system -l k8s-app=calico-node --field-selector spec.nodeName=node1
```

**Prevention:** alert on the `Ready` condition directly rather than only on symptoms further up the stack, and keep kubelet/CNI versions in sync with the control plane per the supported version skew.

## `DiskPressure` and `MemoryPressure` Evictions

```bash
kubectl describe node node1 | grep -A3 "DiskPressure\|MemoryPressure"
# DiskPressure   True   KubeletHasDiskPressure   kubelet has disk pressure
```

When a node reports pressure, the kubelet starts evicting pods to reclaim resources — including pods that were otherwise perfectly healthy.

**Likely causes:**

1. Container images, logs, or emptyDir volumes have filled the node's disk.
2. Aggregate memory requested/used across all pods on the node exceeds what the kubelet's eviction thresholds allow.

**Diagnosis:**

```bash
kubectl get events -A --field-selector reason=Evicted
ssh node1
df -h
du -sh /var/lib/containerd/* 2>/dev/null | sort -rh | head
```

**Fix:**

```bash
# Reclaim disk immediately
crictl rmi --prune               # remove unused images (containerd)
kubectl delete pods --field-selector=status.phase=Failed -A

# Longer-term: cordon and drain to rebalance, then investigate the actual consumer
kubectl cordon node1
kubectl drain node1 --ignore-daemonsets --delete-emptydir-data
```

**Prevention:** set resource requests/limits on every pod so the scheduler can't overcommit a node past what it can actually hold, and monitor node disk/memory independently of pod-level metrics so pressure is caught before evictions start.

## Control Plane Component Failures

```bash
kubectl get --raw /healthz
kubectl get --raw /readyz?verbose
```

If `kubectl` itself is slow or timing out, the failure is in the API server or etcd, not in any workload — check this layer first whenever *everything* looks wrong at once rather than one specific pod.

**Likely causes:**

1. `etcd` is unreachable or has lost quorum (common in self-managed clusters after a control-plane node failure).
2. `kube-apiserver` is overloaded, crash-looping, or unreachable due to a certificate/network issue.
3. `kube-scheduler` or `kube-controller-manager` has stopped leading, so nothing new gets scheduled or reconciled even though the API server itself responds.

**Diagnosis:**

```bash
kubectl get componentstatuses          # deprecated but still useful on self-managed clusters
kubectl get pods -n kube-system -l component=etcd
kubectl get pods -n kube-system -l component=kube-apiserver

# On a control-plane node (self-managed / kubeadm clusters)
journalctl -u kubelet -n 200 --no-pager
crictl ps -a | grep -E 'etcd|kube-apiserver'
crictl logs <etcd-container-id>
```

On a managed platform (EKS, GKE, AKS), you don't have node access to the control plane — check the cloud provider's control-plane status page and audit logs instead of looking for local pods.

**Fix:** control-plane recovery is highly environment-specific — restoring `etcd` from a snapshot, restarting a crash-looping static pod by fixing its manifest in `/etc/kubernetes/manifests/`, or failing over to a healthy control-plane node in a multi-master setup. The universal first step is always the same: confirm which specific component is down before touching anything, since restarting the wrong one can turn a partial outage into a full one.

```bash
# Restore etcd from a snapshot (self-managed clusters, high-level shape)
etcdctl snapshot restore /backups/etcd-snapshot.db \
  --data-dir /var/lib/etcd-restored
```

**Prevention:** run an odd number of etcd members (3 or 5) so quorum survives a single-node failure, take regular etcd snapshots, and alert on API server latency/error rate as a leading indicator, not just on outright downtime.

## Quick Reference

| Symptom | Layer | Fix starting point |
|---|---|---|
| Node `NotReady` | kubelet/CNI | `journalctl -u kubelet`, check CNI pod on that node |
| Pods `Evicted`, node under pressure | Node disk/memory | `df -h`, `crictl rmi --prune`, cordon/drain |
| `kubectl` slow or timing out cluster-wide | Control plane | `kubectl get --raw /healthz`, check etcd/apiserver pods |

## Interview Questions

- A node shows `NotReady` — what's the fastest way to tell "kubelet crashed" apart from "network partition to the API server"?
- Why does `DiskPressure` on one node cause pods to be evicted, and why might that make an unrelated problem elsewhere look worse?
- Why does etcd need an odd number of members, and what actually happens if it loses quorum?

## Next

Return to [Troubleshooting](index.md), or continue to [Interview Preparation](../interview-prep/index.md).
