---
description: Use practical kubectl and oc commands, YAML templates, troubleshooting checks, resource units, selectors, JSONPath examples, aliases, and Kubernetes cheat sheets.
---

# Kubernetes and OpenShift Quick Reference and Cheat Sheets

## Essential kubectl Commands

### Cluster Information

```bash
kubectl cluster-info                    # Display cluster info
kubectl version                         # Show client and server versions
kubectl get nodes                       # List all nodes
kubectl get nodes -o wide              # List nodes with more details
kubectl describe node <node-name>      # Detailed node information
kubectl top nodes                      # Show node resource usage
```

### Working with Pods

```bash
# List pods
kubectl get pods                       # Pods in current namespace
kubectl get pods -A                    # All namespaces
kubectl get pods -n <namespace>        # Specific namespace
kubectl get pods -o wide              # More details (node, IP)
kubectl get pods --show-labels        # Show labels
kubectl get pods -l app=nginx         # Filter by label

# Describe and logs
kubectl describe pod <pod-name>        # Detailed pod info
kubectl logs <pod-name>               # View logs
kubectl logs <pod-name> -f            # Follow logs
kubectl logs <pod-name> --previous    # Previous container logs
kubectl logs <pod-name> -c <container> # Specific container

# Execute commands
kubectl exec <pod-name> -- <command>   # Run command
kubectl exec -it <pod-name> -- bash    # Interactive shell

# Port forwarding
kubectl port-forward <pod-name> 8080:80

# Copy files
kubectl cp <pod-name>:/path/file ./local-file
kubectl cp ./local-file <pod-name>:/path/file

# Delete pods
kubectl delete pod <pod-name>
kubectl delete pods --all
kubectl delete pods -l app=nginx
```

### Deployments

```bash
# Create deployment
kubectl create deployment nginx --image=nginx:1.21
kubectl create deployment nginx --image=nginx:1.21 --replicas=3

# List deployments
kubectl get deployments
kubectl get deploy -o wide

# Scale deployment
kubectl scale deployment nginx --replicas=5

# Update image
kubectl set image deployment/nginx nginx=nginx:1.22

# Rollout management
kubectl rollout status deployment/nginx
kubectl rollout history deployment/nginx
kubectl rollout undo deployment/nginx
kubectl rollout restart deployment/nginx

# Edit deployment
kubectl edit deployment nginx

# Delete deployment
kubectl delete deployment nginx
```

### Services

```bash
# Create service
kubectl expose deployment nginx --port=80 --type=LoadBalancer
kubectl create service clusterip nginx --tcp=80:80

# List services
kubectl get services
kubectl get svc -o wide

# Describe service
kubectl describe svc nginx

# Delete service
kubectl delete svc nginx
```

### ConfigMaps and Secrets

```bash
# ConfigMaps
kubectl create configmap app-config --from-literal=key=value
kubectl create configmap app-config --from-file=config.properties
kubectl get configmaps
kubectl describe configmap app-config
kubectl delete configmap app-config

# Secrets
kubectl create secret generic db-secret --from-literal=password=secret123
kubectl create secret docker-registry regcred --docker-server=docker.io --docker-username=user --docker-password=pass
kubectl get secrets
kubectl describe secret db-secret
kubectl delete secret db-secret
```

### Namespaces

```bash
kubectl get namespaces
kubectl create namespace dev
kubectl delete namespace dev
kubectl config set-context --current --namespace=dev
```

### Resource Management

```bash
# Set resources
kubectl set resources deployment nginx --limits=cpu=500m,memory=512Mi --requests=cpu=250m,memory=256Mi

# Autoscaling
kubectl autoscale deployment nginx --min=2 --max=10 --cpu-percent=70
kubectl get hpa

# Resource quotas
kubectl create quota compute-quota --hard=cpu=10,memory=20Gi,pods=50
kubectl get resourcequota
```

### Debugging

```bash
# Events
kubectl get events
kubectl get events --sort-by=.metadata.creationTimestamp
kubectl get events -w

# Debug pod
kubectl run debug --rm -it --image=busybox -- sh
kubectl debug <pod-name> -it --image=busybox

# Resource usage
kubectl top pods
kubectl top nodes
kubectl top pods --sort-by=memory
```

### Apply and Delete

```bash
kubectl apply -f deployment.yaml
kubectl apply -f directory/
kubectl apply -f https://example.com/deployment.yaml
kubectl delete -f deployment.yaml
kubectl delete all --all
```

---

## OpenShift (oc) Commands

### Basic Commands

