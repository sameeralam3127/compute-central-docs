---
title: "Kubernetes Cost Optimization: Right-Sizing, Spot, and Autoscaling"
icon: lucide/circle-dollar-sign
description: Practical Kubernetes cost optimization — right-sizing from real usage, spot node pools, Cluster Autoscaler vs. Karpenter, bin-packing, and cost visibility.
tags:
  - Kubernetes
  - Production Engineering
---

# Cost Optimization

## What You'll Learn

- How to right-size requests and limits from observed usage instead of guessed values
- How spot/preemptible capacity, Cluster Autoscaler, and Karpenter fit together to cut compute spend
- Why bin-packing and cost-visibility tooling turn "the cloud bill is high" into an actionable, per-team number

## Why This Matters

The single biggest driver of Kubernetes overspend isn't the wrong instance type — it's requests that don't reflect reality. A team that requests `2` CPU "to be safe" for a workload that uses `200m` is reserving 10x the compute it needs, and the scheduler will happily pack the cluster around that lie, forcing more nodes than the actual workload requires. Fixing requests is cheaper and more durable than any autoscaler tuning.

## Mental Model

> Kubernetes cost has three independent levers: how much you *ask* for per pod (requests), how tightly the scheduler *packs* pods onto nodes (bin-packing), and how cheaply the *nodes themselves* are bought (spot vs. on-demand, autoscaler choice). Pulling only one lever leaves money on the table.

## How It Works

### Right-sizing from actual usage

Never set requests from a guess or a round number — set them from what the workload has actually consumed under real traffic.

```bash
# Requires metrics-server
kubectl top pods -n payments --sort-by=cpu
kubectl top pods -n payments --sort-by=memory
```

For a defensible number, look at usage over days or weeks, not a single `kubectl top` snapshot — a tool like the Vertical Pod Autoscaler (VPA) in **recommendation-only mode** is the standard way to do this without letting it actually rewrite live pods:

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: payments-api-vpa
  namespace: payments
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: payments-api
  updatePolicy:
    updateMode: "Off"   # recommend only — never auto-mutates running pods
```

```bash
kubectl describe vpa payments-api-vpa -n payments
# Recommendation block shows target/lower/upper bound CPU and memory
```

Set requests near the VPA's "target" recommendation and limits with headroom above it — not the reverse. A common, defensible pattern:

| Resource | Request | Limit |
|---|---|---|
| CPU | At/near observed p50-p70 usage | 2-3x request, or unset for CPU (CPU is compressible) |
| Memory | At/near observed p90-p99 usage | 1.2-1.5x request (memory is not compressible — OOMKill on breach) |

### Spot and preemptible capacity

Spot (AWS/Azure) and preemptible (GCP) nodes are typically 60-90% cheaper than on-demand, in exchange for the provider being able to reclaim them with little notice (seconds to ~2 minutes). They're a strong fit for stateless, horizontally-scaled, interruption-tolerant workloads — batch jobs, CI runners, stateless web/API tiers behind a Deployment — and a poor fit for anything stateful and hard to reschedule quickly (a single-replica database, a leader-election-heavy controller).

Handle disruption explicitly rather than hoping pods reschedule fast enough:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: batch-worker
spec:
  nodeSelector:
    node.kubernetes.io/capacity-type: spot
  tolerations:
    - key: "spot"
      operator: "Equal"
      value: "true"
      effect: "NoSchedule"
  terminationGracePeriodSeconds: 25   # leave room to drain before spot reclaim
  containers:
    - name: worker
      image: registry.example.com/batch-worker:2.4.1
```

Pair spot node pools with a PodDisruptionBudget so a wave of reclaimed nodes can't take an entire Deployment down at once — see [Production Readiness Checklist](05-production-readiness-checklist.md) for where PDBs fit into the broader gate.

### Cluster Autoscaler vs. Karpenter

| | Cluster Autoscaler | Karpenter |
|---|---|---|
| Scaling unit | Node groups / ASGs (pre-defined instance types per group) | Individual nodes, chosen just-in-time |
| Instance type flexibility | Limited to the node groups you defined | Picks from a broad, constraint-based set per pending pod |
| Scale-up latency | Waits on ASG/node-group provisioning | Generally faster — launches directly against cloud APIs |
| Bin-packing awareness | Scales groups; less aware of optimal shape | Actively chooses instance shape to fit pending pods tightly |
| Maturity / ecosystem | Original, broadly supported across all major clouds | AWS-native origin, expanding to more providers |

Cluster Autoscaler is the safer default when you already have fixed node groups and want simple, predictable scaling. Karpenter is worth adopting when instance-type diversity and tighter bin-packing meaningfully move your bill — which is most likely once a cluster is large enough that node-shape mismatch is visibly wasting capacity.

### Bin-packing

Even with correct requests and a good autoscaler, poor bin-packing wastes nodes — for example, several nodes each running one pod that could all fit on one node together. Two concrete levers:

- **Pod priority and preemption** to make sure the scheduler fills existing nodes before triggering a scale-up.
- **`topologySpreadConstraints` and anti-affinity used deliberately, not by default** — spreading for availability is good, but spreading a low-priority batch job across every node in the cluster "for resilience" actively fights bin-packing and keeps otherwise-emptyable nodes alive.

```bash
# Find nodes running very few pods relative to their capacity — bin-packing candidates
kubectl get pods -A -o wide --field-selector spec.nodeName=<node> | wc -l
kubectl describe node <node> | grep -A5 "Allocated resources"
```

### Cost visibility

Requests, spot usage, and bin-packing only stay optimized if someone can see cost per namespace, team, or workload over time — otherwise regressions creep back in unnoticed. Tools like **Kubecost** (or a cloud provider's own cost-allocation views) attribute spend down to namespace/label/workload level using actual requests, usage, and node pricing, which is what turns "the bill went up" into "team X's staging environment is running 40 replicas it doesn't need."

## Common Mistakes

- Setting requests from a guess ("2 CPU to be safe") instead of measured usage, then wondering why the cluster needs 3x the nodes it should.
- Putting a stateful, hard-to-reschedule workload on spot capacity with no PodDisruptionBudget and no tolerance for interruption.
- Adopting Karpenter or tuning Cluster Autoscaler aggressively while requests are still wrong — the autoscaler can only pack what you ask for; it can't fix a lie.
- Spreading every workload across every node "for resilience" by default, which prevents nodes from ever being emptied and scaled down.
- Having no per-team cost visibility, so nobody is accountable for regressions until the monthly bill is already high.

## Interview Questions

- Why does right-sizing requests matter more for cost than choosing a cheaper instance type?
- What's the practical difference between Cluster Autoscaler and Karpenter, and when would you choose one over the other?
- How would you safely run a workload on spot/preemptible nodes without risking an availability incident?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Multi-Cluster and Multi-Region](03-multi-cluster-and-multi-region.md) to see how these same cost and capacity concerns change once a workload spans more than one cluster.
