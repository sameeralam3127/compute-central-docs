---
title: "Kubernetes Pod Stuck in Pending: FailedScheduling Fixes"
icon: lucide/hourglass
description: "Fix Kubernetes pods stuck in Pending — decode FailedScheduling messages for CPU and memory, taints, affinity, unbound PVCs, topology spread, and autoscaling."
tags:
  - Kubernetes
  - Troubleshooting
  - Scheduling
---

# Kubernetes Pod Stuck in Pending

## Problem

A pod stays `Pending`: the scheduler hasn't assigned it to a node, so no container has been created.

```text
NAME                        READY   STATUS    RESTARTS   AGE
orders-api-7c9d8b6f5-k2x4p  0/1     Pending   0          7m
```

Because nothing has started, there are no container logs. The answer is in the pod's events.

## Symptoms

- `kubectl get pod -o wide` shows `<none>` in the `NODE` column.
- Events show `FailedScheduling` with a message like `0/6 nodes are available: …`.
- New replicas from a scale-up or rollout never become ready.
- Sometimes there are **no events at all** — a clue in itself (see below).

## Likely Causes

The `FailedScheduling` message lists why each group of nodes was rejected. Match the phrases:

| Phrase in the message | Cause |
|---|---|
| `Insufficient cpu`, `Insufficient memory` | No node has enough **unrequested** capacity for the pod's `resources.requests` |
| `node(s) had untolerated taint {…}` | Nodes are tainted and the pod has no matching toleration |
| `node(s) didn't match Pod's node affinity/selector` | `nodeSelector` or required node affinity excludes the nodes |
| `pod has unbound immediate PersistentVolumeClaims` | A PVC the pod mounts isn't bound |
| `node(s) had volume node affinity conflict` | The volume lives in a zone where no eligible node exists |
| `node(s) didn't match pod topology spread constraints` | A `whenUnsatisfiable: DoNotSchedule` spread rule can't be met |
| `node(s) didn't match pod anti-affinity rules` | Required anti-affinity leaves no valid node |
| `node(s) didn't have free ports for the requested pod ports` | `hostPort` already used on every candidate node |
| `node(s) were unschedulable` | Nodes are cordoned |
| `Too many pods` | Nodes hit their maximum pod count (or run out of pod IP addresses) |

## Diagnostic Commands

```bash
# 1. The scheduler's explanation
kubectl describe pod orders-api-7c9d8b6f5-k2x4p | sed -n '/Events:/,$p'
kubectl get events -n orders --field-selector reason=FailedScheduling --sort-by=.lastTimestamp

# 2. What the pod asks for
kubectl get pod orders-api-7c9d8b6f5-k2x4p -o jsonpath='{range .spec.containers[*]}{.name}{"\t"}{.resources.requests}{"\n"}{end}'
kubectl get pod orders-api-7c9d8b6f5-k2x4p -o jsonpath='{.spec.nodeSelector}{"\n"}{.spec.affinity}{"\n"}{.spec.tolerations}{"\n"}'

# 3. What nodes can offer — requests already allocated, not live usage
kubectl describe nodes | grep -A 8 "Allocated resources"
kubectl get nodes -o custom-columns='NAME:.metadata.name,CPU:.status.allocatable.cpu,MEMORY:.status.allocatable.memory,TAINTS:.spec.taints[*].key'
kubectl get nodes --show-labels

# 4. Storage the pod depends on
kubectl get pvc -n orders
```

!!! note "Requests, not usage"
    The scheduler places pods by **requests**. A node at 15% real CPU usage can still be "full" if its pods request most of its allocatable CPU. `kubectl top nodes` shows usage and won't explain `Insufficient cpu`.

## Step-by-Step Debugging