```bash
oc login https://api.cluster.example.com:6443
oc whoami
oc status
oc projects
oc project myapp
oc new-project myapp
```

### Application Management

```bash
# Create app
oc new-app nodejs:16~https://github.com/myorg/myapp.git
oc new-app --docker-image=nginx:latest

# Expose service
oc expose service myapp

# Build operations
oc start-build myapp
oc logs -f bc/myapp
oc get builds

# Routes
oc get routes
oc create route edge myapp --service=myapp
```

### Security

```bash
# SCC management
oc get scc
oc adm policy add-scc-to-user anyuid -z myapp-sa
oc describe pod myapp | grep scc

# RBAC
oc adm policy add-role-to-user admin user1 -n myapp
oc adm policy add-cluster-role-to-user cluster-admin user1
```

---

## YAML Templates

### Pod

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
  labels:
    app: myapp
spec:
  containers:
    - name: myapp
      image: myapp:1.0
      ports:
        - containerPort: 8080
      env:
        - name: ENV_VAR
          value: "value"
      resources:
        requests:
          memory: "256Mi"
          cpu: "250m"
        limits:
          memory: "512Mi"
          cpu: "500m"
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
```

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: myapp:1.0
          ports:
            - containerPort: 8080
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp-service
spec:
  selector:
    app: myapp
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
  type: LoadBalancer
```

### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  database_url: "postgres://db:5432"
  log_level: "info"
```

### Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
type: Opaque
stringData:
  username: admin
  password: secret123
```

### Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
    - host: myapp.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: myapp-service
                port:
                  number: 80
```

### PersistentVolumeClaim

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: myapp-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: standard
```

### HorizontalPodAutoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---

## Common Troubleshooting Scenarios

### Pod Won't Start

```bash
# Check status
kubectl get pods
kubectl describe pod <pod-name>

# Common issues:
# - ImagePullBackOff: Check image name, registry credentials
# - CrashLoopBackOff: Check logs, application errors
# - Pending: Check resources, node availability
# - Error: Check configuration, permissions
```

### Service Not Accessible

```bash
# Check service and endpoints
kubectl get svc
kubectl get endpoints

# Test connectivity
kubectl run test --rm -it --image=busybox -- wget -O- http://service-name

# Check network policies
kubectl get networkpolicy
```

### High Resource Usage

```bash
# Check usage
kubectl top nodes
kubectl top pods

# Check limits
kubectl describe pod <pod-name> | grep -A 5 Limits

# Scale or adjust resources
kubectl scale deployment myapp --replicas=5
kubectl set resources deployment myapp --limits=cpu=1,memory=1Gi
```

---

## Resource Units

### CPU

- 1 CPU = 1000m (millicores)
- 100m = 0.1 CPU
- 500m = 0.5 CPU
- 1 = 1 CPU core

### Memory

- Ki = Kibibyte (1024 bytes)
- Mi = Mebibyte (1024 Ki)
- Gi = Gibibyte (1024 Mi)
- K = Kilobyte (1000 bytes)
- M = Megabyte (1000 K)
- G = Gigabyte (1000 M)

---

## Port Numbers

### Kubernetes Components

- API Server: 6443
- etcd: 2379-2380
- Kubelet: 10250
- kube-scheduler: 10259
- kube-controller-manager: 10257

### Common Services

- HTTP: 80
- HTTPS: 443
- NodePort range: 30000-32767
- PostgreSQL: 5432
- MySQL: 3306
- MongoDB: 27017
- Redis: 6379

---

## Label Selectors

### Equality-based

```bash
kubectl get pods -l app=nginx
kubectl get pods -l app=nginx,tier=frontend
kubectl get pods -l 'app!=nginx'
```

### Set-based

```bash
kubectl get pods -l 'env in (prod,staging)'
kubectl get pods -l 'tier notin (frontend,backend)'
kubectl get pods -l 'app,!tier'
```

---

## JSONPath Examples

```bash
# Get pod IPs
kubectl get pods -o jsonpath='{.items[*].status.podIP}'

# Get node names
kubectl get nodes -o jsonpath='{.items[*].metadata.name}'

# Get container images
kubectl get pods -o jsonpath='{.items[*].spec.containers[*].image}'

# Get resource requests
kubectl get pods -o jsonpath='{.items[*].spec.containers[*].resources.requests}'

# Custom columns
kubectl get pods -o custom-columns=NAME:.metadata.name,STATUS:.status.phase,IP:.status.podIP
```

---

## Useful Aliases

