---
title: "Fix Kubernetes Pod Pending, ImagePullBackOff, and CrashLoopBackOff"
icon: lucide/box
description: Diagnosing and fixing pods stuck Pending, ImagePullBackOff, CrashLoopBackOff, OOMKilled, and init containers that block startup.
tags:
  - Kubernetes
  - Troubleshooting
  - Pods
---

# Pod Scheduling and Startup Problems

Every failure on this page shows up the same way in `kubectl get pods` — a status column that isn't `Running` — but the fix lives at a completely different layer depending on which status it is. Read the status literally: it tells you which subsystem to look at first.

## Pod Stuck in `Pending`

```text
NAME                    READY   STATUS    RESTARTS   AGE
myapp-5d4b8c7f9-abc12   0/1     Pending   0          5m
```

`Pending` means the scheduler has not placed the pod on any node yet — nothing has started, so logs don't exist.

**Likely causes:**

1. No node has enough allocatable CPU/memory to satisfy the pod's `resources.requests`.
2. A `nodeSelector`, required node affinity, or a taint with no matching toleration excludes every node.
3. The pod references a PVC that isn't bound yet, which blocks scheduling until storage is available (see [Storage Problems](03-storage-problems.md)).

**Diagnosis:**

```bash
kubectl describe pod myapp-5d4b8c7f9-abc12   # read the Events section at the bottom
kubectl describe nodes | grep -A5 "Allocated resources"
kubectl get nodes --show-labels
kubectl get pod myapp-5d4b8c7f9-abc12 -o jsonpath='{.spec.tolerations}{"\n"}{.spec.nodeSelector}'
```

The `Events` section of `describe pod` states the reason in plain language: `0/6 nodes are available: 3 Insufficient cpu, 3 node(s) had untolerated taint`.

**Fix:**

```bash
# Insufficient resources: lower requests, or add capacity
kubectl set resources deployment myapp --requests=cpu=250m,memory=256Mi

# Taint/toleration mismatch: add the matching toleration
kubectl patch deployment myapp --type=json -p '[{
  "op": "add", "path": "/spec/template/spec/tolerations",
  "value": [{"key": "dedicated", "operator": "Equal", "value": "gpu", "effect": "NoSchedule"}]
}]'

# Node selector mismatch: label the intended nodes
kubectl label nodes node1 disktype=ssd
```

**Prevention:** set requests from measured usage rather than guesses, and treat a new `nodeSelector`/affinity rule as a change that needs a matching node pool, not an assumption.

## `ImagePullBackOff` / `ErrImagePull`

```text
NAME                    READY   STATUS             RESTARTS   AGE
myapp-5d4b8c7f9-abc12   0/1     ImagePullBackOff   0          2m
```

**Likely causes:**

1. The image name or tag doesn't exist in the registry (typo, or the tag was never pushed).
2. The registry requires authentication and no `imagePullSecrets` is attached to the pod's service account.
3. The node can't reach the registry at all (network policy, proxy, or DNS on the node).

**Diagnosis:**

```bash
kubectl describe pod myapp-5d4b8c7f9-abc12 | grep -A5 Events
kubectl get pod myapp-5d4b8c7f9-abc12 -o jsonpath='{.spec.containers[*].image}{"\n"}'
```

Read the exact error: `manifest unknown` is a bad tag; `unauthorized` or `pull access denied` is missing credentials; a timeout is a network path problem, not a Kubernetes problem.

**Fix:**

```bash
# Wrong tag — point at one that exists
kubectl set image deployment/myapp myapp=myapp:1.4.2

# Missing registry credentials
kubectl create secret docker-registry regcred \
  --docker-server=registry.example.com \
  --docker-username=deploy \
  --docker-password="$REGISTRY_TOKEN" \
  --docker-email=deploy@example.com

kubectl patch serviceaccount default -p '{"imagePullSecrets": [{"name": "regcred"}]}'
```

**Prevention:** pin exact tags (never `:latest`, which makes "which version am I even running" unanswerable), and attach registry credentials to the namespace's default service account so every deployment inherits them.

## `CrashLoopBackOff`

```text
NAME                    READY   STATUS             RESTARTS   AGE
myapp-5d4b8c7f9-abc12   0/1     CrashLoopBackOff   5          10m
```

The container starts, exits, and Kubernetes is backing off between restarts — this is an application-layer or probe-layer failure, not a scheduling one.

**Likely causes:**

