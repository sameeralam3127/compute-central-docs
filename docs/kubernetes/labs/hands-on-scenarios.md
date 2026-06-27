---
description: Practice Kubernetes with hands-on scenarios for multi-tier apps, CI/CD, monitoring, blue-green deployments, troubleshooting, services, and resource management.
---

# Kubernetes Hands-On Practice Scenarios

## Scenario 1: Deploy a Multi-Tier Application

### Objective

Deploy a complete web application with frontend, backend API, and database.

### Requirements

- Frontend: React app (3 replicas)
- Backend: Node.js API (3 replicas)
- Database: PostgreSQL (StatefulSet)
- Expose frontend via LoadBalancer
- Internal communication between tiers
- Persistent storage for database
- ConfigMaps for configuration
- Secrets for credentials

### Solution

**1. Create Namespace:**

```bash
kubectl create namespace webapp
kubectl config set-context --current --namespace=webapp
```

**2. Database (PostgreSQL):**

```yaml
# postgres-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-config
data:
  POSTGRES_DB: myapp
  POSTGRES_USER: appuser

---
# postgres-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secret
type: Opaque
stringData:
  POSTGRES_PASSWORD: "SecurePassword123"

---
# postgres-pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi

---
# postgres-statefulset.yaml
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
          image: postgres:14
          ports:
            - containerPort: 5432
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
            storage: 10Gi

---
# postgres-service.yaml
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
  clusterIP: None # Headless service for StatefulSet
```

**3. Backend API:**

```yaml
# backend-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: backend-config
data:
  DATABASE_HOST: postgres
  DATABASE_PORT: "5432"
  DATABASE_NAME: myapp
  LOG_LEVEL: info
  PORT: "8080"

---
# backend-deployment.yaml
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
          image: myorg/backend-api:1.0
          ports:
            - containerPort: 8080
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
          envFrom:
            - configMapRef:
                name: backend-config
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"

---
# backend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: backend
spec:
  selector:
    app: backend
  ports:
    - port: 80
      targetPort: 8080
  type: ClusterIP
```

**4. Frontend:**

```yaml
# frontend-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: frontend-config
data:
  API_URL: http://backend

---
# frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: myorg/frontend:1.0
          ports:
            - containerPort: 80
          envFrom:
            - configMapRef:
                name: frontend-config
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "200m"

---
# frontend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend
spec:
  selector:
    app: frontend
  ports:
    - port: 80
      targetPort: 80
  type: LoadBalancer
```

**5. Deploy Everything:**

```bash
# Apply all resources
kubectl apply -f postgres-configmap.yaml
kubectl apply -f postgres-secret.yaml
kubectl apply -f postgres-pvc.yaml
kubectl apply -f postgres-statefulset.yaml
kubectl apply -f postgres-service.yaml

kubectl apply -f backend-configmap.yaml
kubectl apply -f backend-deployment.yaml
kubectl apply -f backend-service.yaml

kubectl apply -f frontend-configmap.yaml
kubectl apply -f frontend-deployment.yaml
kubectl apply -f frontend-service.yaml

# Verify deployment
kubectl get all
kubectl get pvc
kubectl get configmap
kubectl get secret
```

**6. Test the Application:**

```bash
# Get frontend service external IP
kubectl get svc frontend

# Test frontend
curl http://<EXTERNAL-IP>

# Test backend from within cluster
kubectl run test --rm -it --image=curlimages/curl -- \
  curl http://backend/api/health

# Check database connection
kubectl exec -it postgres-0 -- psql -U appuser -d myapp -c "\dt"
```

---

## Scenario 2: Implement CI/CD Pipeline with Jenkins

### Objective

Set up a complete CI/CD pipeline using Jenkins on Kubernetes.

### Requirements

- Jenkins running in Kubernetes
- Pipeline triggered by Git webhook
- Build Docker image
- Run tests
- Deploy to dev/staging/prod
- Implement approval gates

### Solution

**1. Install Jenkins:**

