---
title: "Kubernetes Tutorial: Getting Started Guide"
icon: lucide/rocket
description: Start here — Kubernetes' history, a precise definition, its control-plane architecture, installing kubectl and a local cluster, and your first deployment.
tags:
  - Kubernetes
  - Getting Started
---

# Getting Started

Everything you need before you write your first real manifest: why Kubernetes exists, what it actually is, how its control plane works, how to get `kubectl` talking to a cluster, and how to go from a blank terminal to a running, reachable Deployment.

If you already know Kubernetes and want a specific answer, use [Quick Reference](../quick-reference/index.md) or [Troubleshooting](../troubleshooting/index.md) instead — this section is for building the mental model once, in order.

## Read in this order

0. [History and Why Kubernetes Exists](00-history-and-why-kubernetes.md) — Borg, Omega, the 2014 open-source release, and the problem plain Docker doesn't solve
1. [What Is Kubernetes?](01-what-is-kubernetes.md) — a precise definition, and where it sits next to Docker, Ansible, and Terraform
2. [Architecture and the Control Plane](02-architecture-and-control-plane.md) — kube-apiserver, etcd, scheduler, controller manager, kubelet, kube-proxy, and the reconciliation loop
3. [Installing kubectl and a Local Cluster](03-installing-kubectl-and-a-local-cluster.md) — kubectl, kubeconfig and contexts, and choosing between minikube, kind, Docker Desktop, and Rancher Desktop
4. [Your First Deployment](04-your-first-deployment.md) — `create deployment` → `expose` → `rollout status` → `logs`, with real output

!!! tip "If you're impatient"
    You can skip straight to [Your First Deployment](04-your-first-deployment.md) and come back for the "why" later — it's self-contained as long as you already have `kubectl` pointed at a running cluster. If you don't have a cluster yet, [Installing kubectl and a Local Cluster](03-installing-kubectl-and-a-local-cluster.md) gets you one in a few minutes, and full hands-on labs live in [Labs](../labs/index.md).

## Next

Once you have a running Deployment and a Service you can reach, continue to [Core Concepts](../core-concepts/index.md).
