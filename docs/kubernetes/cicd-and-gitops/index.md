---
title: "Kubernetes CI/CD and GitOps Guide"
icon: lucide/git-branch
description: Build Kubernetes delivery pipelines with GitHub Actions, Jenkins, and GitLab CI, script kubectl safely, and adopt GitOps with ArgoCD and Flux.
tags:
  - Kubernetes
  - CI/CD & GitOps
---

# CI/CD and GitOps

Getting a manifest onto a cluster once is a `kubectl apply` away. Getting every change onto the right cluster, safely, every time, without a human running commands by hand, is a pipeline problem. This section covers building CI/CD pipelines that deploy to Kubernetes, scripting `kubectl` so those pipelines are reliable and idempotent, operationalizing canary and blue-green releases with real traffic-shifting tools, and the pull-based GitOps model that many teams use instead of — or alongside — a traditional pipeline.

## Read in this order

1. [CI/CD Pipelines for Kubernetes](01-cicd-pipelines-for-kubernetes.md) — the build → test → scan → push → deploy stages, with working GitHub Actions, Jenkins, and GitLab CI examples
2. [Scripting and Automation with kubectl](02-scripting-and-automation-with-kubectl.md) — `-o json`/`-o jsonpath` with `jq`, `kubectl wait` for real readiness gates, and writing idempotent deploy scripts
3. [Progressive Delivery: Canary and Blue-Green](03-progressive-delivery-canary-and-blue-green.md) — running these patterns for real with Argo Rollouts and Flagger, including automated rollback on metric regressions
4. [GitOps with ArgoCD and Flux](04-gitops-with-argocd-and-flux.md) — git as the source of truth, pull-based reconciliation, and real ArgoCD and Flux installs

!!! tip "Pipeline first, or GitOps first?"
    You don't have to choose on day one. Most teams start with a push-based pipeline like [file 1](01-cicd-pipelines-for-kubernetes.md) because it's familiar, and migrate the deploy step to GitOps ([file 4](04-gitops-with-argocd-and-flux.md)) once drift and multi-cluster consistency become real problems.

## Next

Continue to [Production Engineering](../production-engineering/index.md) for the reliability practices — SLOs, capacity planning, disaster recovery — that sit on top of a working delivery pipeline.
