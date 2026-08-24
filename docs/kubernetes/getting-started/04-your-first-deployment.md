---
title: "Kubernetes First Deployment Tutorial: Create, Expose, and Verify"
icon: lucide/play
description: A hands-on lab — create a Deployment, expose it with a Service, watch the rollout, and inspect logs, with full expected kubectl output.
tags:
  - Kubernetes
  - Getting Started
  - Lab
---

# Your First Deployment

A runnable lab, start to finish. You need `kubectl` pointed at a running cluster — if you're not there yet, finish [Installing kubectl and a Local Cluster](03-installing-kubectl-and-a-local-cluster.md) first.

## What You'll Learn

- How to create a Deployment imperatively, then expose it with a Service
- How to watch a rollout complete and confirm Pods are actually healthy
- How to read logs and basic status output well enough to know something worked

## Why This Matters

Reading YAML is not the same skill as watching a real rollout happen and knowing what "done" looks like. This lab is deliberately imperative (`kubectl create`, not a manifest file) so the first thing you build a feel for is the *sequence* — Deployment creates ReplicaSet creates Pods, Service gets endpoints, rollout reports done — before you start hand-writing YAML in [Core Concepts](../core-concepts/index.md).

## Step 1 — Create a Deployment

```bash
$ kubectl create deployment hello-web --image=nginx:1.27 --replicas=3
deployment.apps/hello-web created
```

This creates a Deployment object with three replicas, running the pinned `nginx:1.27` image — never `nginx:latest`, since an unpinned tag means you can't be sure what actually ends up running, or reproduce a bug later.

## Step 2 — Watch It Come Up

```bash
$ kubectl get pods -l app=hello-web
NAME                         READY   STATUS    RESTARTS   AGE
hello-web-6b9f4c8d7f-2xk4p   1/1     Running   0          8s
hello-web-6b9f4c8d7f-9j2md   1/1     Running   0          8s
hello-web-6b9f4c8d7f-qz7wn   1/1     Running   0          8s
```

`kubectl create deployment` automatically applied the label `app=hello-web` to the Pods it created — that's what the Deployment's selector uses internally to find "its" Pods.

## Step 3 — Expose It with a Service

```bash
$ kubectl expose deployment hello-web --port=80 --target-port=80 --type=ClusterIP
service/hello-web exposed

$ kubectl get svc hello-web
NAME        TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)   AGE
hello-web   ClusterIP   10.96.142.201   <none>        80/TCP    5s
```

The Service picked up the same `app=hello-web` selector automatically, so it already routes to all three Pods. `ClusterIP` is reachable from inside the cluster only — see [Services](../core-concepts/03-services.md) for the other types and when to use them.

## Step 4 — Confirm It's Actually Reachable

```bash
$ kubectl run -it --rm debug --image=busybox:1.36 --restart=Never -- wget -qO- http://hello-web
<!DOCTYPE html>
<html>
<head><title>Welcome to nginx!</title></head>
...
```

`kubectl run --rm` spins up a throwaway Pod, runs one command, and deletes itself — a fast way to test in-cluster connectivity without leaving debris behind.

## Step 5 — Trigger and Watch a Rollout

```bash
$ kubectl set image deployment/hello-web nginx=nginx:1.27.1
deployment.apps/hello-web image updated

$ kubectl rollout status deployment/hello-web
Waiting for deployment "hello-web" rollout to finish: 1 out of 3 new replicas have been updated...
Waiting for deployment "hello-web" rollout to finish: 2 out of 3 new replicas have been updated...
deployment "hello-web" successfully rolled out
```

`kubectl set image` bumps the container's image tag; the Deployment controller creates a new ReplicaSet and rolls Pods over from old to new, one at a time by default — the full mechanics of that rolling update live in [ReplicaSets and Deployments](../core-concepts/02-replicasets-and-deployments.md).

## Step 6 — Inspect Logs

```bash
$ kubectl get pods -l app=hello-web
NAME                         READY   STATUS    RESTARTS   AGE
hello-web-7d8c9f6b5c-4mvpz   1/1     Running   0          40s
hello-web-7d8c9f6b5c-8wqrx   1/1     Running   0          38s
hello-web-7d8c9f6b5c-lk2nc   1/1     Running   0          35s

$ kubectl logs hello-web-7d8c9f6b5c-4mvpz
/docker-entrypoint.sh: Configuration complete; ready for start up
2026/08/24 10:15:02 [notice] 1#1: nginx/1.27.1
2026/08/24 10:15:02 [notice] 1#1: start worker processes
```

Note the Pod names changed entirely — they now carry a new ReplicaSet hash (`7d8c9f6b5c` instead of `6b9f4c8d7f`), confirming the old ReplicaSet's Pods were replaced, not edited in place.

## What Actually Happened

| Command | What it did |
|---|---|
| `kubectl create deployment` | Created a Deployment, which created a ReplicaSet, which created 3 Pods |
| `kubectl expose deployment` | Created a Service that selects Pods by the Deployment's auto-applied label |
| `kubectl set image` | Updated the Deployment's Pod template, triggering a new ReplicaSet and a rolling update |
| `kubectl rollout status` | Blocked until the new ReplicaSet's Pods were all `Ready` and the old ones scaled to zero |
| `kubectl logs <pod>` | Streamed stdout/stderr from a specific container inside a specific Pod |

## Common Mistakes

- Using `nginx:latest` in a first deployment out of habit — it's the one habit worth breaking on day one, since it also makes `kubectl rollout undo` meaningless (there's no distinct prior tag to roll back to).
- Running `kubectl expose` before checking `kubectl get pods` shows `Running` — a Service with no ready backing Pods will exist but return nothing.
- Not noticing the Pod name's hash suffix changes after a rollout — that's your fastest visual confirmation that a genuinely new ReplicaSet (not a live-edited old one) was created.

## Interview Questions

- Walk through what objects get created when you run `kubectl create deployment`.
- How would you confirm a rollout actually finished, versus just kicked off?
- Why does a rolling update change the Pod name's hash suffix instead of reusing the existing Pods?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Core Concepts](../core-concepts/index.md) to build the vocabulary behind everything you just ran — Pods, Deployments, Services, and more, in YAML this time.
