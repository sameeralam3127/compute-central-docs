---
title: "Kubernetes Autoscaling Under Load Case Study"
icon: lucide/trending-up
description: Setting up HPA against CPU and a custom requests-per-second metric for a real traffic spike, then tuning stabilization windows to stop flapping.
tags:
  - Kubernetes
  - Case Studies
---

# Case Study: Autoscaling Under Load

## Scenario

`checkout-api` runs at a steady 6 replicas most of the day. A flash-sale event is scheduled, and historically these events produce a traffic spike of roughly 8-10x baseline within about two minutes, then a slower decay back to normal over the following hour. The team wants the Deployment to scale out fast enough to absorb the spike, scale back in once it's over, and — based on a bad experience during the last sale, where replica count oscillated between 8 and 20 for ten minutes straight — do it without flapping.

## Requirements

- Scale on CPU utilization, since it's currently the most reliable signal for this service
- Also scale on a custom metric — requests-per-second per pod — since CPU alone lagged behind the actual spike by nearly a minute last time
- Scale out fast when load actually increases
- Scale in conservatively, so a brief dip in traffic doesn't trigger a scale-down that then has to reverse itself seconds later
- Every pod must have resource requests set, since HPA's CPU-utilization percentage is computed relative to the request, not the limit

## Solution Walkthrough

### 1. Prerequisites: metrics-server and a custom metrics pipeline

CPU-based HPA needs `metrics-server`. The custom `requests-per-second` metric needs Prometheus plus the Prometheus Adapter, which translates PromQL queries into the `custom.metrics.k8s.io` API the HPA controller can read.

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/download/v0.7.2/components.yaml
kubectl get deployment metrics-server -n kube-system
```

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install prometheus prometheus-community/kube-prometheus-stack \
  --version 62.7.0 --namespace monitoring --create-namespace

helm install prometheus-adapter prometheus-community/prometheus-adapter \
  --version 4.11.0 --namespace monitoring \
  --set prometheus.url=http://prometheus-kube-prometheus-prometheus.monitoring.svc \
  --set prometheus.port=9090
```

```yaml title="prometheus-adapter-rules.yaml"
apiVersion: v1
kind: ConfigMap
metadata:
  name: adapter-config
  namespace: monitoring
data:
  config.yaml: |
    rules:
      - seriesQuery: 'http_requests_total{namespace!="",pod!=""}'
        resources:
          overrides:
            namespace: { resource: "namespace" }
            pod: { resource: "pod" }
        name:
          matches: "http_requests_total"
          as: "http_requests_per_second"
        metricsQuery: 'sum(rate(<<.Series>>{<<.LabelMatchers>>}[2m])) by (<<.GroupBy>>)'
```

```bash
kubectl apply -f prometheus-adapter-rules.yaml
kubectl rollout restart deployment/prometheus-adapter -n monitoring
```

Confirm the custom metric is actually being served before wiring the HPA to it — this is the step people skip, and then spend an hour debugging an HPA that just says `<unknown>`:

```bash
kubectl get --raw "/apis/custom.metrics.k8s.io/v1beta1/namespaces/default/pods/*/http_requests_per_second" | jq .
```

### 2. The Deployment (resource requests are mandatory)

```yaml title="checkout-api-deployment.yaml"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout-api
spec:
  replicas: 6
  selector:
    matchLabels: { app: checkout-api }
  template:
    metadata:
      labels: { app: checkout-api }
    spec:
      containers:
        - name: checkout-api
          image: registry.example.com/checkout-api:1.14.0
          ports: [{ containerPort: 8080, name: http }]
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
```

### 3. The HPA: two metrics, tuned behavior

```yaml title="checkout-api-hpa.yaml"
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: checkout-api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: checkout-api
  minReplicas: 6
  maxReplicas: 40
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 65
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "50"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0 # react immediately to a real spike
      policies:
        - type: Percent
          value: 100 # allowed to double replica count per period
          periodSeconds: 30
        - type: Pods
          value: 6 # or add up to 6 pods per period, whichever is more
          periodSeconds: 30
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: 300 # wait 5 min of sustained lower load before shrinking
      policies:
        - type: Percent
          value: 25 # remove at most 25% of current replicas per period
          periodSeconds: 60
      selectPolicy: Min
```