```bash
# Create namespace
kubectl create namespace jenkins

# Create service account
kubectl create serviceaccount jenkins -n jenkins

# Create RBAC
kubectl create clusterrolebinding jenkins --clusterrole=cluster-admin --serviceaccount=jenkins:jenkins

# Deploy Jenkins
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jenkins
  namespace: jenkins
spec:
  replicas: 1
  selector:
    matchLabels:
      app: jenkins
  template:
    metadata:
      labels:
        app: jenkins
    spec:
      serviceAccountName: jenkins
      containers:
      - name: jenkins
        image: jenkins/jenkins:lts
        ports:
        - containerPort: 8080
        - containerPort: 50000
        volumeMounts:
        - name: jenkins-home
          mountPath: /var/jenkins_home
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
      volumes:
      - name: jenkins-home
        persistentVolumeClaim:
          claimName: jenkins-pvc
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: jenkins-pvc
  namespace: jenkins
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
---
apiVersion: v1
kind: Service
metadata:
  name: jenkins
  namespace: jenkins
spec:
  type: LoadBalancer
  ports:
  - port: 8080
    targetPort: 8080
    name: web
  - port: 50000
    targetPort: 50000
    name: agent
  selector:
    app: jenkins
EOF
```

**2. Jenkinsfile:**

```groovy
pipeline {
    agent {
        kubernetes {
            yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: docker
    image: docker:20.10
    command:
    - cat
    tty: true
    volumeMounts:
    - name: docker-sock
      mountPath: /var/run/docker.sock
  - name: kubectl
    image: bitnami/kubectl:latest
    command:
    - cat
    tty: true
  volumes:
  - name: docker-sock
    hostPath:
      path: /var/run/docker.sock
"""
        }
    }

    environment {
        DOCKER_REGISTRY = 'docker.io'
        IMAGE_NAME = 'myorg/myapp'
        GIT_COMMIT_SHORT = sh(script: "git rev-parse --short HEAD", returnStdout: true).trim()
        IMAGE_TAG = "${BUILD_NUMBER}-${GIT_COMMIT_SHORT}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build') {
            steps {
                container('docker') {
                    sh """
                        docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .
                        docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:latest
                    """
                }
            }
        }

        stage('Test') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        container('docker') {
                            sh 'docker run --rm ${IMAGE_NAME}:${IMAGE_TAG} npm test'
                        }
                    }
                }
                stage('Security Scan') {
                    steps {
                        container('docker') {
                            sh """
                                docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
                                    aquasec/trivy image ${IMAGE_NAME}:${IMAGE_TAG}
                            """
                        }
                    }
                }
            }
        }

        stage('Push Image') {
            steps {
                container('docker') {
                    withCredentials([usernamePassword(
                        credentialsId: 'docker-hub',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )]) {
                        sh """
                            echo \$DOCKER_PASS | docker login -u \$DOCKER_USER --password-stdin
                            docker push ${IMAGE_NAME}:${IMAGE_TAG}
                            docker push ${IMAGE_NAME}:latest
                        """
                    }
                }
            }
        }

        stage('Deploy to Dev') {
            steps {
                container('kubectl') {
                    sh """
                        kubectl set image deployment/myapp \
                            myapp=${IMAGE_NAME}:${IMAGE_TAG} \
                            -n dev
                        kubectl rollout status deployment/myapp -n dev --timeout=5m
                    """
                }
            }
        }

        stage('Integration Tests') {
            steps {
                container('kubectl') {
                    sh """
                        kubectl run test-pod --rm -i --restart=Never \
                            --image=curlimages/curl:latest \
                            -n dev \
                            -- curl -f http://myapp-service/health
                    """
                }
            }
        }

        stage('Deploy to Staging') {
            when {
                branch 'main'
            }
            steps {
                container('kubectl') {
                    sh """
                        kubectl set image deployment/myapp \
                            myapp=${IMAGE_NAME}:${IMAGE_TAG} \
                            -n staging
                        kubectl rollout status deployment/myapp -n staging --timeout=5m
                    """
                }
            }
        }

        stage('Approval for Production') {
            when {
                branch 'main'
            }
            steps {
                input message: 'Deploy to Production?', ok: 'Deploy'
            }
        }

        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                container('kubectl') {
                    sh """
                        kubectl set image deployment/myapp \
                            myapp=${IMAGE_NAME}:${IMAGE_TAG} \
                            -n production
                        kubectl rollout status deployment/myapp -n production --timeout=10m
                    """
                }
            }
        }
    }

    post {
        success {
            echo "Pipeline succeeded!"
        }
        failure {
            echo "Pipeline failed!"
        }
    }
}
```

**3. Configure Webhook:**

