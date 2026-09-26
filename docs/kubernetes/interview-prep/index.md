---
title: "Kubernetes Interview Questions and Answers"
icon: lucide/graduation-cap
description: Kubernetes interview preparation organized by subject and level, from core concepts through staff/architect scenario questions.
tags:
  - Kubernetes
  - Interview Preparation
---

# Interview Preparation

Every question below ties back to a real operational concept, not a memorized definition. Reciting "a Service has four types" is worth far less than being able to explain what breaks when a selector doesn't match — which is the difference between passing a screening question and holding up under a senior follow-up.

## How This Is Organized

By **subject**, since that's how you'll actually study:

1. [Core Concepts](01-core-concepts-questions.md) — Pods, Deployments, Services, namespaces, ConfigMaps/Secrets, labels/selectors
2. [Architecture & Networking](02-architecture-and-networking-questions.md) — control plane components, kubelet/kube-proxy, CNI, DNS, Ingress vs. Service
3. [Scenario-Based Questions](03-scenario-based-questions.md) — full debugging walkthroughs for the classic production scenarios
4. [Security & RBAC](04-security-and-rbac-questions.md) — RBAC design, service accounts, Pod Security Admission, secrets handling
5. [Senior & Architect Questions](05-senior-and-architect-questions.md) — multi-cluster strategy, capacity planning, disaster recovery, cost, build-vs-buy

## By Level, Roughly

| Level | Where to focus |
|---|---|
| Beginner | [Core Concepts](01-core-concepts-questions.md) |
| Intermediate | [Architecture & Networking](02-architecture-and-networking-questions.md), [Security & RBAC](04-security-and-rbac-questions.md) |
| Advanced | [Scenario-Based Questions](03-scenario-based-questions.md) |
| Senior / Architect | [Senior & Architect Questions](05-senior-and-architect-questions.md) |

!!! tip "How senior interviews actually differ"
    A senior interview rarely asks "what is a `Service`" in isolation — it asks you to *reason* through a live situation ("15% of requests are 503ing during peak traffic, go") using several concepts at once. [Scenario-Based Questions](03-scenario-based-questions.md) is built around exactly that shape.

## Most Common Kubernetes Interview Questions, Answered Briefly

**What is Kubernetes?**
A container orchestrator: you declare the desired state (which images, how many replicas, what resources), and its controllers continuously reconcile the cluster toward it, rescheduling and restarting as things fail. [What Is Kubernetes?](../getting-started/01-what-is-kubernetes.md)

**What happens when you run `kubectl apply`?**
The API server authenticates, authorizes, and admits the request and stores it in etcd; controllers create ReplicaSets and Pods; the scheduler assigns nodes; each node's kubelet starts the containers. [Architecture](../getting-started/02-architecture-and-control-plane.md)

**Deployment vs. StatefulSet vs. DaemonSet?**
Deployment: interchangeable replicas. StatefulSet: stable names and a volume per replica, for databases and clustered systems. DaemonSet: one Pod per node, for agents. [StatefulSets](../workloads-and-scheduling/02-statefulsets.md)

**Liveness vs. readiness vs. startup probe?**
Liveness failure restarts the container; readiness failure removes it from Service endpoints; the startup probe holds off the other two until a slow app has booted. [Probes](../observability/01-probes-liveness-readiness-startup.md)

**Requests vs. limits?**
Requests are what the scheduler reserves; limits are hard caps. Exceeding a CPU limit throttles; exceeding a memory limit gets the container OOM-killed. [Requests and Limits](../workloads-and-scheduling/05-resource-requests-limits-and-qos.md)

**How do you debug a `CrashLoopBackOff`?**
Read the last termination reason and exit code, then `kubectl logs --previous`, then events. [CrashLoopBackOff](../troubleshooting/crashloopbackoff.md)

**How does a Service find its Pods?**
Its label selector; matching Ready Pods are published in EndpointSlices, which kube-proxy turns into routing rules. [Services](../core-concepts/03-services.md)

**Ingress vs. Gateway API?**
Both route external HTTP traffic to Services. Gateway API is the newer, role-based successor with typed routing features; ingress-nginx, the most common Ingress controller, was retired in 2026. [Gateway API](../networking/07-gateway-api.md)

**HPA vs. VPA?**
HPA changes the number of replicas; VPA changes each Pod's CPU and memory requests. [Autoscaling](../workloads-and-scheduling/06-autoscaling.md)

**Are Kubernetes Secrets encrypted?**
Not by default: they're base64-encoded, and encryption at rest in etcd must be configured. Restrict them with RBAC, or source them from an external manager. [Secrets and Encryption at Rest](../security/06-secrets-and-encryption-at-rest.md)

**What is a PodDisruptionBudget?**
A limit on how many of a workload's Pods voluntary disruptions (drains, upgrades, autoscaler scale-downs) may take down at once. [PodDisruptionBudgets](../workloads-and-scheduling/01-deployment-strategies.md#poddisruptionbudgets-availability-during-maintenance)

## Next

Start with [Core Concepts](01-core-concepts-questions.md), or skip ahead to [Quick Reference](../quick-reference/index.md).
