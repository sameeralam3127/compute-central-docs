---
description: Understand Kubernetes architecture, workloads, networking, storage, RBAC, kubectl commands, and core objects used in real platform operations.
---

# Kubernetes Fundamentals Guide

## 1. Kubernetes Architecture

### Control Plane Components

```
┌─────────────────────────────────────────────────────────┐
│                    Control Plane                         │
├─────────────────────────────────────────────────────────┤
│  API Server  │  etcd  │  Scheduler  │  Controller Mgr   │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
    ┌───▼────┐       ┌───▼────┐       ┌───▼────┐
    │ Node 1 │       │ Node 2 │       │ Node 3 │
    │ kubelet│       │ kubelet│       │ kubelet│
    │ kube-  │       │ kube-  │       │ kube-  │
    │ proxy  │       │ proxy  │       │ proxy  │
    └────────┘       └────────┘       └────────┘
```

### Component Details

**API Server (kube-apiserver)**

- Front-end for Kubernetes control plane
- Exposes REST API
- Validates and processes API requests
- Only component that talks to etcd
- Interview Tip: Explain how it handles authentication, authorization (RBAC), and admission control

**etcd**

- Distributed key-value store
- Stores all cluster data
- Source of truth for cluster state
- Interview Tip: Discuss backup strategies, HA setup, and disaster recovery

**Scheduler (kube-scheduler)**

- Assigns pods to nodes
- Considers resource requirements, constraints, affinity/anti-affinity
- Interview Tip: Explain scheduling algorithms, node selection criteria

**Controller Manager (kube-controller-manager)**

- Runs controller processes
- Node Controller, Replication Controller, Endpoints Controller, Service Account Controller
- Interview Tip: Discuss reconciliation loops and desired state management

**kubelet**

- Agent running on each node
- Ensures containers are running in pods
- Reports node and pod status to API server
- Interview Tip: Explain pod lifecycle management

**kube-proxy**

- Network proxy on each node
- Maintains network rules
- Implements Service abstraction
- Interview Tip: Discuss iptables vs IPVS modes

---

## 2. Core Kubernetes Objects

### Pods

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
  labels:
    app: nginx
    tier: frontend
spec:
  containers:
    - name: nginx
      image: nginx:1.21
      ports:
        - containerPort: 80
      resources:
        requests:
          memory: "64Mi"
          cpu: "250m"
        limits:
          memory: "128Mi"
          cpu: "500m"
      livenessProbe:
        httpGet:
          path: /healthz
          port: 80
        initialDelaySeconds: 3
        periodSeconds: 3
      readinessProbe:
        httpGet:
          path: /ready
          port: 80
        initialDelaySeconds: 5
        periodSeconds: 5
```

**Key Concepts:**

- Smallest deployable unit
- Can contain multiple containers (sidecar pattern)
- Shared network namespace and storage volumes
- Ephemeral by nature

**Interview Questions to Prepare:**

- Why use init containers?
- Explain pod lifecycle phases
- What happens during pod termination?
- How do you debug a CrashLoopBackOff?

### Deployments

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:1.21
          ports:
            - containerPort: 80
```

**Key Features:**

- Declarative updates for Pods and ReplicaSets
- Rolling updates and rollbacks
- Scaling capabilities
- Self-healing

**Interview Topics:**

- Deployment strategies (RollingUpdate, Recreate, Blue-Green, Canary)
- How to perform zero-downtime deployments
- Rollback mechanisms
- Update strategies and their trade-offs

### Services

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  type: LoadBalancer
  selector:
    app: nginx
  ports:
    - protocol: TCP
      port: 80
      targetPort: 80
  sessionAffinity: ClientIP
```

**Service Types:**

1. **ClusterIP** (default) - Internal cluster access only
2. **NodePort** - Exposes on each node's IP at a static port
3. **LoadBalancer** - Cloud provider load balancer
4. **ExternalName** - Maps to DNS name

**Interview Focus:**

- Service discovery mechanisms
- How kube-proxy implements services
- Headless services for StatefulSets
- Service mesh integration

### ConfigMaps and Secrets

```yaml
# ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  database_url: "postgres://db:5432"
  log_level: "info"
  config.json: |
    {
      "feature_flags": {
        "new_ui": true
      }
    }