1. The process itself exits on start (bad config, missing environment variable, unhandled startup error).
2. A `livenessProbe` fires before the app is actually ready and Kubernetes kills a container that would otherwise have come up fine.
3. The container's entrypoint requires a permission the pod's security context doesn't grant.

**Diagnosis:**

```bash
kubectl logs myapp-5d4b8c7f9-abc12              # current attempt
kubectl logs myapp-5d4b8c7f9-abc12 --previous   # the crash that triggered the loop
kubectl describe pod myapp-5d4b8c7f9-abc12 | grep -A3 "Last State"
```

`Last State: Terminated, Reason: Error, Exit Code: 1` points at the application; `Exit Code: 137` is a kill (usually OOM or a probe failure), not the app choosing to exit.

**Fix:**

```yaml
# Give the app realistically more time before the liveness probe can kill it
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
  failureThreshold: 3
startupProbe:               # covers slow-starting apps without weakening the liveness check
  httpGet:
    path: /healthz
    port: 8080
  failureThreshold: 30
  periodSeconds: 5
```

**Prevention:** add a `startupProbe` for anything with a variable startup time instead of inflating `initialDelaySeconds` on the liveness probe, and validate config/secrets exist with `kubectl get configmap`/`kubectl get secret` before assuming the app is at fault.

## `OOMKilled`

```text
NAME                    READY   STATUS      RESTARTS   AGE
myapp-5d4b8c7f9-abc12   0/1     OOMKilled   3          5m
```

**Likely causes:**

1. `resources.limits.memory` is set below what the process actually needs under real load.
2. A genuine memory leak grows usage past the limit over time rather than at startup.

**Diagnosis:**

```bash
kubectl top pod myapp-5d4b8c7f9-abc12
kubectl describe pod myapp-5d4b8c7f9-abc12 | grep -A5 "Last State"   # Reason: OOMKilled, Exit Code: 137
```

A container OOMKilled within seconds of starting is almost always a limit set too low; one that runs for hours before OOMKilling is more likely a leak.

**Fix:**

```yaml
resources:
  requests:
    memory: "512Mi"
  limits:
    memory: "1Gi"    # raised from 512Mi based on observed kubectl top usage
```

**Prevention:** set limits from `kubectl top` data collected under real traffic, not a round number picked in advance, and alert on memory approaching the limit rather than waiting for the kill.

## Init Container Failures Blocking the Main Container

Init containers run to completion, in order, before any app container starts — a failing or hanging init container means the pod never progresses past `Init:0/1` or similar, and the main container's logs won't exist yet because it hasn't started.

**Likely causes:**

1. The init container's own command fails (its logs are the actual clue, not the main container's).
2. It's waiting on a dependency (database, another service) that isn't ready and has no timeout.

**Diagnosis:**

```bash
kubectl get pod myapp-5d4b8c7f9-abc12          # STATUS: Init:0/1 or Init:CrashLoopBackOff
kubectl logs myapp-5d4b8c7f9-abc12 -c <init-container-name>
kubectl describe pod myapp-5d4b8c7f9-abc12 | grep -A10 "Init Containers"
```

**Fix:** correct the init container's command/image, or add a bounded retry/timeout so a genuinely unavailable dependency fails loudly instead of hanging the pod forever.

**Prevention:** keep init containers minimal (one job each — wait-for-dependency, or one-time setup) so a failure is easy to attribute to a specific step.

## Quick Reference

| Symptom | Layer | Fix starting point |
|---|---|---|
| `Pending` | Scheduler | `kubectl describe pod`, check requests vs. node capacity, taints/tolerations |
| `ImagePullBackOff` | Registry/image | Verify tag exists, check `imagePullSecrets` |
| `CrashLoopBackOff` | Application/probes | `kubectl logs --previous`, tune `livenessProbe`/add `startupProbe` |
| `OOMKilled` | Memory limit | `kubectl top pod`, raise `limits.memory` or fix the leak |
| `Init:CrashLoopBackOff` | Init container | `kubectl logs -c <init-container>` |

## Interview Questions

- Walk through your exact diagnostic sequence for a pod stuck in `Pending`.
- What's the practical difference between exit code `1` and exit code `137` when a pod is `CrashLoopBackOff`ing?
- Why does adding a `startupProbe` often fix a `CrashLoopBackOff` that inflating `initialDelaySeconds` doesn't fully solve?

## Next

Continue to [Networking and Service Problems](02-networking-and-service-problems.md).
