---
title: "Kubernetes CrashLoopBackOff Incident Debugging Case Study"
icon: lucide/bug
description: A realistic CrashLoopBackOff incident walked through describe, logs --previous, and events to find a renamed ConfigMap key hiding behind a red-herring OOMKill.
tags:
  - Kubernetes
  - Case Studies
---

# Case Study: Debugging a CrashLoopBackOff Incident

## Scenario

At 14:02, a routine deploy of `order-service:1.4.0` goes out through the normal pipeline. By 14:05, the on-call engineer gets paged: error rate on `order-service` has spiked, and `kubectl get pods` shows most replicas in `CrashLoopBackOff`. The previous version, `1.3.2`, is still running fine on the pods that haven't been replaced yet. There's no obvious signal in the deploy pipeline itself — it reported success because the pods it created did technically start.

## Requirements

- Identify the actual root cause using only `kubectl` — no re-deploying blind and hoping, no guessing from the changelog
- Distinguish between the real cause and any misleading secondary signals along the way
- Fix it with the smallest possible change, and confirm the fix before considering the incident resolved
- Come out the other side with a concrete change that would have caught this before it reached production

## Solution Walkthrough

### Step 1: Confirm the blast radius

```bash
kubectl get pods -l app=order-service
```

```text
NAME                             READY   STATUS             RESTARTS   AGE
order-service-7d9f8c6b5d-2kx9p   0/1     CrashLoopBackOff   6          4m12s
order-service-7d9f8c6b5d-8mz3q   0/1     CrashLoopBackOff   6          4m10s
order-service-7d9f8c6b5d-vq7lh   0/1     CrashLoopBackOff   5          3m58s
order-service-5b6c9d7f4-nk2wp    1/1     Running            0          3h20m
```

All three new-ReplicaSet pods (`7d9f8c6b5d`) are crash-looping; the one old pod (`5b6c9d7f4`) still on `1.3.2` is fine, waiting on `maxUnavailable` to let it go. This confirms it's the new release, not infrastructure or a coincidence — every pod running `1.4.0` fails the same way.

### Step 2: `describe pod` — the first real evidence

```bash
kubectl describe pod order-service-7d9f8c6b5d-2kx9p
```

```text
...
Containers:
  order-service:
    Image:          registry.example.com/order-service:1.4.0
    State:          Waiting
      Reason:       CrashLoopBackOff
    Last State:     Terminated
      Reason:       OOMKilled
      Exit Code:    137
      Started:      Wed, 24 Aug 2026 14:03:41 +0000
      Finished:     Wed, 24 Aug 2026 14:03:42 +0000
    Ready:          False
    Restart Count:  6
    Limits:
      cpu:     500m
      memory:  256Mi
    Requests:
      cpu:     250m
      memory:  128Mi
Events:
  Type     Reason     Age                From     Message
  ----     ------     ----               ----     -------
  Normal   Pulled     4m (x6 over 4m12s) kubelet  Successfully pulled image "registry.example.com/order-service:1.4.0"
  Normal   Created    4m (x6 over 4m12s) kubelet  Created container order-service
  Normal   Started    4m (x6 over 4m12s) kubelet  Started container order-service
  Warning  BackOff    2m (x14 over 3m50s) kubelet Back-off restarting failed container
```

`Last State: Terminated, Reason: OOMKilled` looks like an open-and-shut case — the obvious read is "1.4.0 uses more memory and needs a higher limit." **This is the red herring.** The container dies in under a second every time (`Started` and `Finished` a second apart), which is fast even for a genuine memory leak — real gradual memory growth usually takes longer than one second to hit a limit on a freshly started process. That timing detail is worth noting before accepting the OOMKill explanation at face value.

### Step 3: `logs --previous` — what actually happened before the kill

```bash
kubectl logs order-service-7d9f8c6b5d-2kx9p --previous
```

```text
2026-08-24T14:03:41.812Z INFO  Starting order-service v1.4.0
2026-08-24T14:03:41.834Z INFO  Loading configuration from environment
2026-08-24T14:03:41.836Z FATAL Required config key PAYMENT_GATEWAY_URL is not set (found PAYMENT_GATEWAY_ENDPOINT)
panic: fatal configuration error: PAYMENT_GATEWAY_URL is not set

goroutine 1 [running]:
main.loadConfig(...)
        /app/config.go:47 +0x1c5
main.main()
        /app/main.go:22 +0x89
```