---
# Secret
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
type: Opaque
data:
  username: YWRtaW4= # base64 encoded
  password: cGFzc3dvcmQxMjM=
```

**Usage in Pods:**

```yaml
spec:
  containers:
    - name: app
      image: myapp:1.0
      env:
        - name: DB_URL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: database_url
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
      volumeMounts:
        - name: config-volume
          mountPath: /etc/config
  volumes:
    - name: config-volume
      configMap:
        name: app-config
```

### StatefulSets

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongodb
spec:
  serviceName: mongodb
  replicas: 3
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      containers:
        - name: mongodb
          image: mongo:4.4
          ports:
            - containerPort: 27017
          volumeMounts:
            - name: data
              mountPath: /data/db
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi
```

**Key Characteristics:**

- Stable network identities
- Ordered deployment and scaling
- Persistent storage per pod
- Use cases: databases, message queues

---

## 3. Storage in Kubernetes

### Persistent Volumes (PV) and Claims (PVC)

```yaml
# PersistentVolume
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-nfs
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  nfs:
    server: nfs-server.example.com
    path: "/exports"

---
# PersistentVolumeClaim
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-app
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 5Gi
  storageClassName: standard
```

**Storage Classes:**

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
reclaimPolicy: Delete
allowVolumeExpansion: true
```

**Interview Topics:**

- Dynamic vs static provisioning
- Access modes (RWO, ROX, RWX)
- Reclaim policies (Retain, Delete, Recycle)
- CSI (Container Storage Interface) drivers

---

## 4. Networking

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-allow
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - protocol: TCP
          port: 8080
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: database
      ports:
        - protocol: TCP
          port: 5432
```

### Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
    - hosts:
        - app.example.com
      secretName: app-tls
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 8080
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 80
```

**Interview Focus:**

- CNI plugins (Calico, Flannel, Weave)
- Service mesh (Istio, Linkerd)
- Ingress controllers (Nginx, Traefik, HAProxy)
- DNS in Kubernetes (CoreDNS)

---

## 5. Security & RBAC

### Role-Based Access Control

```yaml
# Role
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: production
  name: pod-reader
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch"]

---
# RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: production
subjects:
  - kind: User
    name: jane
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io

---
# ClusterRole (cluster-wide)
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cluster-admin-custom
rules:
  - apiGroups: ["*"]
    resources: ["*"]
    verbs: ["*"]
```

### Security Best Practices

```yaml
# Pod Security Context
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 2000
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: app
      image: myapp:1.0
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL
          add:
            - NET_BIND_SERVICE
```

**Interview Topics:**

- Pod Security Standards (Privileged, Baseline, Restricted)
- Service Accounts and token mounting
- Network policies for micro-segmentation
- Image scanning and admission controllers
- Secrets management (external secrets, Vault integration)

---

## 6. Resource Management

### Resource Requests and Limits

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: resource-demo
spec:
  containers:
    - name: app
      image: myapp:1.0
      resources:
        requests:
          memory: "256Mi"
          cpu: "500m"
        limits:
          memory: "512Mi"
          cpu: "1000m"
```

### LimitRange

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: mem-cpu-limit-range
  namespace: production
spec:
  limits:
    - max:
        memory: "2Gi"
        cpu: "2"
      min:
        memory: "128Mi"
        cpu: "100m"
      default:
        memory: "512Mi"
        cpu: "500m"
      defaultRequest:
        memory: "256Mi"
        cpu: "250m"
      type: Container
```

### ResourceQuota

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
  namespace: production
spec:
  hard:
    requests.cpu: "10"
    requests.memory: "20Gi"
    limits.cpu: "20"
    limits.memory: "40Gi"
    persistentvolumeclaims: "10"
    pods: "50"
```

### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: app-deployment
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
```

---

## 7. Essential kubectl Commands

### Cluster Information

```bash
# Cluster info
kubectl cluster-info
kubectl version
kubectl get nodes
kubectl describe node <node-name>
kubectl top nodes

# Component status
kubectl get componentstatuses
```

### Working with Resources

```bash
# Get resources
kubectl get pods -A
kubectl get pods -n production -o wide
kubectl get pods --show-labels
kubectl get pods -l app=nginx
kubectl get all -n production

# Describe resources
kubectl describe pod <pod-name>
kubectl describe deployment <deployment-name>