```bash
# Add to ~/.bashrc or ~/.zshrc
alias k='kubectl'
alias kgp='kubectl get pods'
alias kgs='kubectl get svc'
alias kgd='kubectl get deployments'
alias kd='kubectl describe'
alias kl='kubectl logs'
alias kx='kubectl exec -it'
alias ka='kubectl apply -f'
alias kdel='kubectl delete'

# OpenShift
alias o='oc'
alias ogp='oc get pods'
alias ol='oc logs'
```

---

## Environment Variables

### Common Kubernetes Variables

```bash
KUBECONFIG=~/.kube/config
KUBERNETES_SERVICE_HOST=kubernetes.default.svc
KUBERNETES_SERVICE_PORT=443
```

### Useful in Scripts

```bash
NAMESPACE=${NAMESPACE:-default}
DEPLOYMENT_NAME=${DEPLOYMENT_NAME:-myapp}
IMAGE=${IMAGE:-myapp:latest}
REPLICAS=${REPLICAS:-3}
```

---

## Exit Codes

- 0: Success
- 1: General error
- 2: Misuse of shell command
- 126: Command cannot execute
- 127: Command not found
- 130: Terminated by Ctrl+C
- 137: Killed (SIGKILL) - often OOM
- 143: Terminated (SIGTERM)

---

## Pod Lifecycle Phases

- **Pending**: Accepted but not scheduled
- **Running**: Bound to node, containers running
- **Succeeded**: All containers terminated successfully
- **Failed**: At least one container failed
- **Unknown**: Cannot determine state

---

## Container States

- **Waiting**: Not running yet
- **Running**: Executing without issues
- **Terminated**: Finished execution or failed

---

## Service Types

1. **ClusterIP**: Internal cluster access (default)
2. **NodePort**: Exposes on each node's IP
3. **LoadBalancer**: Cloud provider load balancer
4. **ExternalName**: Maps to DNS name

---

## Storage Access Modes

- **ReadWriteOnce (RWO)**: Single node read-write
- **ReadOnlyMany (ROX)**: Multiple nodes read-only
- **ReadWriteMany (RWX)**: Multiple nodes read-write

---

## Deployment Strategies

### Rolling Update

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

### Recreate

```yaml
strategy:
  type: Recreate
```

---

## Network Policy Types

- **Ingress**: Incoming traffic to pods
- **Egress**: Outgoing traffic from pods

---

## RBAC Resources

- **Role**: Namespace-scoped permissions
- **ClusterRole**: Cluster-wide permissions
- **RoleBinding**: Binds Role to subjects
- **ClusterRoleBinding**: Binds ClusterRole to subjects

---

## Common Annotations

```yaml
annotations:
  kubernetes.io/change-cause: "Update to version 2.0"
  prometheus.io/scrape: "true"
  prometheus.io/port: "9090"
  nginx.ingress.kubernetes.io/rewrite-target: /
```

---

## Useful One-Liners

```bash
# Delete all evicted pods
kubectl get pods --all-namespaces -o json | jq -r '.items[] | select(.status.reason=="Evicted") | "kubectl delete pod \(.metadata.name) -n \(.metadata.namespace)"' | sh

# Get pods sorted by restart count
kubectl get pods --sort-by='.status.containerStatuses[0].restartCount'

# Get pods not running
kubectl get pods --field-selector=status.phase!=Running

# Get pod resource usage
kubectl top pods --sort-by=memory

# Watch pod status
watch kubectl get pods

# Get all images used in cluster
kubectl get pods --all-namespaces -o jsonpath="{.items[*].spec.containers[*].image}" | tr -s '[[:space:]]' '\n' | sort | uniq

# Count pods per node
kubectl get pods --all-namespaces -o json | jq '.items | group_by(.spec.nodeName) | map({node: .[0].spec.nodeName, count: length})'
```

---

## Key Concepts to Remember

### Kubernetes Architecture

- Control Plane: API Server, etcd, Scheduler, Controller Manager
- Node: kubelet, kube-proxy, Container Runtime
- Add-ons: DNS, Dashboard, Monitoring

### Core Objects

- Pod: Smallest deployable unit
- Deployment: Manages ReplicaSets
- Service: Network abstraction
- ConfigMap/Secret: Configuration management
- Volume: Storage abstraction

### Networking

- Every pod gets its own IP
- Pods can communicate without NAT
- Services provide stable endpoints
- Ingress manages external access

### Security

- RBAC for access control
- Network Policies for traffic control
- Pod Security Standards
- Secrets for sensitive data

### Best Practices

- Set resource requests and limits
- Use health checks
- Implement monitoring and logging
- Follow GitOps principles
- Document everything
- Test in non-production first

---
