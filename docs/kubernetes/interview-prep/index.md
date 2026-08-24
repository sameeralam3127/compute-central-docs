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

## Next

Start with [Core Concepts](01-core-concepts-questions.md), or skip ahead to [Quick Reference](../quick-reference/index.md).