# Create/Apply resources
kubectl apply -f deployment.yaml
kubectl create deployment nginx --image=nginx:1.21
kubectl create namespace production

# Edit resources
kubectl edit deployment nginx-deployment
kubectl scale deployment nginx-deployment --replicas=5
kubectl set image deployment/nginx-deployment nginx=nginx:1.22

# Delete resources
kubectl delete pod <pod-name>
kubectl delete -f deployment.yaml
kubectl delete deployment nginx-deployment
```

### Debugging

```bash
# Logs
kubectl logs <pod-name>
kubectl logs <pod-name> -c <container-name>
kubectl logs -f <pod-name>
kubectl logs --previous <pod-name>
kubectl logs -l app=nginx --tail=100

# Execute commands
kubectl exec -it <pod-name> -- /bin/bash
kubectl exec <pod-name> -- env
kubectl exec <pod-name> -c <container-name> -- ls /app

# Port forwarding
kubectl port-forward pod/<pod-name> 8080:80
kubectl port-forward service/<service-name> 8080:80

# Copy files
kubectl cp <pod-name>:/path/to/file ./local-file
kubectl cp ./local-file <pod-name>:/path/to/file

# Events
kubectl get events --sort-by=.metadata.creationTimestamp
kubectl get events -n production --watch
```

### Advanced Operations

```bash
# Rollout management
kubectl rollout status deployment/nginx-deployment
kubectl rollout history deployment/nginx-deployment
kubectl rollout undo deployment/nginx-deployment
kubectl rollout restart deployment/nginx-deployment

# Resource usage
kubectl top pods
kubectl top pods -n production --sort-by=memory
kubectl top nodes

# Dry run and diff
kubectl apply -f deployment.yaml --dry-run=client
kubectl apply -f deployment.yaml --dry-run=server
kubectl diff -f deployment.yaml

# Labels and annotations
kubectl label pods <pod-name> env=production
kubectl annotate pods <pod-name> description="Production pod"

# Contexts and namespaces
kubectl config get-contexts
kubectl config use-context production-cluster
kubectl config set-context --current --namespace=production
```

---

## 8. Interview Preparation Tips

### Common Scenarios to Discuss

**1. Pod Not Starting**

- Check pod status: `kubectl get pods`
- Describe pod: `kubectl describe pod <name>`
- Check events, image pull errors, resource constraints
- Verify ConfigMaps/Secrets exist
- Check node resources

**2. Service Not Accessible**

- Verify service endpoints: `kubectl get endpoints`
- Check pod labels match service selector
- Test from within cluster: `kubectl run -it --rm debug --image=busybox -- wget -O- http://service-name`
- Check network policies
- Verify ingress configuration

**3. High Memory/CPU Usage**

- Check resource metrics: `kubectl top pods`
- Review resource requests/limits
- Analyze application logs
- Consider HPA implementation
- Check for memory leaks

**4. Deployment Rollout Issues**

- Check rollout status: `kubectl rollout status`
- Review deployment strategy
- Check readiness/liveness probes
- Verify image availability
- Review resource quotas

### Key Talking Points

**Architecture Decisions:**

- Why use StatefulSets vs Deployments
- When to use DaemonSets
- Service mesh vs traditional ingress
- Multi-cluster strategies

**Best Practices:**

- Resource requests/limits for all containers
- Health checks (liveness, readiness, startup probes)
- Immutable infrastructure
- GitOps workflows
- Security hardening

**Production Experience:**

- Cluster sizing and capacity planning
- Disaster recovery procedures
- Monitoring and alerting setup
- Cost optimization strategies
- Multi-tenancy implementation

---

## Quick Reference Card

### Pod Lifecycle Phases

- **Pending**: Accepted but not yet scheduled
- **Running**: Bound to node, containers created
- **Succeeded**: All containers terminated successfully
- **Failed**: All containers terminated, at least one failed
- **Unknown**: State cannot be determined

### Common Port Numbers

- API Server: 6443
- etcd: 2379-2380
- Kubelet: 10250
- NodePort range: 30000-32767

### Resource Units

- CPU: 1 = 1 vCPU/Core, 100m = 0.1 CPU
- Memory: Ki, Mi, Gi (1024-based), K, M, G (1000-based)

### Label Selectors

- Equality: `app=nginx`, `tier!=frontend`
- Set-based: `env in (prod,staging)`, `tier notin (frontend)`