1. **Read the full `FailedScheduling` message.** Each clause accounts for a group of nodes: `0/6 nodes are available: 3 Insufficient memory, 3 node(s) had untolerated taint {dedicated: gpu}`.
2. **Handle the largest group first.** In that example, fixing memory makes three nodes eligible; tolerating the GPU taint is probably wrong for a web service anyway.
3. **Compare requests with allocatable capacity.** A single pod requesting more than any node's allocatable memory can never schedule, no matter how many nodes you add.
4. **Check constraints you may have forgotten:** node selectors from a Helm values file, anti-affinity that requires one replica per node, topology spread across zones with only two zones available.
5. **Check the PVC** if storage is mentioned — see [Storage Problems](03-storage-problems.md#pvc-stuck-in-pending).
6. **If there are no events,** confirm the pod's `schedulerName` points to a scheduler that exists, and check whether a scheduling gate is set (`.spec.schedulingGates`).
7. **If you run an autoscaler,** check whether it tried to add a node and why it didn't — its events and logs explain constraints like instance types or max group size.

## Solutions

### Not enough capacity

```bash
# Right-size requests from observed usage
kubectl set resources deployment/orders-api -n orders --requests=cpu=250m,memory=384Mi
```

Or add capacity: scale the node group, or let the Cluster Autoscaler or Karpenter provision nodes. Check that a node type in the pool is actually large enough for the pod.

### Taints and tolerations

Only add a toleration when the workload belongs on those nodes:

```yaml
tolerations:
  - key: dedicated
    operator: Equal
    value: batch
    effect: NoSchedule
```

A toleration **allows** scheduling onto tainted nodes; it doesn't **require** it. Pair it with node affinity to target a dedicated pool. See [Scheduling, Affinity, and Taints](../workloads-and-scheduling/04-scheduling-affinity-and-taints.md).

### Node selector or affinity mismatch

Fix the selector, or label the intended nodes:

```bash
kubectl get nodes -l workload=api          # does any node have the label?
kubectl label node ip-10-0-2-15 workload=api
```

In managed clusters, set labels on the node group or NodePool definition rather than on individual nodes, which are replaced.

### Topology spread or anti-affinity can't be satisfied

Relax a hard rule when strict placement isn't essential:

```yaml
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: ScheduleAnyway     # was DoNotSchedule
    labelSelector:
      matchLabels:
        app: orders-api
```

Or use `preferredDuringSchedulingIgnoredDuringExecution` for anti-affinity instead of `required…`.

### Volume in the wrong zone

Use a StorageClass with `volumeBindingMode: WaitForFirstConsumer`, so the volume is created in the zone where the pod is scheduled rather than before scheduling.

### Cordoned nodes or pod limits

```bash
kubectl uncordon ip-10-0-2-15
```

For `Too many pods`, check the node's `.status.allocatable.pods` and, on AWS VPC CNI, the IP addresses available to the node.

## Prevention

- Set requests from measured usage with some headroom, and review them after load changes.
- Keep a `LimitRange` with sensible defaults so pods without requests don't get surprising values.
- Make sure every node pool has at least one instance type large enough for the biggest pod it should run.
- Prefer soft spread and anti-affinity rules unless availability truly requires hard ones.
- Alert on pods pending longer than a few minutes: `kube_pod_status_phase{phase="Pending"} == 1` held for 10 minutes, using kube-state-metrics.

## Production Considerations

- **Pending pods during a rollout stall it safely** if `maxUnavailable` is `0` — old pods keep serving.
- **Priority and preemption:** with PriorityClasses, higher-priority pods can evict lower-priority ones to fit. Check events for `Preempted` before assuming the cluster is simply full.
- **ResourceQuota is different.** A quota violation stops the pod from being created at all — you'll see `FailedCreate` on the ReplicaSet, not a `Pending` pod.
- **Capacity planning:** recurring `Insufficient` events are a signal to plan capacity, not only to add a node — see [Capacity Planning](../../sre/07-capacity-planning-and-load-testing.md).

## Related Problems

- [PVC stuck in Pending](03-storage-problems.md#pvc-stuck-in-pending)
- [Node NotReady and cluster problems](04-cluster-and-node-problems.md)
- [ImagePullBackOff](imagepullbackoff.md) — scheduled, but the image won't pull
- [Resource requests, limits, and QoS](../workloads-and-scheduling/05-resource-requests-limits-and-qos.md)
- [All pod startup errors](01-pod-scheduling-and-startup-problems.md)
