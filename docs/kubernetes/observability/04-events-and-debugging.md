---
title: "Kubernetes Debugging: Events, Describe, exec, and Debug Containers"
icon: lucide/search
description: A repeatable Kubernetes debugging methodology using kubectl describe, get events, ephemeral debug containers, exec, port-forward, and cp.
tags:
  - Kubernetes
  - Observability & Health
---

# Events and Debugging

## What You'll Learn

- The five core `kubectl` debugging tools, and what each one actually reveals that the others don't
- Ephemeral debug containers — how to get a shell into a pod that has no shell of its own
- A repeatable, ordered debugging methodology you can apply to almost any broken workload

## Why This Matters

Debugging Kubernetes under pressure goes much faster with a fixed sequence than with random `kubectl` commands fired in whatever order comes to mind. The tools in this page are the same handful you'll use for nearly every incident — the skill is knowing which one answers which question, and in what order to reach for them so you're not guessing.

## Mental Model

> Diagnose from the outside in: what does Kubernetes *think* the pod's state is, then what *happened* to get it there, then what is the *application itself* saying, and only then go *inside* the container if you still don't have an answer.

```mermaid
flowchart LR
    A[kubectl get pods] --> B[kubectl describe pod]
    B --> C[kubectl get events]
    C --> D[kubectl logs]
    D --> E[kubectl exec / debug]
```

## How It Works

### Step 1 — Pod status

```bash
kubectl get pods -n production -o wide
```

Start here: is it `Pending` (not scheduled yet), `CrashLoopBackOff` (starting and dying repeatedly), `ImagePullBackOff` (can't pull the image), or `Running` but just not behaving correctly? The status alone usually narrows which of the next steps matters most.

### Step 2 — `kubectl describe`

```bash
kubectl describe pod my-pod -n production
```

`describe` surfaces what plain `get` doesn't: the scheduling decision (or why it failed), container state transitions with exit codes and reasons, resource requests/limits versus what the node actually has available, mounted volumes, and — critically — an embedded feed of recent Events scoped to that object.

### Step 3 — `kubectl get events`

```bash
# Cluster-wide, in chronological order
kubectl get events -n production --sort-by=.metadata.creationTimestamp

# Live stream
kubectl get events -n production --watch

# Scoped to one object
kubectl get events -n production --field-selector involvedObject.name=my-pod
```

Events capture things `describe` on a single pod won't show in full context — a FailedScheduling event across all pending pods, a node's MemoryPressure condition, a volume attach failure. Events are also **short-lived** (retained roughly an hour by default) — if you're investigating something that happened earlier, the Events API may have already garbage collected the evidence, which is exactly why cluster-wide event/log aggregation matters for anything beyond immediate triage.

### Step 4 — Logs

Covered in full in [Logging](02-logging.md) — `kubectl logs`, `--previous` for a crashed container's last output, `-c` for a specific container in a multi-container pod.

### Step 5 — Getting inside: exec, ephemeral debug containers, port-forward, cp

```bash
# Shell into a running container that has one
kubectl exec -it my-pod -- /bin/sh

# A specific container in a multi-container pod
kubectl exec -it my-pod -c sidecar -- /bin/sh
```

Many production images (distroless, `scratch`-based) deliberately ship **without** a shell — `kubectl exec` into them fails outright. **Ephemeral debug containers**, via `kubectl debug`, solve this by attaching a temporary container with full debugging tools directly into the target pod's process/network namespace, without modifying the pod's actual spec or restarting it:

```bash
# Attach a debug container with a full toolset to an already-running pod
kubectl debug -it my-pod --image=busybox:1.36 --target=app

# Debug a node itself by launching a privileged pod in its namespace
kubectl debug node/my-node -it --image=busybox:1.36
```

`--target=app` is what makes this genuinely useful for distroless containers: the ephemeral container shares the target container's process namespace, so tools like `ps`, `netstat`, or `curl` inside the debug container can inspect the actual running application process even though the application's own image has none of those tools.

```bash
# Test connectivity to a Service from inside the cluster
kubectl port-forward service/my-service 8080:80
# then curl localhost:8080 from your machine

# Copy a file out of (or into) a container for offline inspection
kubectl cp production/my-pod:/var/log/app/error.log ./error.log
```

`port-forward` is especially useful for reaching a Service or Pod that has no external exposure at all — bypassing Ingress and LoadBalancer entirely to test straight from your local machine. `cp` is the fastest way to pull a large log file or heap dump off a container for analysis somewhere with better tooling than a shell inside the pod.

### Putting the methodology together

1. **Status** — `kubectl get pods` — what phase is it in?
2. **Describe** — `kubectl describe pod` — what does Kubernetes' own state say happened?
3. **Events** — `kubectl get events --sort-by=...` — what happened, cluster-wide, around that time?
4. **Logs** — `kubectl logs` (with `--previous` if it crashed) — what did the application itself report?
5. **Exec / debug** — `kubectl exec` or `kubectl debug` — if the above didn't explain it, get inside and look directly.

This exact sequence is what the [Troubleshooting](../troubleshooting/index.md) section applies to specific symptoms — `CrashLoopBackOff`, `ImagePullBackOff`, a Service with no working endpoints — so it's worth internalizing here rather than re-deriving it under pressure each time.

## Common Mistakes

- Jumping straight to `kubectl exec` before checking `describe` and `events`, which usually already explain the problem without needing to get inside the container at all.
- Trying `kubectl exec` on a distroless or `scratch`-based image and concluding the pod is "unreachable" instead of using `kubectl debug --target` to attach an ephemeral debug container.
- Not checking `kubectl get events` quickly enough — events are short-lived, and the evidence for an intermittent issue can be gone by the time you look.
- Forgetting `--previous` on `kubectl logs` after a crash and concluding there's nothing useful in the logs.
- Modifying a pod's spec (adding a debug sidecar, changing the image) just to get a shell, when an ephemeral debug container achieves the same result with zero change to the running workload.

## Interview Questions

- Walk through your debugging methodology for a pod stuck in `CrashLoopBackOff`, in order.
- How do ephemeral debug containers let you debug a distroless image that has no shell?
- Why might `kubectl get events` not show you something that happened 90 minutes ago?
- What's the difference between what `kubectl describe pod` tells you and what `kubectl logs` tells you?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Cluster Administration](../cluster-administration/index.md) to see how these same signals — status, events, logs, metrics — feed into operating the cluster as a whole.