The HPA scales on whichever of the two metrics demands more replicas — with two `metrics` entries, that's how `autoscaling/v2` behaves by default, no extra config needed. `averageValue: "50"` means: keep each pod at roughly 50 requests/sec on average, add pods once the fleet average exceeds that.

```bash
kubectl apply -f checkout-api-deployment.yaml
kubectl apply -f checkout-api-hpa.yaml
```

### 4. Generating the spike and watching it scale

```bash
kubectl run load-gen --rm -it --image=williamyeh/hey:latest --restart=Never -- \
  -z 3m -c 200 -q 50 http://checkout-api.default.svc.cluster.local/
```

In a second terminal, watch the HPA and pod count react in real time:

```bash
kubectl get hpa checkout-api -w
```

```text
NAME           REFERENCE                 TARGETS                        MINPODS   MAXPODS   REPLICAS   AGE
checkout-api   Deployment/checkout-api   45%/65%, 38/50                 6         40        6          10m
checkout-api   Deployment/checkout-api   88%/65%, 96/50                 6         40        6          10m30s
checkout-api   Deployment/checkout-api   91%/65%, 110/50                6         40        12         11m
checkout-api   Deployment/checkout-api   79%/65%, 61/50                 6         40        18         12m
checkout-api   Deployment/checkout-api   58%/65%, 44/50                 6         40        18         13m
```

## Verification

**Scale-out kept pace with the spike.** `kubectl describe hpa checkout-api` shows the actual scaling events in its `Events` section — confirm the first scale-up event landed within roughly 30-60 seconds of load starting, matching `scaleUp.stabilizationWindowSeconds: 0`.

**Scale-in was conservative, not flappy.** After the load generator finishes, watch the HPA continue:

```bash
kubectl get hpa checkout-api -w
```

Replica count should hold steady for close to 5 minutes (the `scaleDown.stabilizationWindowSeconds: 300` window) before decreasing, and decrease gradually — at most 25% of current replicas per minute — rather than dropping straight from 18 back to 6.

```bash
kubectl describe hpa checkout-api | grep -A5 Events
```

```text
Normal  SuccessfulRescale  5m   horizontal-pod-autoscaler  New size: 18; reason: pods metric http_requests_per_second above target
Normal  SuccessfulRescale  4m   horizontal-pod-autoscaler  New size: 14; reason: All metrics below target
Normal  SuccessfulRescale  2m   horizontal-pod-autoscaler  New size: 10; reason: All metrics below target
```

No back-and-forth between two replica counts in this log is the actual sign the stabilization window fixed the original flapping problem.

## What Could Go Wrong

- **No resource requests on the container** — `averageUtilization: 65` has nothing to divide by without a CPU request. The HPA controller reports the metric as `<unknown>` and never scales on CPU at all, silently.
- **Custom metrics pipeline not actually wired up** — if Prometheus Adapter isn't running or its rule doesn't match real series names, `kubectl get hpa` shows `<unknown>/50` for the custom metric indefinitely. Always verify with the raw API call in step 1 before trusting the HPA to use it.
- **`stabilizationWindowSeconds: 0` on scale-down instead of scale-up** — this is the exact mistake that caused the original flapping: with no scale-down delay, a single brief dip below target triggers an immediate scale-in, which then immediately re-triggers scale-out once load ticks back up, repeating every few seconds.
- **`minReplicas` set too low for the metric's noise floor** — if a metric is naturally noisy near the target value, a `minReplicas` too close to the steady-state replica count gives the HPA no headroom to smooth over normal jitter without oscillating.
- **Assuming HPA scaling is instant** — the controller only re-evaluates metrics every 15 seconds by default (`--horizontal-pod-autoscaler-sync-period`), and newly created pods need to pass their readiness probe before they count as available capacity. For a spike faster than ~1-2 minutes, HPA alone won't be fast enough — that needs pre-provisioned headroom or a predictive/scheduled scaling approach layered on top.

## Next

See [Secrets Rotation](05-secrets-rotation.md) for keeping this same service's database credential current without downtime, and [Autoscaling](../workloads-and-scheduling/06-autoscaling.md) for how HPA, VPA, and Cluster Autoscaler interact when more than one is active at once.
