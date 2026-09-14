---
title: "Kubernetes OOMKilled (Exit Code 137): Causes and Fixes"
icon: lucide/memory-stick
description: "Fix Kubernetes OOMKilled containers and exit code 137 — confirm the memory kill, size limits from real usage, tune runtimes, and tell OOM kills from evictions."
tags:
  - Kubernetes
  - Troubleshooting
  - Memory
---

# Kubernetes OOMKilled (Exit Code 137)

## Problem

A container is killed for using more memory than it's allowed. Kubernetes records the reason as `OOMKilled` with exit code `137`, and restarts the container — often into `CrashLoopBackOff`.

```text
NAME                        READY   STATUS      RESTARTS      AGE
orders-api-7c9d8b6f5-k2x4p  0/1     OOMKilled   4 (30s ago)   12m
```

The `OOMKilled` status is visible only briefly; most of the time you'll see `CrashLoopBackOff` or `Running` with a rising restart count. The last termination reason is the reliable signal.

## Symptoms

- `lastState.terminated.reason: OOMKilled` and `exitCode: 137`.
- Restarts correlate with traffic spikes, large requests, or batch jobs.
- The application logs stop abruptly with no error — the kernel killed the process; the app had no chance to log.
- Memory graphs climb to a flat ceiling just before each restart.

## Likely Causes

| Cause | Pattern |
|---|---|
| Limit set below what the app needs at normal load | Killed within seconds or minutes of starting |
| Memory leak | Usage grows steadily for hours, then the kill |
| Traffic or payload spikes | Kills correlate with peaks or specific requests |
| Runtime not respecting the container limit | JVM, Node.js, or Python worker counts sized for the node, not the container |
| Memory-backed volumes | `emptyDir` with `medium: Memory` counts toward the container's memory |
| Many worker processes | Each Gunicorn or Puma worker adds its own memory |

## Diagnostic Commands

```bash
# 1. Confirm it was an OOM kill, and when
kubectl get pod orders-api-7c9d8b6f5-k2x4p \
  -o jsonpath='{range .status.containerStatuses[*]}{.name}{"\t"}{.lastState.terminated.reason}{"\t"}{.lastState.terminated.exitCode}{"\t"}{.lastState.terminated.finishedAt}{"\n"}{end}'

# 2. The limits and requests in effect
kubectl get pod orders-api-7c9d8b6f5-k2x4p \
  -o jsonpath='{range .spec.containers[*]}{.name}{"\t"}{.resources}{"\n"}{end}'

# 3. Current usage per container (requires metrics-server)
kubectl top pod orders-api-7c9d8b6f5-k2x4p --containers

# 4. Every container OOM-killed recently, cluster-wide
kubectl get pods -A -o json | jq -r '
  .items[] | . as $p | .status.containerStatuses[]? |
  select(.lastState.terminated.reason=="OOMKilled") |
  "\($p.metadata.namespace)/\($p.metadata.name)\t\(.name)\t\(.lastState.terminated.finishedAt)"'
```

With Prometheus and kube-state-metrics:

```promql
# Memory working set against the limit, per container
max by (namespace, pod, container) (container_memory_working_set_bytes{container!=""})
/
max by (namespace, pod, container) (kube_pod_container_resource_limits{resource="memory"})

# Containers whose last termination was an OOM kill
kube_pod_container_status_last_terminated_reason{reason="OOMKilled"} == 1
```

`container_memory_working_set_bytes` is the figure that matters for limit enforcement; plain RSS can underestimate it.

## OOMKilled vs. Evicted

These look similar but have different fixes:

| | OOMKilled | Evicted for memory pressure |
|---|---|---|
| Trigger | Container exceeded **its own limit** | **Node** ran low on memory |
| Status | Container restarts; reason `OOMKilled` | Pod ends in `Failed` with reason `Evicted` and a message like `The node was low on resource: memory` |
| Who is affected | That container | Pods on that node, lowest QoS class first |
| Fix | Raise the limit or reduce usage | Set requests accurately, add node capacity, fix noisy neighbors |

## Step-by-Step Debugging

1. **Confirm the reason is `OOMKilled`,** not a liveness probe kill (also `137`). Probe kills show `Liveness probe failed` events instead.
2. **Look at the memory graph over time.** A sawtooth rising to the limit and dropping at restart points to a leak or slow growth; an instant spike after start points to a limit that's simply too low.
3. **Compare the limit to the runtime's settings.** A JVM with a fixed `-Xmx` larger than the limit, or 8 workers × 300 MiB in a 1 GiB container, will always be killed.
4. **Reproduce under load** in staging with the same limits, and watch usage while replaying realistic traffic.
5. **Profile if usage grows without bound** — heap dumps for JVMs, `tracemalloc` for Python, `--inspect` heap snapshots for Node.js.

## Solutions

### Size the limit from real usage

Take the peak working set under realistic load and add headroom:

```yaml
resources:
  requests:
    memory: "768Mi"       # close to typical usage, so scheduling is accurate
  limits:
    memory: "1Gi"         # peak observed usage plus headroom
```

Setting requests equal to limits for memory gives more predictable behavior under node pressure. Vertical Pod Autoscaler in recommendation mode can suggest values from history.

### Make the runtime container-aware

```yaml
env:
  # JVM: size the heap as a percentage of the container limit, leaving room for non-heap memory
  - name: JAVA_TOOL_OPTIONS
    value: "-XX:MaxRAMPercentage=75.0"
  # Node.js: cap the V8 old-space heap (MiB) below the container limit
  - name: NODE_OPTIONS
    value: "--max-old-space-size=768"
  # Go: soft memory limit so the GC works harder before hitting the hard limit
  - name: GOMEMLIMIT
    value: "900MiB"
```

For multi-process servers, reduce worker counts or size the limit as workers × per-worker usage plus overhead.

### Fix a leak

Raising the limit only delays a leak. Common sources: unbounded in-memory caches, per-request data kept in global structures, connection objects never closed, and large responses buffered fully instead of streamed. Add a size bound or TTL to caches, and stream large payloads.

### Memory-backed volumes

```yaml
volumes:
  - name: scratch
    emptyDir:
      medium: Memory
      sizeLimit: 256Mi     # counts toward the container's memory usage
```

Account for it in the limit, or use disk-backed `emptyDir` if speed isn't critical.

## Prevention

- Load-test with production-like limits before release, and record peak working set.
- Alert when working set exceeds about 90% of the limit for several minutes, not only after the kill.
- Alert on OOM kills: `increase(kube_pod_container_status_restarts_total[30m]) > 0` combined with the last-terminated reason metric above.
- Configure runtimes relative to the container limit instead of fixed values.
- Review limits after dependency upgrades — new library versions can change memory profiles substantially.

## Production Considerations

- **Kills during peak traffic cascade.** When one replica is killed, the others take its load and may be killed next. Add headroom and scale out before tightening limits.
- **Whole-container kills.** On nodes using cgroup v2 with recent Kubernetes versions, the kubelet configures the kernel to kill all processes in the container on an OOM event, not just the largest one — so a helper process can take down the main app.
- **Limits and QoS.** Pods without memory requests are `BestEffort` and evicted first under node pressure — see [Requests, Limits, and QoS](../workloads-and-scheduling/05-resource-requests-limits-and-qos.md).

## Related Problems

- [CrashLoopBackOff](crashloopbackoff.md) — the loop an OOM kill usually causes
- [Node NotReady and memory pressure](04-cluster-and-node-problems.md)
- [Linux memory and OOM kills](../../foundations/linux/07-performance-troubleshooting.md#memory)
- [All pod startup errors](01-pod-scheduling-and-startup-problems.md)
