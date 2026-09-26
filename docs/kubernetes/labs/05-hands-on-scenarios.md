---
title: "Kubernetes Hands-On Practice Scenarios"
icon: lucide/dumbbell
description: "Kubernetes practice exercises — a multi-tier app, CI/CD pipeline, Prometheus monitoring, blue-green release, and debugging a Service and a CrashLoopBackOff."
tags:
  - Kubernetes
  - Labs
---

# Hands-On Scenarios

Six longer exercises, each self-contained with a goal, exact steps, and a way to confirm you actually got it right. Run them on any cluster from the previous labs — [kind](02-kind-lab.md) is recommended for Scenario 1 onward since several use more than one workload type at once.

```bash
kubectl create namespace scenarios
kubectl config set-context --current --namespace=scenarios
```

## Scenario 1: Deploy a Multi-Tier Application

### Goal

Run a three-tier app — frontend, backend API, and a StatefulSet database — with persistent storage, ConfigMaps, and Secrets, and prove the tiers can actually reach each other.

### Steps

**Database (PostgreSQL, StatefulSet + headless Service):**

```yaml title="postgres.yaml"
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-config
data:
  POSTGRES_DB: myapp
  POSTGRES_USER: appuser
---
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secret
type: Opaque
stringData:
  POSTGRES_PASSWORD: "change-me-in-real-use"
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16.4
          ports:
            - containerPort: 5432
          env:
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata   # subdirectory, so lost+found on the volume doesn't break initdb
          envFrom:
            - configMapRef:
                name: postgres-config
            - secretRef:
                name: postgres-secret
          volumeMounts:
            - name: postgres-storage
              mountPath: /var/lib/postgresql/data
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
  volumeClaimTemplates:
    - metadata:
        name: postgres-storage
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 2Gi
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
spec:
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
  clusterIP: None # headless — StatefulSet pods get stable DNS names
```

**Backend (Deployment, reads Secret + ConfigMap):**

```yaml title="backend.yaml"
apiVersion: v1
kind: ConfigMap
metadata:
  name: backend-config
data:
  DATABASE_HOST: postgres
  DATABASE_PORT: "5432"
  DATABASE_NAME: myapp
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: curlimages/curl:8.9.1
          command: ["sleep", "infinity"]
          envFrom:
            - configMapRef:
                name: backend-config
          env:
            - name: DATABASE_USER
              valueFrom:
                configMapKeyRef:
                  name: postgres-config
                  key: POSTGRES_USER
            - name: DATABASE_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: POSTGRES_PASSWORD
          resources:
            requests:
              memory: "64Mi"
              cpu: "100m"
            limits:
              memory: "128Mi"
              cpu: "200m"
---
apiVersion: v1
kind: Service
metadata:
  name: backend
spec:
  selector:
    app: backend
  ports:
    - name: http          # ServiceMonitors (Scenario 3) select ports by name
      port: 80
      targetPort: 80
```

!!! note "Why `curlimages/curl` here"
    The real exercise is the wiring — ConfigMaps, Secrets, Service DNS, and pod-to-pod reachability — not building a backend from scratch. `curlimages/curl` with `sleep infinity` gives you a real pod you can `exec` into to test connectivity without needing your own application image.

Apply everything:

```bash
kubectl apply -f postgres.yaml
kubectl apply -f backend.yaml
kubectl rollout status statefulset/postgres
kubectl rollout status deployment/backend
```

### Verify

```bash
kubectl get all
kubectl get pvc
```

Confirm the backend can resolve and reach Postgres by its stable Service DNS name, and that the injected Secret value is actually present:

```bash
kubectl exec deploy/backend -- env | grep DATABASE_PASSWORD
kubectl exec deploy/backend -- getent hosts postgres
```

You should see the headless Service resolve to the StatefulSet pod's IP (`postgres-0.postgres.scenarios.svc.cluster.local`), and the `DATABASE_PASSWORD` env var populated from the Secret.