```bash
# In GitHub repository settings:
# Webhooks → Add webhook
# Payload URL: http://<JENKINS_URL>/github-webhook/
# Content type: application/json
# Events: Push events
```

---

## Scenario 3: Implement Monitoring and Alerting

### Objective

Set up comprehensive monitoring using Prometheus and Grafana.

### Requirements

- Prometheus for metrics collection
- Grafana for visualization
- AlertManager for alerts
- Custom application metrics
- Node and pod monitoring

### Solution

**1. Install Prometheus Stack:**

```bash
# Add Helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.retention=30d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi \
  --set grafana.adminPassword=admin123
```

**2. Custom ServiceMonitor:**

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: myapp-monitor
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: myapp
  endpoints:
    - port: metrics
      interval: 30s
      path: /metrics
```

**3. Application with Metrics:**

```javascript
// Node.js example with Prometheus client
const express = require("express");
const promClient = require("prom-client");

const app = express();
const register = new promClient.Registry();

// Default metrics
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const httpRequestTotal = new promClient.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

// Middleware to track metrics
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
    httpRequestTotal
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .inc();
  });
  next();
});

// Metrics endpoint
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.listen(8080);
```

**4. PrometheusRule for Alerts:**

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: myapp-alerts
  namespace: monitoring
spec:
  groups:
    - name: myapp
      interval: 30s
      rules:
        - alert: HighErrorRate
          expr: |
            rate(http_requests_total{status_code=~"5.."}[5m]) > 0.05
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "High error rate detected"
            description: "Error rate is {{ $value }} for {{ $labels.instance }}"

        - alert: HighMemoryUsage
          expr: |
            container_memory_usage_bytes{pod=~"myapp-.*"} / 
            container_spec_memory_limit_bytes{pod=~"myapp-.*"} > 0.9
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "High memory usage"
            description: "Memory usage is {{ $value | humanizePercentage }} for {{ $labels.pod }}"

        - alert: PodCrashLooping
          expr: |
            rate(kube_pod_container_status_restarts_total[15m]) > 0
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "Pod is crash looping"
            description: "Pod {{ $labels.pod }} is restarting frequently"
```

**5. Grafana Dashboard:**

```json
{
  "dashboard": {
    "title": "Application Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status_code=~\"5..\"}[5m])"
          }
        ]
      },
      {
        "title": "Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Pod Memory Usage",
        "targets": [
          {
            "expr": "container_memory_usage_bytes{pod=~\"myapp-.*\"}"
          }
        ]
      }
    ]
  }
}
```

**6. Access Grafana:**

```bash
# Port forward to Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80

# Access at http://localhost:3000
# Username: admin
# Password: admin123
```

---

## Scenario 4: Implement Blue-Green Deployment

### Objective

Implement blue-green deployment strategy for zero-downtime releases.

### Solution

**1. Blue Deployment (Current):**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-blue
  labels:
    app: myapp
    version: blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      version: blue
  template:
    metadata:
      labels:
        app: myapp
        version: blue
    spec:
      containers:
        - name: myapp
          image: myapp:v1.0
          ports:
            - containerPort: 8080
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
```

**2. Service (Initially pointing to blue):**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp-service
spec:
  selector:
    app: myapp
    version: blue # Points to blue deployment
  ports:
    - port: 80
      targetPort: 8080
  type: LoadBalancer
```

**3. Deploy Green Version:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-green
  labels:
    app: myapp
    version: green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      version: green
  template:
    metadata:
      labels:
        app: myapp
        version: green
    spec:
      containers:
        - name: myapp
          image: myapp:v2.0 # New version
          ports:
            - containerPort: 8080
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
```

**4. Deployment Script:**

```bash
#!/bin/bash
set -euo pipefail

# Deploy green version
echo "Deploying green version..."
kubectl apply -f myapp-green-deployment.yaml

# Wait for green to be ready
echo "Waiting for green deployment to be ready..."
kubectl rollout status deployment/myapp-green --timeout=5m

# Run smoke tests on green
echo "Running smoke tests on green..."
GREEN_POD=$(kubectl get pods -l version=green -o jsonpath='{.items[0].metadata.name}')
kubectl exec $GREEN_POD -- curl -f http://localhost:8080/health

# Switch traffic to green
echo "Switching traffic to green..."
kubectl patch service myapp-service -p '{"spec":{"selector":{"version":"green"}}}'

