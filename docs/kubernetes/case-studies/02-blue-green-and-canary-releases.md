---
title: "Kubernetes Blue-Green and Canary Release Case Study"
icon: lucide/split
description: A worked blue-green cutover via Service selector swap and a weighted-Ingress canary release, each with a real rollback path.
tags:
  - Kubernetes
  - Case Studies
---

# Case Study: Blue-Green and Canary Releases

## Scenario

`payments-ui` is a customer-facing checkout frontend. The team has two upcoming releases with different risk profiles:

- **`v2.0`** is a full rewrite of the payment form. It needs to go from 0% to 100% traffic instantly if it's good, and back to 0% instantly if it's not — a gradual rolling update mixing old and new pods for a payment form isn't acceptable to the team.
- **`v2.1`**, a smaller change shipped later the same week, is lower-risk and the team wants to validate it against a small slice of real traffic before committing fully, rather than switching everyone at once.

Both need a plain `Deployment` + `Service` setup — no service mesh, no progressive-delivery controller installed yet.

## Requirements

- Blue-green: two full, independently running versions; traffic switches from one to the other as a single atomic operation; rollback is the same operation in reverse
- Canary: a small, controllable percentage of traffic reaches the new version while most traffic stays on the stable version; the split percentage must be adjustable without redeploying either version
- Both patterns must work with a standard NGINX Ingress Controller — no additional traffic-management infrastructure
- A documented rollback command for each pattern that a second engineer could run without asking questions

## Solution Walkthrough

### Part 1 — Blue-green via Service selector swap

Two full Deployments, distinguished only by a `version` label, and one Service whose `selector` decides which one is live:

```yaml title="payments-ui-blue.yaml"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments-ui-blue
  labels:
    app: payments-ui
    version: blue
spec:
  replicas: 4
  selector:
    matchLabels:
      app: payments-ui
      version: blue
  template:
    metadata:
      labels:
        app: payments-ui
        version: blue
    spec:
      containers:
        - name: payments-ui
          image: registry.example.com/payments-ui:1.9.4
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet: { path: /healthz, port: 8080 }
            periodSeconds: 5
```

```yaml title="payments-ui-green.yaml"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments-ui-green
  labels:
    app: payments-ui
    version: green
spec:
  replicas: 4
  selector:
    matchLabels:
      app: payments-ui
      version: green
  template:
    metadata:
      labels:
        app: payments-ui
        version: green
    spec:
      containers:
        - name: payments-ui
          image: registry.example.com/payments-ui:2.0.0
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet: { path: /healthz, port: 8080 }
            periodSeconds: 5
```

```yaml title="payments-ui-service.yaml"
apiVersion: v1
kind: Service
metadata:
  name: payments-ui
spec:
  selector:
    app: payments-ui
    version: blue # starts pointed at the current, known-good version
  ports:
    - port: 80
      targetPort: 8080
```

Deploy green alongside the already-running blue, and confirm it's healthy **before** it receives any real traffic (the Service selector still points at `blue`, so green is running but idle):

```bash
kubectl apply -f payments-ui-blue.yaml
kubectl apply -f payments-ui-service.yaml
kubectl apply -f payments-ui-green.yaml
kubectl rollout status deployment/payments-ui-green
```

Smoke-test green directly, bypassing the Service, before cutting over:

```bash
GREEN_POD=$(kubectl get pods -l version=green -o jsonpath='{.items[0].metadata.name}')
kubectl exec "$GREEN_POD" -- curl -sf http://localhost:8080/healthz
```

Cut all traffic over in one atomic step:

```bash
kubectl patch service payments-ui -p '{"spec":{"selector":{"version":"green"}}}'
kubectl get endpoints payments-ui
```

The Service's `Endpoints` list flips from the four blue pod IPs to the four green pod IPs immediately — every new connection to `payments-ui` reaches `v2.0.0` from that moment on, with no rolling window of mixed versions.

**Rollback** is the identical command, reversed:

```bash
kubectl patch service payments-ui -p '{"spec":{"selector":{"version":"blue"}}}'
```

Blue is deliberately left running (not deleted) for a full observation window after the cutover specifically so this rollback stays instant.

### Part 2 — Canary via weighted Ingress

For `v2.1`, the team wants 10% of traffic on the new version first. This uses two Deployments (stable + canary) behind **two separate Services**, and two Ingress resources where the canary Ingress carries NGINX's canary annotations:

```yaml title="payments-ui-stable.yaml"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments-ui-stable
  labels: { app: payments-ui, track: stable }
spec:
  replicas: 9
  selector:
    matchLabels: { app: payments-ui, track: stable }
  template:
    metadata:
      labels: { app: payments-ui, track: stable }
    spec:
      containers:
        - name: payments-ui
          image: registry.example.com/payments-ui:2.0.0
          ports: [{ containerPort: 8080 }]
---
apiVersion: v1
kind: Service
metadata:
  name: payments-ui-stable
spec:
  selector: { app: payments-ui, track: stable }
  ports: [{ port: 80, targetPort: 8080 }]
```

