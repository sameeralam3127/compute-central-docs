---
title: "Kubernetes Pods Explained: Multi-Container, Init Containers, Lifecycle"
icon: lucide/package
description: What a Pod actually is — the smallest deployable unit in Kubernetes, multi-container sidecar patterns, init containers, and the five Pod lifecycle phases.
tags:
  - Kubernetes
  - Core Concepts
---

# Pods

## What You'll Learn

- Why the Pod, not the container, is Kubernetes's smallest deployable unit
- The sidecar pattern for multi-container Pods, and what init containers are for
- The five Pod lifecycle phases, and what actually happens during termination

## Why This Matters

Almost every other Kubernetes object — Deployment, StatefulSet, Job, DaemonSet — exists purely to manage Pods at scale. If you don't have a solid model of what a Pod actually guarantees (and doesn't), every higher-level controller looks like unrelated magic instead of "a loop that creates and deletes exactly this object."

## Mental Model

> A Pod is a group of one or more containers that share a network namespace, an IP address, and (optionally) storage volumes, and that are always scheduled, started, and stopped together, on the same node.

Kubernetes never schedules a bare container — it always schedules a Pod. A single-container Pod is by far the most common case, but the Pod, not the container, is the atomic unit the scheduler places and the atomic unit a Deployment or ReplicaSet counts as "one replica."

Because containers in a Pod share a network namespace, they share one IP address and can reach each other over `localhost` — that's the entire mechanism behind the sidecar pattern.

## Multi-Container Pods: The Sidecar Pattern

A **sidecar** is a second container in the same Pod that supports the main container — a log shipper, a metrics exporter, a TLS-terminating proxy — without being part of the main application's code.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-with-log-shipper
  labels:
    app: web
spec:
  containers:
    - name: web
      image: nginx:1.27
      ports:
        - containerPort: 80
      volumeMounts:
        - name: logs
          mountPath: /var/log/nginx
    - name: log-shipper
      image: busybox:1.36
      command: ["sh", "-c", "tail -F /var/log/nginx/access.log"]
      volumeMounts:
        - name: logs
          mountPath: /var/log/nginx
          readOnly: true
  volumes:
    - name: logs
      emptyDir: {}
```

Both containers share the `logs` volume and can each reach `localhost:80` — that shared namespace is exactly what makes this pattern work without any extra networking setup.

## Init Containers

An **init container** runs to completion *before* any regular container in the Pod starts. Kubernetes runs init containers sequentially, one at a time, and only starts the main containers once every init container has exited successfully.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-with-init
spec:
  initContainers:
    - name: wait-for-db
      image: busybox:1.36
      command: ["sh", "-c", "until nc -z db 5432; do echo waiting for db; sleep 2; done"]
  containers:
    - name: web
      image: nginx:1.27
      ports:
        - containerPort: 80
```

Common uses: waiting for a dependency to become reachable, running a one-time setup script, or populating a volume before the main container needs it — all without baking that logic into the application image itself.

## Pod Lifecycle Phases

| Phase | Meaning |
|---|---|
| **Pending** | Accepted by the API server, but not yet fully scheduled, or scheduled but still pulling images |
| **Running** | Bound to a node, and at least one container is running (others may still be starting or restarting) |
| **Succeeded** | Every container terminated successfully (exit code 0) and won't be restarted — normal for Job Pods |
| **Failed** | Every container terminated, and at least one exited with a non-zero code |
| **Unknown** | The Pod's state can't be determined, typically because the node it's on stopped reporting |

These are Pod-level phases, distinct from per-container states (`Waiting`, `Running`, `Terminated`) visible under `kubectl describe pod` — a Pod can show `Running` while one of its containers is individually `Waiting` on a restart backoff.

## Pod Termination, Briefly

When a Pod is deleted, Kubernetes doesn't just kill it — it runs a **graceful termination** sequence: the Pod is marked `Terminating`, removed from Service endpoints so no new traffic routes to it, sent `SIGTERM`, given `terminationGracePeriodSeconds` (default 30s) to shut down cleanly, and only then sent `SIGKILL` if it hasn't exited. An application that ignores `SIGTERM` entirely will always eat the full grace period on every restart or rollout.

## Common Mistakes

- Treating "container" and "Pod" as interchangeable — the scheduler places Pods, not individual containers, and a multi-container Pod lives or dies as one unit.
- Forgetting that Pods are ephemeral by design — a Pod that dies is never resurrected; a controller (ReplicaSet, Job, etc.) creates a brand-new Pod with a new name and IP. See [Volumes and Storage Basics](07-volumes-and-storage-basics.md) for what that means for data.
- Not handling `SIGTERM` in the application, causing every deploy or scale-down to hang for the full termination grace period before Kubernetes force-kills the container.
- Debugging a `CrashLoopBackOff` by only checking `kubectl get pods` instead of `kubectl describe pod` and `kubectl logs --previous`, which show *why* the last attempt failed.

## Interview Questions

- Why is the Pod, not the container, Kubernetes's smallest deployable unit?
- What's the difference between an init container and a sidecar container?
- Walk through what happens, step by step, when a Pod is deleted.

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [ReplicaSets and Deployments](02-replicasets-and-deployments.md) to see how Kubernetes keeps a fixed number of these Pods running automatically.
