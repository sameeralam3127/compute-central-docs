---
title: "Kubernetes Zero-Downtime Rolling Deployment Case Study"
icon: lucide/refresh-cw
description: A worked zero-downtime rolling deployment with tuned readiness probes and maxSurge/maxUnavailable, verified with a live request-loss counter.
tags:
  - Kubernetes
  - Case Studies
---

# Case Study: Rolling Deployment with Zero Downtime

## Scenario

`checkout-api` is a stateless HTTP service running behind a `ClusterIP` Service, currently at `1.13.0` with 6 replicas. A new release, `1.14.0`, is ready to ship. The team has been burned before: a previous release dropped roughly 2% of requests for about 30 seconds during rollout, traced afterward to pods getting traffic before their process had actually finished booting. This time, the deploy needs to go out with a way to *prove* zero requests were dropped, not just assume it.

## Requirements

- 6 replicas serving traffic at all times during the rollout — capacity must never drop below what's currently running
- The new version must not receive real traffic until it can actually serve a request correctly, not just until its process starts
- A concrete, observable measurement of dropped requests during the rollout, not just "the rollout finished"
- A safe, immediate rollback path if the new version turns out to be bad after it's fully rolled out

## Solution Walkthrough

### The Deployment

```yaml title="checkout-api-deployment.yaml"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout-api
  labels:
    app: checkout-api
spec:
  replicas: 6
  revisionHistoryLimit: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2 # up to 8 pods running briefly
      maxUnavailable: 0 # never drop below 6 Ready pods
  minReadySeconds: 10 # a pod must stay Ready this long before it counts as "up"
  selector:
    matchLabels:
      app: checkout-api
  template:
    metadata:
      labels:
        app: checkout-api
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: checkout-api
          image: registry.example.com/checkout-api:1.14.0
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz/ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 3
            failureThreshold: 2
          livenessProbe:
            httpGet:
              path: /healthz/live
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 10
          lifecycle:
            preStop:
              exec:
                command: ["sleep", "5"]
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
```

Three settings do the actual work here:

- **`maxUnavailable: 0`** — the rollout can never remove a Ready pod until a replacement is Ready. Capacity never dips below 6.
- **`readinessProbe` hitting `/healthz/ready`** — this endpoint only returns `200` once the app has finished its startup sequence (config loaded, DB pool warmed, caches primed). A liveness-only setup would let the Service send traffic to a pod that's technically running but not actually ready to answer requests correctly.
- **`preStop` sleep + `terminationGracePeriodSeconds: 30`** — when a pod is being scaled down, Kubernetes removes it from the Service's endpoints *and* sends `SIGTERM` at the same time, not endpoints-first-then-signal. The `preStop` sleep buys time for that endpoint removal to actually propagate through kube-proxy before the process stops accepting connections, which is what prevents in-flight requests from being routed to a pod that's already shutting down.

### The Service and PodDisruptionBudget

```yaml title="checkout-api-service.yaml"
apiVersion: v1
kind: Service
metadata:
  name: checkout-api
spec:
  selector:
    app: checkout-api
  ports:
    - port: 80
      targetPort: 8080
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: checkout-api
spec:
  minAvailable: 5
  selector:
    matchLabels:
      app: checkout-api
```

The `PodDisruptionBudget` isn't for this rollout specifically — `kubectl rollout` respects `maxUnavailable` on its own — but it protects the same "never below N healthy pods" guarantee against *voluntary* disruptions that aren't rollouts, like a node drain during a cluster upgrade happening at the same time.

### Watching the rollout while measuring drops

Apply the current (`1.13.0`) version first so there's a real baseline running, then start a continuous request loop against the Service from inside the cluster **before** triggering the update:

```bash
kubectl apply -f checkout-api-service.yaml
kubectl apply -f checkout-api-deployment.yaml   # deploys 1.13.0 first, in a separate run
kubectl rollout status deployment/checkout-api
```

```bash
kubectl run load-check --rm -it --restart=Never --image=curlimages/curl:8.9.1 -- sh -c '
i=0; fail=0
while [ $i -lt 300 ]; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://checkout-api/healthz/ready)
  if [ "$code" != "200" ]; then
    fail=$((fail+1))
    echo "REQUEST $i FAILED: HTTP $code"
  fi
  i=$((i+1))
  sleep 0.1
done
echo "Total failures: $fail / $i"
'
```

While that loop is running (about 30 seconds at 10 requests/sec), trigger the rollout to `1.14.0` from another terminal:

```bash
kubectl set image deployment/checkout-api checkout-api=registry.example.com/checkout-api:1.14.0
kubectl rollout status deployment/checkout-api
```

```text
Waiting for deployment "checkout-api" rollout to finish: 2 out of 6 new replicas have been updated...
Waiting for deployment "checkout-api" rollout to finish: 4 out of 6 updated replicas are available...
deployment "checkout-api" successfully rolled out
```

## Verification

The load-check loop's final line is the actual proof, not the rollout output:

```text
Total failures: 0 / 300
```

Zero failed requests out of 300 sent across the full duration of the rollout confirms the combination of `maxUnavailable: 0`, a real readiness check, and the `preStop` grace period actually worked — not just that `kubectl rollout status` reported success, which only means pods reached `Ready`, not that users experienced zero errors.

Also confirm the new version is actually what's serving traffic, and that the old ReplicaSet is scaled to zero but still present for rollback:

```bash
kubectl get pods -l app=checkout-api -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].image}{"\n"}{end}'
kubectl rollout history deployment/checkout-api
```

## What Could Go Wrong

- **`maxUnavailable: 0` and `maxSurge: 0` together** — the rollout can never make progress and hangs indefinitely waiting for capacity it's not allowed to create. Always give it surge room if unavailability is zero.
- **A readiness probe that always returns `200`** — this was the original bug. If `/healthz/ready` doesn't check real dependencies (DB connection, cache warm-up), the rollout proceeds at full speed with no actual signal, and broken pods start taking traffic immediately.
- **No `preStop` delay** — without it, `SIGTERM` and endpoint removal race each other. Under load, a small percentage of requests land on a pod that's already stopped accepting connections — exactly the 2% loss this team saw before.
- **Rolling back with `kubectl delete` instead of `rollout undo`** — `kubectl rollout undo deployment/checkout-api` reuses the previous ReplicaSet and goes through the same `RollingUpdate` safety guarantees. Deleting and reapplying an old manifest by hand skips that and can cause the exact capacity dip this whole setup was built to avoid.
- **Trusting `rollout status` alone in CI** — it only confirms pods reached `Ready` per the probe. Pair it with a real synthetic check (like the load-check loop above, or a proper smoke test) before promoting past a lower environment.

## Next

See [Blue-Green and Canary Releases](02-blue-green-and-canary-releases.md) for two more release strategies with instant rollback, and [Deployment Strategies](../workloads-and-scheduling/01-deployment-strategies.md) for the underlying theory of `maxSurge`/`maxUnavailable`.