---

## Scenario 2: Build a CI/CD Pipeline That Deploys to Kubernetes

### Goal

Understand the shape of a real pipeline — build, test, scan, push, deploy, verify — by walking through a working Jenkinsfile targeting this cluster, without needing a real Jenkins install for the exercise.

### Steps

Read the pipeline stage by stage; this is the reference shape you'll adapt for real CI in [CI/CD Pipelines for Kubernetes](../cicd-and-gitops/01-cicd-pipelines-for-kubernetes.md).

```groovy title="Jenkinsfile"
pipeline {
    agent {
        kubernetes {
            yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: kubectl
    image: registry.example.com/platform/kubectl:1.37   # a pinned internal image with a shell + kubectl; bitnami/kubectl is no longer updated
    command: ["cat"]
    tty: true
"""
        }
    }

    environment {
        IMAGE_NAME = 'myorg/myapp'
        GIT_COMMIT_SHORT = sh(script: "git rev-parse --short HEAD", returnStdout: true).trim()
        IMAGE_TAG = "${BUILD_NUMBER}-${GIT_COMMIT_SHORT}"
    }

    stages {
        stage('Build & Push') {
            steps {
                sh "docker build -t ${IMAGE_NAME}:${IMAGE_TAG} ."
                sh "docker push ${IMAGE_NAME}:${IMAGE_TAG}"
            }
        }
        stage('Security Scan') {
            steps {
                sh "docker run --rm aquasec/trivy:0.55.0 image ${IMAGE_NAME}:${IMAGE_TAG}"
            }
        }
        stage('Deploy to Dev') {
            steps {
                container('kubectl') {
                    sh """
                        kubectl set image deployment/myapp myapp=${IMAGE_NAME}:${IMAGE_TAG} -n dev
                        kubectl rollout status deployment/myapp -n dev --timeout=5m
                    """
                }
            }
        }
        stage('Approval for Production') {
            when { branch 'main' }
            steps {
                input message: 'Deploy to Production?', ok: 'Deploy'
            }
        }
        stage('Deploy to Production') {
            when { branch 'main' }
            steps {
                container('kubectl') {
                    sh """
                        kubectl set image deployment/myapp myapp=${IMAGE_NAME}:${IMAGE_TAG} -n production
                        kubectl rollout status deployment/myapp -n production --timeout=10m
                    """
                }
            }
        }
    }
}
```

Now reproduce the two deploy stages by hand against your `scenarios` namespace so you feel what the pipeline is actually doing at each step:

```bash
kubectl create deployment myapp --image=nginx:1.27 -n scenarios
kubectl set image deployment/myapp myapp=nginx:1.27.1 -n scenarios
kubectl rollout status deployment/myapp -n scenarios --timeout=2m
```

### Verify

```bash
kubectl rollout history deployment/myapp -n scenarios
```

You should see two revisions. A pipeline is this exact sequence — `set image` then `rollout status` used as a gate — with the human parts (`input` approval) inserted between environments.

---

## Scenario 3: Set Up Monitoring with Prometheus and Grafana

### Goal

Install a real metrics pipeline, scrape a custom metric, and open a Grafana dashboard.

### Steps

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Pin the chart: pick a current version from this list
helm search repo prometheus-community/kube-prometheus-stack --versions | head -5

helm install prometheus prometheus-community/kube-prometheus-stack \
  --version <chart-version> \
  --namespace monitoring \
  --create-namespace \
  --set grafana.adminPassword=admin123 \
  --set prometheus.prometheusSpec.retention=7d
```

Wait for it to come up:

```bash
kubectl get pods -n monitoring -w
```

Point a `ServiceMonitor` at the `backend` Service from Scenario 1 so Prometheus starts scraping it (this assumes an app exposing `/metrics`; if `backend` doesn't, this step just demonstrates the wiring):

```yaml title="servicemonitor.yaml"
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: backend-monitor
  namespace: monitoring
  labels:
    release: prometheus     # kube-prometheus-stack only picks up ServiceMonitors with its release label