# Verify traffic switch
echo "Verifying traffic switch..."
sleep 10
curl -f http://$(kubectl get svc myapp-service -o jsonpath='{.status.loadBalancer.ingress[0].ip}')/health

# Keep blue for quick rollback
echo "Green deployment successful! Blue deployment kept for rollback."
echo "To rollback: kubectl patch service myapp-service -p '{\"spec\":{\"selector\":{\"version\":\"blue\"}}}'"

# Optional: Delete blue after verification period
# kubectl delete deployment myapp-blue
```

---

## Scenario 5: Troubleshoot Production Issue

### Objective

Debug and resolve a production issue where pods are crashing.

### Problem

Pods are in CrashLoopBackOff state after deployment.

### Investigation Steps

**1. Check Pod Status:**

```bash
kubectl get pods
# Output: myapp-5d4b8c7f9-abc12   0/1     CrashLoopBackOff   5          10m
```

**2. Describe Pod:**

```bash
kubectl describe pod myapp-5d4b8c7f9-abc12

# Look for:
# - Events section
# - Last State
# - Exit Code
```

**3. Check Logs:**

```bash
# Current logs
kubectl logs myapp-5d4b8c7f9-abc12

# Previous container logs
kubectl logs myapp-5d4b8c7f9-abc12 --previous

# Output might show:
# Error: Cannot connect to database
# Connection refused: postgres:5432
```

**4. Verify Configuration:**

```bash
# Check ConfigMap
kubectl get configmap myapp-config -o yaml

# Check Secret
kubectl get secret myapp-secret -o yaml

# Check environment variables in pod
kubectl exec myapp-5d4b8c7f9-abc12 -- env
```

**5. Test Database Connectivity:**

```bash
# Run debug pod
kubectl run debug --rm -it --image=postgres:14 -- bash

# Inside debug pod
psql -h postgres -U appuser -d myapp
# If connection fails, check service
```

**6. Check Service and Endpoints:**

```bash
kubectl get svc postgres
kubectl get endpoints postgres

# If no endpoints, check pod labels
kubectl get pods -l app=postgres --show-labels
```

**7. Root Cause Found:**
Database service selector doesn't match pod labels.

**8. Fix:**

```bash
# Update service selector
kubectl patch svc postgres -p '{"spec":{"selector":{"app":"postgres"}}}'

# Or fix pod labels
kubectl label pods postgres-0 app=postgres

# Verify fix
kubectl get endpoints postgres
# Should now show endpoints

# Restart application pods
kubectl rollout restart deployment/myapp

# Verify
kubectl get pods
# All pods should be Running
```

---

## Practice Commands Cheat Sheet

### Quick Diagnostics

```bash
# Get all resources
kubectl get all -A

# Check events
kubectl get events --sort-by=.metadata.creationTimestamp

# Resource usage
kubectl top nodes
kubectl top pods -A

# Describe resources
kubectl describe pod <pod-name>
kubectl describe node <node-name>

# Logs
kubectl logs <pod-name>
kubectl logs <pod-name> --previous
kubectl logs -f <pod-name>

# Execute commands
kubectl exec -it <pod-name> -- /bin/bash
kubectl exec <pod-name> -- env

# Port forward
kubectl port-forward pod/<pod-name> 8080:80

# Debug
kubectl run debug --rm -it --image=busybox -- sh
kubectl debug <pod-name> -it --image=busybox
```

### Deployment Operations

```bash
# Create deployment
kubectl create deployment myapp --image=myapp:1.0

# Scale
kubectl scale deployment myapp --replicas=5

# Update image
kubectl set image deployment/myapp myapp=myapp:2.0

# Rollout status
kubectl rollout status deployment/myapp

# Rollout history
kubectl rollout history deployment/myapp

# Rollback
kubectl rollout undo deployment/myapp

# Restart
kubectl rollout restart deployment/myapp
```

### Resource Management

```bash
# Set resources
kubectl set resources deployment myapp --limits=cpu=500m,memory=512Mi

# Autoscale
kubectl autoscale deployment myapp --min=2 --max=10 --cpu-percent=70

# Create from YAML
kubectl apply -f deployment.yaml

# Delete
kubectl delete deployment myapp
kubectl delete -f deployment.yaml
```

---
