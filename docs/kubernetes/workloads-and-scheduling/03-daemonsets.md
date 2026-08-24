---
title: "Kubernetes DaemonSets: Node-Level Agents Explained"
icon: lucide/server
description: How DaemonSets run one pod per matching node for log collectors, CNI plugins, and monitoring agents, plus update strategies and node targeting.
tags:
  - Kubernetes
  - Workloads & Scheduling
---

# DaemonSets

## What You'll Learn

- Why some workloads need "exactly one pod per node," not a fixed replica count
- How DaemonSet update strategies differ from a Deployment's
- How to target a DaemonSet at a subset of nodes with node selectors and tolerations

## Why This Matters

A Deployment answers "how many replicas do I want." A DaemonSet answers a different question: "this pod needs to exist on every node (or every node of a certain kind), automatically, including nodes that don't exist yet." That's the right shape for infrastructure-level agents, and the wrong shape for application replicas — mixing the two up either under-provisions your log pipeline or wastes a node running an app pod nobody scheduled.

## Mental Model

> A DaemonSet doesn't have a `replicas` field. Its "replica count" is however many nodes match its scheduling rules — the DaemonSet controller adds a pod when a matching node joins, and removes it when the node leaves or stops matching.

Typical uses:

| Category | Examples |
|---|---|
| Log/metrics collection | Fluent Bit, Filebeat, Datadog Agent, node-exporter |
| Networking (CNI) | Calico, Cilium, Flannel — the per-node network agent itself |
| Storage | CSI node plugins (`csi-node-driver`) |
| Security | Falco, node-level admission/scanning agents |

## How It Works

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-log-collector
  namespace: observability
spec:
  selector:
    matchLabels:
      app: node-log-collector
  updateStrategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 0
  template:
    metadata:
      labels:
        app: node-log-collector
    spec:
      tolerations:
        - key: node-role.kubernetes.io/control-plane
          effect: NoSchedule
      nodeSelector:
        kubernetes.io/os: linux
      containers:
        - name: fluent-bit
          image: fluent/fluent-bit:3.1.4
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 200m
              memory: 256Mi
          volumeMounts:
            - name: varlog
              mountPath: /var/log
              readOnly: true
      volumes:
        - name: varlog
          hostPath:
            path: /var/log
```

### Update strategies

| Strategy | Behavior |
|---|---|
| `RollingUpdate` (default) | Replaces pods node-by-node, respecting `maxUnavailable` (percentage or count) |
| `OnDelete` | New pod spec is staged but a node's pod is only replaced when you manually delete it |

`RollingUpdate` is almost always right for agents you want to upgrade automatically; `OnDelete` is useful when you need to control the exact rollout pace by hand (e.g. upgrading a CNI plugin one node at a time with manual verification between each).

### Targeting a subset of nodes

DaemonSets run on **all** nodes by default, including control-plane nodes if their taints are tolerated. To restrict to a subset, combine:

- `nodeSelector` / node affinity — restrict which nodes can run the pod (e.g. `disktype: ssd`)
- `tolerations` — allow the pod to run on tainted nodes (e.g. control-plane nodes tainted `NoSchedule`) it would otherwise skip

```yaml
      nodeSelector:
        workload-type: gpu
      tolerations:
        - key: nvidia.com/gpu
          operator: Exists
          effect: NoSchedule
```

This pattern — a GPU-monitoring DaemonSet that only runs on GPU nodes — is common: the agent only makes sense on nodes with the hardware, and the taint keeps ordinary application pods off those (usually more expensive) nodes in the first place.

!!! note "Affinity and taints in depth"
    Node/pod affinity, taints, and tolerations are covered fully in [Scheduling, Affinity, and Taints](04-scheduling-affinity-and-taints.md) — this page only covers the DaemonSet-specific usage.

## Common Mistakes

- Setting resource requests too high on a DaemonSet — since it runs on every node, an oversized request multiplies across the whole cluster and eats capacity every other workload could have used.
- Forgetting control-plane taints — a DaemonSet meant to run everywhere silently skips control-plane nodes unless it tolerates their taint.
- Using a Deployment with a high replica count and anti-affinity rules to approximate "one per node" — it's fragile and doesn't auto-adjust as nodes join or leave, unlike a DaemonSet.
- Not setting `maxUnavailable` deliberately — the default rolling update pace may be too aggressive for a CNI plugin, where taking down too many nodes' network agents at once can partition the cluster.

## Interview Questions

- Why doesn't a DaemonSet have a `replicas` field, and how does its pod count actually get determined?
- How would you run a DaemonSet only on GPU nodes without also scheduling ordinary pods there?
- What's the difference between `RollingUpdate` and `OnDelete` update strategies for a DaemonSet, and when would you pick `OnDelete`?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Scheduling, Affinity, and Taints](04-scheduling-affinity-and-taints.md) to see the general mechanism DaemonSets, Deployments, and StatefulSets all rely on to land pods on the right nodes.
