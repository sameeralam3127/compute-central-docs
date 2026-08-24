---
title: "Senior and Staff Kubernetes Interview Questions"
icon: lucide/crown
description: Senior and architect-level Kubernetes interview questions on multi-cluster strategy, capacity planning, disaster recovery, cost, and build-vs-buy.
tags:
  - Kubernetes
  - Interview Preparation
---

# Interview Prep: Senior & Architect Questions

These questions test architectural judgment across an entire organization's platform, not knowledge of a single cluster's YAML. A strong answer names the tradeoff explicitly rather than presenting one option as universally correct.

## How would you decide between one large multi-tenant cluster and many smaller per-team clusters?

**Model answer:** Start from blast radius and operational cost, not preference. One large cluster is cheaper to run and easier to keep consistent (one control plane to upgrade, one set of platform policies), but a control-plane incident, a bad cluster-wide CRD upgrade, or one team's noisy-neighbor workload can affect everyone. Many smaller clusters isolate failure and let teams move at different upgrade cadences, at the cost of duplicated platform tooling (ingress, monitoring, RBAC setup) per cluster and real cross-cluster networking/service-discovery complexity if teams need to talk to each other.

**What a strong answer adds:** the actual decision usually isn't binary — most organizations land on a middle ground: a handful of clusters segmented by real boundaries that matter (environment: dev/staging/prod; compliance: PCI-scoped workloads isolated from the rest; or by region for latency and disaster-recovery reasons), with strong namespace-level multi-tenancy *inside* each cluster rather than one cluster per team. Naming that middle ground, and the specific boundary that justifies each split, is what separates a senior answer from a memorized "it depends."

## Walk through your approach to capacity planning for a growing platform.

**Model answer:** Start from measured data, not intuition — `kubectl top nodes`/`kubectl top pods` history and, better, the metrics already flowing into Prometheus, to establish actual CPU/memory utilization trends over weeks, not a snapshot. Project growth using the business's own forecast (expected traffic growth, planned feature launches, seasonal peaks) applied to that baseline, then add a deliberate buffer — commonly 20-30% — sized to the *variance* you've actually observed, not a round number picked without data.

**What a strong answer adds:** capacity planning isn't just node count — it includes right-sizing node *types* (a handful of large nodes bin-pack more efficiently than many small ones for the same total capacity, but increase blast radius per node failure), planning separate node pools for workloads with different profiles (a memory-heavy batch job pool separate from a latency-sensitive web-tier pool), and explicitly deciding the split between committed/reserved capacity for steady-state baseline load and autoscaled/spot capacity for burst — since conflating the two either overspends on baseline or under-provisions for spikes.

## How do you design disaster recovery for a Kubernetes platform, and what actually needs backing up?

**Model answer:** Three layers need a recovery plan, and they're often wrongly treated as one: `etcd` (the cluster's own state — every object definition, live but not application data), application data in persistent volumes (databases, file stores), and the *declarative source* that can rebuild the cluster's workloads from scratch (Git, if you run GitOps). Losing `etcd` without a recent snapshot means rebuilding every Kubernetes object by hand; losing PV data without a backup (via a tool like Velero, or the storage backend's own snapshotting) means losing actual application state regardless of how healthy Kubernetes itself is.

**What a strong answer adds:** the plan needs a stated RTO/RPO per layer, because they're not equal — rebuilding workload definitions from a Git-backed GitOps repo can be near-instant once a fresh cluster exists, while restoring a large stateful database from a PV snapshot can take hours, and that number should be known *before* an incident, not discovered during one. It's also worth naming that "multi-region active-passive" and "multi-region active-active" are very different commitments — active-active for stateful workloads usually means solving data replication and split-brain at the application/database layer, which Kubernetes itself does nothing to provide.

## How do you approach cost optimization on a Kubernetes platform without just telling teams to "use fewer resources"?

**Model answer:** Start with visibility — most cost problems are invisible until resource requests/limits and actual usage are compared per namespace or team, which is where tools like Kubecost or OpenCost earn their keep. From there, the concrete levers are: right-sizing requests to observed usage (over-requested CPU/memory is capacity paid for and never used), using cluster autoscaling so idle capacity actually scales down instead of sitting reserved, mixing spot/preemptible nodes in for fault-tolerant or batch workloads at a meaningful discount, and consolidating small, sparse workloads that were each given their own dedicated node pool "for isolation" without a real isolation requirement behind it.

**What a strong answer adds:** cost optimization has a ceiling that conflicts with reliability if pushed too far — packing nodes tighter reduces headroom for spikes and node failures, and aggressive spot usage without proper `PodDisruptionBudget`s and graceful-shutdown handling trades cost for availability risk. Naming that tradeoff, and where the organization's actual risk tolerance sits, is the senior part of the answer — not just listing the levers.

## When does it make sense to run self-managed Kubernetes versus a managed offering like EKS, GKE, or AKS — or to avoid Kubernetes entirely?

**Model answer:** For the overwhelming majority of organizations, a managed control plane is the right default — the cloud provider absorbs `etcd` operations, control-plane upgrades, and the security patching of the API server, which is real, ongoing operational load that produces no product value when done in-house. Self-managed Kubernetes earns its cost primarily in specific situations: strict data-residency or air-gapped requirements a managed offering can't satisfy, a genuinely unusual scale or customization need (custom scheduler behavior, a heavily modified control plane), or running on-prem/bare-metal where no managed offering exists at all.

**What a strong answer adds:** the harder and more senior version of this question is knowing when *not* to use Kubernetes at all — a small team running a handful of stateless services is frequently better served by a simpler platform (Cloud Run, ECS/Fargate, a PaaS) that gives most of the same container-orchestration benefit without the operational surface area of RBAC, CNI, admission control, and cluster upgrades. Recommending Kubernetes by default, rather than because the workload's actual scale or portability requirements demand it, is the anti-pattern a good architect explicitly avoids naming as their instinct.

## Next

Return to [Interview Preparation](index.md), or continue to [Quick Reference](../quick-reference/index.md).