```yaml title="payments-ui-canary.yaml"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments-ui-canary
  labels: { app: payments-ui, track: canary }
spec:
  replicas: 1
  selector:
    matchLabels: { app: payments-ui, track: canary }
  template:
    metadata:
      labels: { app: payments-ui, track: canary }
    spec:
      containers:
        - name: payments-ui
          image: registry.example.com/payments-ui:2.1.0
          ports: [{ containerPort: 8080 }]
---
apiVersion: v1
kind: Service
metadata:
  name: payments-ui-canary
spec:
  selector: { app: payments-ui, track: canary }
  ports: [{ port: 80, targetPort: 8080 }]
```

```yaml title="payments-ui-ingress.yaml"
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: payments-ui
spec:
  ingressClassName: nginx
  rules:
    - host: payments.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: payments-ui-stable
                port:
                  number: 80
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: payments-ui-canary
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"
spec:
  ingressClassName: nginx
  rules:
    - host: payments.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: payments-ui-canary
                port:
                  number: 80
```

```bash
kubectl apply -f payments-ui-stable.yaml
kubectl apply -f payments-ui-canary.yaml
kubectl apply -f payments-ui-ingress.yaml
```

The two Ingress objects **must share the same `host`/`path`** — the canary annotation on the second one tells the NGINX controller to treat it as a weighted sibling of the first, not a separate route. `canary-weight: "10"` sends roughly 10% of matching requests to `payments-ui-canary`.

Ramp up gradually as confidence builds, by patching only the annotation — no redeploy of either version required:

```bash
kubectl annotate ingress payments-ui-canary nginx.ingress.kubernetes.io/canary-weight=50 --overwrite
kubectl annotate ingress payments-ui-canary nginx.ingress.kubernetes.io/canary-weight=100 --overwrite
```

Once at 100% and confidence is fully established, promote for real: point the main Ingress and `payments-ui-stable` at `2.1.0`, then delete the canary track.

## Verification

**Blue-green:** confirm the switch was atomic by checking `Endpoints` before and after — there should be no window where the list contains a mix of blue and green IPs:

```bash
kubectl get endpoints payments-ui -o jsonpath='{.subsets[*].addresses[*].ip}'
```

**Canary:** confirm the split is roughly proportional by sending a batch of requests through the Ingress and tallying which track responded (assuming each version stamps a distinguishing response header or body marker):

```bash
for i in $(seq 1 100); do
  curl -s -H "Host: payments.example.com" http://<ingress-ip>/ | grep -o 'version-2\.[01]\.0'
done | sort | uniq -c
```

At `canary-weight: 10`, expect roughly 90/10 — not exactly, since it's probabilistic per-request, not a strict round-robin.

## What Could Go Wrong

- **Deleting blue immediately after cutover** — this throws away the whole point of blue-green. Keep the previous version running through a full observation window (at minimum one full business cycle of traffic) so rollback stays a `kubectl patch`, not a redeploy.
- **Client-side or CDN caching bypassing the switch** — a blue-green Service-selector swap is instant at the cluster level, but a client that cached a connection or a CDN in front of the Ingress may keep serving stale responses. Check cache-control headers and connection-reuse behavior before trusting "instant" end-to-end.
- **Only one of the two canary Ingress objects gets applied, or their `host`/`path` don't match exactly** — the NGINX controller then treats them as unrelated Ingress rules instead of a weighted pair, and either all traffic hits stable (annotation ignored) or routing becomes ambiguous.
- **Session affinity assumptions** — without sticky sessions, a user's requests can bounce between stable and canary pod-to-pod on every request. For anything stateful in the request flow (a multi-step checkout, for instance), pair canary weighting with `nginx.ingress.kubernetes.io/affinity: cookie` or keep the canary scope to safely idempotent traffic only.
- **Treating replica count as the traffic split** — running canary at 1 replica and stable at 9 is not the same as a 10% traffic weight; without the `canary-weight` annotation, NGINX still round-robins evenly across whatever endpoints a Service resolves to. The weighting has to be declared explicitly.

## Next

See [Multi-Tenant Namespace Setup](03-multi-tenant-namespace-setup.md) for isolating a new team on a shared cluster, and [Progressive Delivery: Canary and Blue-Green](../cicd-and-gitops/03-progressive-delivery-canary-and-blue-green.md) for automating this same pattern with Argo Rollouts or Flagger instead of hand-run `kubectl` commands.