spec:
  namespaceSelector:
    matchNames:
      - scenarios
  selector:
    matchLabels:
      app: backend
  endpoints:
    - port: http
      interval: 30s
      path: /metrics
```

```bash
kubectl apply -f servicemonitor.yaml
```

### Verify

```bash
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
```

Open `http://localhost:3000`, log in as `admin` / `admin123`, and confirm the pre-built "Kubernetes / Compute Resources / Namespace (Pods)" dashboard shows live data for the `scenarios` namespace. Then check Prometheus directly:

```bash
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
```

The two details that most often make a ServiceMonitor silently do nothing are both in the YAML above: the `release: prometheus` label (the chart's Prometheus only selects ServiceMonitors carrying its release name, unless you set `prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false`), and `endpoints.port` matching a **named** port on the Service.

Open `http://localhost:9090/targets` and confirm `backend-monitor` shows as a discovered target (its state may be `down` if `backend` has no real `/metrics` endpoint — that's expected here; the goal is seeing the target get discovered at all).

---

## Scenario 4: Run a Blue-Green Deployment by Hand

### Goal

Cut traffic from one full version of an app to another with zero `kubectl apply` downtime, using nothing but a Service selector.

### Steps

```yaml title="blue-green.yaml"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-blue
  labels: { app: myapp, version: blue }
spec:
  replicas: 3
  selector:
    matchLabels: { app: myapp, version: blue }
  template:
    metadata:
      labels: { app: myapp, version: blue }
    spec:
      containers:
        - name: myapp
          image: nginx:1.26
          ports: [{ containerPort: 80 }]
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-green
  labels: { app: myapp, version: green }
spec:
  replicas: 3
  selector:
    matchLabels: { app: myapp, version: green }
  template:
    metadata:
      labels: { app: myapp, version: green }
    spec:
      containers:
        - name: myapp
          image: nginx:1.27
          ports: [{ containerPort: 80 }]
---
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp
    version: blue # starts pointed at blue
  ports:
    - port: 80
      targetPort: 80
```

```bash
kubectl apply -f blue-green.yaml
kubectl rollout status deployment/myapp-blue
kubectl rollout status deployment/myapp-green
```

Confirm the Service currently routes to blue, then cut over:

```bash
kubectl get endpointslices -l kubernetes.io/service-name=myapp
kubectl patch service myapp -p '{"spec":{"selector":{"version":"green"}}}'
kubectl get endpointslices -l kubernetes.io/service-name=myapp
```

### Verify

The endpoint IPs listed for `myapp` should change from the blue pods' IPs to the green pods' IPs, instantly — no rolling window, no mixed traffic. Roll back the same way:

```bash
kubectl patch service myapp -p '{"spec":{"selector":{"version":"blue"}}}'
```

A full worked version of this pattern, including a canary variant, is in [Blue-Green and Canary Releases](../case-studies/02-blue-green-and-canary-releases.md).

---

## Scenario 5: Investigate a Service That Routes Nowhere

### Goal

Given a Service that returns nothing and no other context, find and fix the actual root cause using only `kubectl`.

### Steps

Deploy something intentionally broken — a Service whose selector doesn't match its backing pods' labels, which surfaces as the app failing to reach its dependency:

```bash
kubectl create deployment broken-app --image=busybox:1.36 -n scenarios -- sh -c "sleep infinity"
kubectl label pods -l app=broken-app tier=web -n scenarios
kubectl expose deployment broken-app --port=80 --selector=app=wrong-label -n scenarios
```

Now investigate as if you didn't know what was wrong:

```bash
kubectl get pods -n scenarios
kubectl get endpointslices -n scenarios -l kubernetes.io/service-name=broken-app
```

```text
NAME               ADDRESSTYPE   PORTS     ENDPOINTS   AGE
broken-app-8xk2v   IPv4          <unset>   <unset>     10s
```

An empty `ENDPOINTS` column with a `Running` pod means the Service's `selector` doesn't match any pod's labels — the Service exists but forwards to nothing.

```bash
kubectl get pods -n scenarios --show-labels
kubectl describe service broken-app -n scenarios
```

Compare the `Selector:` line in `describe service` against the pods' actual labels to confirm the mismatch, then fix it:

```bash
kubectl patch service broken-app -n scenarios -p '{"spec":{"selector":{"app":"broken-app"}}}'
kubectl get endpointslices -n scenarios -l kubernetes.io/service-name=broken-app
```

### Verify

```text
NAME               ADDRESSTYPE   PORTS   ENDPOINTS    AGE
broken-app-8xk2v   IPv4          80      10.244.1.7   45s
```

A populated `ENDPOINTS` column confirms the Service now actually has somewhere to send traffic.

---

## Scenario 6: Fix a CrashLoopBackOff

### Goal

A Deployment's Pods keep restarting. Find out why from the evidence Kubernetes keeps, then fix it without guessing.

### Steps

Deploy an app that exits because a required setting is missing, the most common real cause of a crash loop:

```bash
kubectl create deployment crashy -n scenarios --image=busybox:1.36 -- \
  sh -c 'echo "starting"; [ -n "$DATABASE_URL" ] || { echo "FATAL: DATABASE_URL is not set" >&2; exit 1; }; sleep infinity'
```

Investigate in the standard order:

```bash
kubectl get pods -n scenarios -l app=crashy
# crashy-7d4b9c6f5d-q2x8m   0/1   CrashLoopBackOff   4 (30s ago)   2m

kubectl describe pod -n scenarios -l app=crashy | grep -A4 'Last State'
#     Last State:     Terminated
#       Reason:       Error
#       Exit Code:    1

kubectl logs -n scenarios deploy/crashy --previous
# starting
# FATAL: DATABASE_URL is not set
```

`Exit Code: 1` with `Reason: Error` means the application itself chose to exit (an `OOMKilled` reason or exit code 137 would point at memory instead), and `--previous` shows the last words of the container that crashed. Fix the cause, not the symptom:

```bash
kubectl create configmap crashy-config -n scenarios --from-literal=DATABASE_URL=postgres://postgres:5432/myapp
kubectl set env deployment/crashy -n scenarios --from=configmap/crashy-config
kubectl rollout status deployment/crashy -n scenarios
```

### Verify

```bash
kubectl get pods -n scenarios -l app=crashy
# crashy-5f8c7d9b6a-lm4pw   1/1   Running   0   20s
```

Restart count back to `0` on a new Pod, and `kubectl logs` shows `starting` with no error. For a longer incident with an OOMKill and a failing liveness probe, see the [CrashLoopBackOff case study](../case-studies/06-debugging-a-crashloopbackoff-incident.md).

---

## Practice Commands Cheat Sheet

```bash
# Diagnostics
kubectl get all -A
kubectl get events --sort-by=.metadata.creationTimestamp -n scenarios
kubectl top nodes
kubectl top pods -n scenarios
kubectl describe pod <pod-name> -n scenarios
kubectl logs <pod-name> -n scenarios --previous

# Rollouts
kubectl rollout status deployment/<name> -n scenarios
kubectl rollout history deployment/<name> -n scenarios
kubectl rollout undo deployment/<name> -n scenarios
kubectl rollout restart deployment/<name> -n scenarios

# Debug shells
kubectl run debug --rm -it --image=busybox:1.36 -n scenarios -- sh
kubectl exec -it <pod-name> -n scenarios -- sh
```

## Cleanup

```bash
kubectl delete namespace scenarios
helm uninstall prometheus -n monitoring
kubectl delete namespace monitoring
kubectl config set-context --current --namespace=default
```

## Next

Continue to [Case Studies](../case-studies/index.md) for complete, single-scenario worked examples with a full failure path and recovery, rather than a grab-bag of exercises.
