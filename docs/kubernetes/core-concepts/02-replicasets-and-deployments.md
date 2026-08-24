---
title: "ReplicaSets vs. Deployments: Why You Almost Never Write a ReplicaSet"
icon: lucide/refresh-cw
description: How ReplicaSets reconcile a fixed Pod count, why Deployments wrap them instead of you writing ReplicaSets directly, and how basic rolling updates work.
tags:
  - Kubernetes
  - Core Concepts
---

# ReplicaSets and Deployments

## What You'll Learn

- What a ReplicaSet actually reconciles, mechanically
- Why almost no one writes a ReplicaSet manifest directly in 2026
- How a Deployment's default rolling update behaves, at an intro level

## Why This Matters

`kubectl get deployment` output makes it easy to forget that a Deployment doesn't manage Pods at all — it manages ReplicaSets, which manage Pods. That extra layer is not incidental complexity; it's exactly what makes rolling updates and rollbacks possible. Understanding the split is the difference between guessing at a stuck rollout and actually diagnosing it.

## Mental Model: ReplicaSet Is the Reconciliation Primitive

> A ReplicaSet's entire job is: "ensure exactly N Pods matching this selector exist, right now, and forever." Nothing more.

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: hello-web-rs
spec:
  replicas: 3
  selector:
    matchLabels:
      app: hello-web
  template:
    metadata:
      labels:
        app: hello-web
    spec:
      containers:
        - name: web
          image: nginx:1.27
          ports:
            - containerPort: 80
```

The ReplicaSet controller runs the exact watch-compare-act loop described in [Architecture and the Control Plane](../getting-started/02-architecture-and-control-plane.md): count Pods matching `spec.selector`, compare to `spec.replicas`, create or delete Pods to close the gap. That's the whole mechanism behind self-healing — delete a Pod by hand, and a new one appears within seconds, because the count dropped below 3.

## Why You Almost Never Write a ReplicaSet Directly

A bare ReplicaSet has no concept of *versions*. If you change its Pod template's image, nothing happens to existing Pods — a ReplicaSet only reconciles *count*, not *content drift* in already-running Pods. To roll out a new image with a bare ReplicaSet, you'd have to delete it and create a new one by hand, with no coordinated, gradual transition and no rollback history.

A **Deployment** solves exactly that gap by managing ReplicaSets on your behalf:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hello-web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: hello-web
  template:
    metadata:
      labels:
        app: hello-web
    spec:
      containers:
        - name: web
          image: nginx:1.27
          ports:
            - containerPort: 80
```

This looks almost identical to the ReplicaSet above — the difference is entirely in what happens when `spec.template` changes. A Deployment creates a **new** ReplicaSet for the new template, scales it up while scaling the old one down, and keeps the old ReplicaSet around (scaled to zero) for `kubectl rollout undo`.

```bash
$ kubectl get replicasets -l app=hello-web
NAME                   DESIRED   CURRENT   READY   AGE
hello-web-6b9f4c8d7f   0         0         0       12m
hello-web-7d8c9f6b5c   3         3         3       2m
```

Two ReplicaSets, one Deployment — the old one at zero replicas is exactly the rollback target `kubectl rollout undo deployment/hello-web` would scale back up.

## Basic Rolling Update Behavior

By default, a Deployment uses `strategy.type: RollingUpdate`, replacing Pods gradually rather than all at once:

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # at most 1 extra Pod above `replicas` during the rollout
      maxUnavailable: 1  # at most 1 fewer Pod than `replicas` during the rollout
```

With `replicas: 3`, `maxSurge: 1`, `maxUnavailable: 1`, the Deployment can briefly run up to 4 Pods and never drops below 2 while rolling from old to new. This default is deliberately conservative — it favors availability over rollout speed.

```bash
kubectl rollout status deployment/hello-web
kubectl rollout history deployment/hello-web
kubectl rollout undo deployment/hello-web
```

This is intro-level on purpose. Tuning `maxSurge`/`maxUnavailable` for real traffic patterns, `Recreate` vs. `RollingUpdate` trade-offs, and canary/blue-green strategies built on top of Deployments get the full treatment in [Deployment Strategies](../workloads-and-scheduling/01-deployment-strategies.md).

## Common Mistakes

- Writing a bare ReplicaSet for anything other than a very specific low-level use case — it gives up rolling updates and rollback history for no benefit in almost every real scenario.
- Assuming editing a ReplicaSet's Pod template updates its existing Pods — it doesn't; only new Pods created afterward use the new template.
- Confusing a Deployment's `replicas` field with the total Pod count during a rollout — the real number can temporarily exceed it because of `maxSurge`.

## Interview Questions

- What does a ReplicaSet reconcile, and what does it explicitly *not* handle?
- Why does a Deployment create a new ReplicaSet instead of updating the existing one's Pods in place?
- What do `maxSurge` and `maxUnavailable` control, and what does each one being `1` mean for a 3-replica Deployment during a rollout?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Services](03-services.md) to give this Deployment's Pods a stable network identity that survives every rollout.