This is the actual root cause: `1.4.0` renamed the expected environment variable from `PAYMENT_GATEWAY_ENDPOINT` to `PAYMENT_GATEWAY_URL`, but the ConfigMap backing it wasn't updated to match, so the new binary panics immediately on startup with a fatal config error — not a memory problem at all. A Go panic that unwinds the whole process and exits can, depending on the runtime and container memory accounting, get attributed by the kubelet as an OOM kill if the crash coincides with a brief memory spike during panic unwinding — which is exactly what produced the misleading `OOMKilled` reason in step 2 on this cluster.

### Step 4: Confirm against the actual ConfigMap

```bash
kubectl get configmap order-service-config -o yaml
```

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: order-service-config
data:
  PAYMENT_GATEWAY_ENDPOINT: "https://payments.internal.example.com"
  LOG_LEVEL: "info"
```

Confirmed: the ConfigMap still has the old key name. The deploy shipped an application change and a required config change as two separate, uncoordinated artifacts — the image got the new key name, the ConfigMap didn't.

### Step 5: Fix and roll out

```bash
kubectl patch configmap order-service-config --type merge -p \
  '{"data":{"PAYMENT_GATEWAY_URL":"https://payments.internal.example.com"}}'
```

The old key is deliberately left in place rather than removed in the same patch, in case anything else still references it — cleaning it up is a separate, lower-urgency follow-up once the incident itself is resolved.

ConfigMap changes don't automatically restart pods that consume them as env vars (the same behavior covered in [Secrets Rotation](05-secrets-rotation.md)), so the crash-looping pods need an explicit restart to pick up the new key:

```bash
kubectl rollout restart deployment/order-service
kubectl rollout status deployment/order-service
```

```text
Waiting for deployment "order-service" rollout to finish: 1 old replicas are pending termination...
deployment "order-service" successfully rolled out
```

## Verification

```bash
kubectl get pods -l app=order-service
```

```text
NAME                             READY   STATUS    RESTARTS   AGE
order-service-7d9f8c6b5d-4h8kd   1/1     Running   0          45s
order-service-7d9f8c6b5d-9nzp2   1/1     Running   0          40s
order-service-7d9f8c6b5d-fx3lw   1/1     Running   0          38s
```

`RESTARTS: 0` and `READY: 1/1` across all pods confirms they're staying up, not just briefly passing a check before crashing again. Tail the logs to confirm no more fatal config panics, and specifically watch for a few minutes rather than declaring victory the instant pods go `Running` — a `CrashLoopBackOff` pod does show `Running` briefly during every restart attempt:

```bash
kubectl logs -f deployment/order-service | grep -i "FATAL\|panic"
```

No output after several minutes, alongside a stable restart count, is what actually closes the incident.

## What Could Go Wrong

- **Trusting the `OOMKilled` reason without reading `logs --previous`** — this incident's biggest trap. Bumping the memory limit in response to the reported OOMKill would not have fixed anything; the container would keep panicking on startup regardless of how much memory it's allowed, just with an even more confusing exit signature next time.
- **`kubectl logs` without `--previous` on a crash-looping pod** — the plain `kubectl logs` command shows the *current* container attempt, which for a pod that's already back in its backoff-wait state may show nothing at all, or only a fragment. `--previous` is what shows the fatal error from the container instance that actually just crashed.
- **Deploying an application change and its required config change as separate, uncoordinated steps** — the actual root cause here. A safer pattern is to have the application accept both the old and new key names for one release (with a deprecation warning on the old one), decoupling the code rollout from the config rollout by a full release cycle.
- **Restarting the Deployment before actually fixing the ConfigMap** — this "fixes" the immediate symptom of stale pods for about as long as it takes the new pods to hit the same fatal panic again, and burns time that should have gone into finding the real cause.
- **Not checking whether the previous ReplicaSet was still around for instant rollback** — in this incident, fixing the ConfigMap and restarting was faster and safer than rolling back, since the ConfigMap fix also unblocks `1.4.0`'s actual intended change. But when the root cause is inside the application code itself rather than an environment mismatch, `kubectl rollout undo deployment/order-service` back to `1.3.2` is almost always the faster way to stop the bleeding while the real fix is developed properly.

## Next

Return to [Case Studies](index.md) for the full set, or continue to [Troubleshooting](../troubleshooting/index.md) for a broader diagnostic playbook beyond this one incident.
