---
description: Prepare for Kubernetes and OpenShift interviews with practical answers, troubleshooting scenarios, architecture explanations, security notes, and command examples.
---

# Kubernetes and OpenShift Interview Questions Handbook

This guide is designed to help you answer Kubernetes and OpenShift interview questions with clarity, depth, and confidence.

Use it in three ways:

- Read the model answers to build your technical understanding
- Practice answering aloud in your own words
- Use the checklists to identify weak areas before interviews

!!! tip "Best interview strategy"
    Do not try to sound encyclopedic. Strong answers usually follow this pattern: definition -> when to use it -> how it works -> one real-world example -> one operational caution.

## Interview Readiness Checklist

Before your interview, make sure you can explain these topics without reading notes:

- Control plane vs node components
- Pod, Deployment, StatefulSet, DaemonSet, and Job
- Services, Ingress, DNS, and CNI basics
- ConfigMaps, Secrets, probes, requests, and limits
- Rolling updates, rollback, canary, and blue-green concepts
- Persistent volumes, claims, and storage classes
- RBAC, service accounts, network policies, and security contexts
- `kubectl` troubleshooting flow for pods, nodes, and networking
- GitOps, CI/CD, and image promotion strategy
- OpenShift basics such as Routes, SCCs, Projects, and S2I

## How to Answer Well

### Strong answer structure

1. Start with a one-line definition.
2. Explain the purpose in production terms.
3. Describe the moving parts.
4. Give a simple example or troubleshooting case.
5. End with one tradeoff, limitation, or best practice.

### Example answer pattern

If asked about Deployments, a strong answer sounds like this:

> "A Deployment is a Kubernetes controller for managing stateless workloads. It maintains the desired number of pod replicas, supports rolling updates and rollback, and is usually used for web applications or APIs. In practice, I pair it with readiness probes, resource requests, and a Service so rollouts stay safe."

## Most Important Advice

- Prefer precise, calm answers over long answers
- If you do not know something, say what you do know and how you would verify it
- Use production language such as rollback, reconciliation, readiness, observability, and blast radius
- Avoid outdated habits like using `:latest` in examples unless the interviewer asks specifically about anti-patterns

## 1. Kubernetes Architecture & Fundamentals

### Q1: Explain the Kubernetes architecture and its main components.

**Answer:**
Kubernetes follows a control-plane and worker-node architecture:

**Control Plane Components:**
- **API Server**: Front-end for Kubernetes, exposes REST API, handles authentication/authorization
- **etcd**: Distributed key-value store, stores all cluster data
- **Scheduler**: Assigns pods to nodes based on resource requirements and constraints
- **Controller Manager**: Runs controller processes (Node, Replication, Endpoints, Service Account controllers)
- **Cloud Controller Manager**: Integrates with cloud provider APIs

**Node Components:**
- **kubelet**: Agent on each node, ensures containers are running in pods
- **kube-proxy**: Network proxy, maintains network rules for pod communication
- **Container Runtime**: Runs containers (Docker, containerd, CRI-O)

**Add-ons:**
- DNS (CoreDNS)
- Optional web UI such as Kubernetes Dashboard
- Monitoring (Prometheus)
- Logging (EFK stack)

---

### Q2: What is the difference between a Pod and a Container?

**Answer:**
- **Container**: Single running instance of an application with its dependencies
- **Pod**: Smallest deployable unit in Kubernetes, can contain one or more containers

**Key Points:**
- Pods share network namespace (same IP, can communicate via localhost)
- Pods share storage volumes
- Containers in a pod are co-located and co-scheduled
- Common pattern: Main container + sidecar containers (logging, monitoring, proxies)

**Example Use Case:**
```yaml
# Pod with main app + logging sidecar
spec:
  containers:
  - name: app
    image: myapp:1.0
  - name: log-forwarder
    image: fluentd:v1.17
```

---

### Q3: Explain the difference between Deployment, StatefulSet, and DaemonSet.

**Answer:**

**Deployment:**
- For stateless applications
- Pods are interchangeable
- Random pod names (myapp-5d4b8c7f9-abc12)
- No guaranteed ordering
- Use cases: Web servers, APIs, microservices

**StatefulSet:**
- For stateful applications
- Stable network identities (myapp-0, myapp-1, myapp-2)
- Ordered deployment and scaling
- Persistent storage per pod
- Use cases: Databases, message queues, distributed systems

**DaemonSet:**
- Ensures one pod per node (or selected nodes)
- Automatically adds pods to new nodes
- Use cases: Log collectors, monitoring agents, network plugins

**Example:**
```yaml
# DaemonSet for node monitoring
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-exporter
spec:
  selector:
    matchLabels:
      app: node-exporter
  template:
    spec:
      containers:
      - name: node-exporter
        image: prom/node-exporter
```

---

### Q4: What are the different types of Services in Kubernetes?

**Answer:**

**1. ClusterIP (Default):**
- Internal cluster access only
- Virtual IP accessible within cluster
- Use case: Internal microservices communication

**2. NodePort:**
- Exposes service on each node's IP at a static port (30000-32767)
- Accessible from outside cluster via NodeIP:NodePort
- Use case: Development, testing, or when LoadBalancer not available

**3. LoadBalancer:**
- Creates external load balancer (cloud provider)
- Assigns external IP
- Use case: Production external access

**4. ExternalName:**
- Maps service to DNS name
- No proxying, returns CNAME record
- Use case: Accessing external services

**Example:**
```yaml
# LoadBalancer service
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  type: LoadBalancer
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080
```

---

### Q5: Explain Kubernetes networking model.

**Answer:**

**Core Principles:**
1. Every pod gets its own IP address
2. Pods can communicate with all other pods without NAT
3. Agents on a node can communicate with all pods on that node

**Components:**
- **CNI (Container Network Interface)**: Plugin-based networking
- **kube-proxy**: Implements service abstraction, maintains iptables/IPVS rules
- **DNS**: Service discovery via CoreDNS

**Common CNI Plugins:**
- Calico: L3 networking, network policies
- Flannel: Simple overlay network
- Weave: Mesh networking
- Cilium: eBPF-based networking

**Service Communication:**
```
Pod A → Service (ClusterIP) → kube-proxy → Pod B
```

---

## 2. OpenShift Specific Questions

### Q6: What are the key differences between OpenShift and Kubernetes?

**Answer:**

**OpenShift Additions:**
1. **Security**: Security Context Constraints (SCCs) - more granular than PSPs
2. **Developer Tools**: Source-to-Image (S2I), built-in CI/CD
3. **Routing**: Routes (predating Ingress), integrated HAProxy router
4. **Image Registry**: Built-in container registry
5. **Projects**: Enhanced namespaces with additional features
6. **Web Console**: More feature-rich UI
7. **Operators**: Extensive operator ecosystem
8. **Enterprise Support**: Red Hat support and lifecycle management

**Example - OpenShift Route:**
```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: myapp
spec:
  host: myapp.apps.cluster.example.com
  to:
    kind: Service
    name: myapp-service
  tls:
    termination: edge
```

---

### Q7: Explain Security Context Constraints (SCCs) in OpenShift.

**Answer:**

SCCs control what pods can do:
- User/group IDs containers can run as
- Capabilities containers can use
- Volume types that can be mounted
- Host network/ports access
- SELinux context

**Default SCCs:**
- **restricted**: Most secure, default for most pods
- **anyuid**: Run as any UID
- **privileged**: Full access (use sparingly)
- **hostnetwork**: Host network access
- **hostmount-anyuid**: Host volumes + any UID

**Granting SCC:**
```bash
# Add SCC to service account
oc adm policy add-scc-to-user anyuid -z myapp-sa

# Check which SCC a pod is using
oc describe pod myapp | grep scc
```

**Custom SCC Example:**
```yaml
apiVersion: security.openshift.io/v1
kind: SecurityContextConstraints
metadata:
  name: custom-scc
allowPrivilegedContainer: false
runAsUser:
  type: MustRunAsRange
  uidRangeMin: 1000
  uidRangeMax: 65535
seLinuxContext:
  type: MustRunAs
```

---

### Q8: What is Source-to-Image (S2I) in OpenShift?

**Answer:**

S2I is a build strategy that:
1. Takes source code from Git
2. Injects it into a builder image
3. Produces a new container image
4. No Dockerfile needed

**Benefits:**
- Simplified builds for developers
- Standardized build process
- Security scanning built-in
- Incremental builds support
- Reproducible builds

**Example:**
```bash
# Create app from Git repo
oc new-app nodejs:16~https://github.com/myorg/myapp.git

# Trigger build
oc start-build myapp

# Follow build logs
oc logs -f bc/myapp
```

**BuildConfig:**
```yaml
apiVersion: build.openshift.io/v1
kind: BuildConfig
metadata:
  name: myapp
spec:
  source:
    type: Git
    git:
      uri: https://github.com/myorg/myapp.git
  strategy:
    type: Source
    sourceStrategy:
      from:
        kind: ImageStreamTag
        name: nodejs:16
  output:
    to:
      kind: ImageStreamTag
      name: myapp:1.0.0
```

---

## 3. CI/CD and DevOps Questions

### Q9: Describe your approach to implementing CI/CD for Kubernetes.

**Answer:**

**Pipeline Stages:**

1. **Source Control**
   - Git repository with branching strategy
   - Feature branches, main/develop branches
   - Pull request workflow

2. **Build**
   - Automated on commit/PR
   - Docker image build
   - Semantic versioning
   - Image tagging strategy

3. **Test**
   - Unit tests
   - Integration tests
   - Security scanning (Trivy, Snyk)
   - Code quality checks (SonarQube)

4. **Deploy**
   - Dev: Automatic on merge
   - Staging: Automatic with smoke tests
   - Production: Manual approval + automated deployment

5. **Monitor**
   - Prometheus metrics
   - Grafana dashboards
   - Alert manager
   - Log aggregation (EFK)

**Tools Used:**
- Jenkins/Tekton/GitHub Actions for pipeline
- ArgoCD for GitOps
- Helm/Kustomize for templating
- Vault for secrets management

**Example Jenkins Pipeline:**
```groovy
pipeline {
    stages {
        stage('Build') {
            steps {
                sh 'docker build -t myapp:${BUILD_NUMBER} .'
            }
        }
        stage('Test') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        sh 'npm test'
                    }
                }
                stage('Security Scan') {
                    steps {
                        sh 'trivy image myapp:${BUILD_NUMBER}'
                    }
                }
            }
        }
        stage('Deploy to Dev') {
            steps {
                sh 'kubectl set image deployment/myapp myapp=myapp:${BUILD_NUMBER} -n dev'
            }
        }
    }
}
```

---

### Q10: How do you implement zero-downtime deployments?

**Answer:**

**Strategies:**

**1. Rolling Update (Default):**
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1        # Max pods above desired count
    maxUnavailable: 0  # Ensure no downtime
```

**2. Blue-Green Deployment:**
- Deploy new version (green) alongside old (blue)
- Test green environment
- Switch traffic by updating service selector
- Keep blue for quick rollback

**3. Canary Deployment:**
- Deploy new version to small subset (10%)
- Monitor metrics and errors
- Gradually increase traffic
- Rollback if issues detected

**Key Requirements:**
- Proper readiness probes
- Health checks
- Connection draining
- Database migrations (backward compatible)
- Feature flags for gradual rollout

**Example with Readiness Probe:**
```yaml
readinessProbe:
  httpGet:
    path: /health/ready
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 5
  successThreshold: 1
  failureThreshold: 3
```

---

### Q11: Explain your experience with GitOps and ArgoCD.

**Answer:**

**GitOps Principles:**
1. Git as single source of truth
2. Declarative infrastructure
3. Automated synchronization
4. Continuous reconciliation

**ArgoCD Implementation:**

**Application Structure:**
```
repo/
├── apps/
│   ├── dev/
│   ├── staging/
│   └── production/
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── kustomization.yaml
└── overlays/
    ├── dev/
    ├── staging/
    └── production/
```

**ArgoCD Application:**
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp-prod
spec:
  project: default
  source:
    repoURL: https://github.com/myorg/k8s-configs
    targetRevision: HEAD
    path: apps/production
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

**Benefits:**
- Audit trail (Git history)
- Easy rollback (Git revert)
- Disaster recovery
- Multi-cluster management
- Declarative configuration

---

## 4. Troubleshooting Questions

### Q12: Walk me through debugging a pod that's in CrashLoopBackOff.

**Answer:**

**Step-by-Step Process:**

1. **Check Pod Status:**
```bash
kubectl get pods
kubectl describe pod myapp-abc123
```

2. **Review Events:**
Look for:
- Image pull errors
- Resource constraints
- Failed health checks
- Permission issues

3. **Check Logs:**
```bash
# Current logs
kubectl logs myapp-abc123

# Previous container logs
kubectl logs myapp-abc123 --previous

# Specific container
kubectl logs myapp-abc123 -c container-name
```

4. **Common Causes & Solutions:**

**Application Error:**
- Check application logs
- Verify environment variables
- Check ConfigMaps/Secrets exist
- Test locally with same config

**Failed Liveness Probe:**
```yaml
# Increase delays
livenessProbe:
  initialDelaySeconds: 60  # Give app time to start
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

**Permission Issues:**
```bash
# Check security context
kubectl get pod myapp-abc123 -o yaml | grep -A 10 securityContext

# For OpenShift
oc adm policy add-scc-to-user anyuid -z myapp-sa
```

**Missing Dependencies:**
- Verify database connectivity
- Check external service availability
- Validate API endpoints

5. **Debug with Shell:**
```bash
# Run debug container
kubectl debug myapp-abc123 -it --image=busybox

# Or create test pod
kubectl run test --rm -it --image=myapp:1.0.0 -- /bin/bash
```

---

### Q13: How do you troubleshoot networking issues in Kubernetes?

**Answer:**

**Systematic Approach:**

**1. Verify Service and Endpoints:**
```bash
# Check service
kubectl get svc myapp-service
kubectl describe svc myapp-service

# Check endpoints
kubectl get endpoints myapp-service
```

If no endpoints:
- Pod labels don't match service selector
- Pods not ready (failed readiness probe)

**2. Test DNS Resolution:**
```bash
# From within cluster
kubectl run test --rm -it --image=busybox -- nslookup myapp-service

# Check CoreDNS
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns
```

**3. Test Connectivity:**
```bash
# Test service from pod
kubectl run test --rm -it --image=curlimages/curl -- \
  curl http://myapp-service.default.svc.cluster.local

# Test pod directly
kubectl run test --rm -it --image=curlimages/curl -- \
  curl http://10.244.1.5:8080
```

**4. Check Network Policies:**
```bash
kubectl get networkpolicy
kubectl describe networkpolicy myapp-policy
```

**5. Verify CNI Plugin:**
```bash
# Check CNI pods
kubectl get pods -n kube-system | grep -E 'calico|flannel|weave'

# Check node network
kubectl get nodes -o wide
```

**6. Check Ingress:**
```bash
kubectl get ingress
kubectl describe ingress myapp-ingress
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
```

**Common Issues:**
- Label mismatch between service and pods
- Port mismatch (service port vs container port)
- Network policy blocking traffic
- DNS resolution failure
- Ingress misconfiguration
- Load balancer not provisioned

---

### Q14: Describe a complex production issue you resolved.

**Answer (STAR Method):**

**Situation:**
Production Kubernetes cluster experienced intermittent 503 errors affecting 15% of requests during peak hours. Application was a microservices-based e-commerce platform handling 10K requests/second.

**Task:**
Identify root cause and implement solution with zero downtime while maintaining SLA of 99.9% uptime.

**Action:**

1. **Initial Investigation:**
   - Checked application logs - no errors
   - Reviewed metrics - CPU/memory normal
   - Examined ingress controller logs - found connection timeouts

2. **Deep Dive:**
   - Analyzed pod distribution - uneven across nodes
   - Checked HPA metrics - scaling working correctly
   - Discovered connection pool exhaustion in ingress controller

3. **Root Cause:**
   - Ingress controller had default connection limits (1024)
   - During peak traffic, connections exceeded limit
   - New connections were rejected causing 503s

4. **Solution Implemented:**
   ```yaml
   # Increased ingress controller resources
   resources:
     requests:
       cpu: "2"
       memory: "2Gi"
     limits:
       cpu: "4"
       memory: "4Gi"
   
   # Tuned connection settings
   config:
     worker-connections: "16384"
     max-worker-connections: "32768"
     upstream-keepalive-connections: "320"
   ```

5. **Additional Improvements:**
   - Implemented pod anti-affinity for better distribution
   - Added HPA for ingress controller
   - Set up alerts for connection pool usage
   - Implemented connection draining

**Result:**
- 503 errors reduced to 0%
- Response time improved by 25%
- Successfully handled 2x traffic during Black Friday
- Documented runbook for future reference
- Shared learnings with team

**Lessons Learned:**
- Monitor connection pool metrics
- Load test before production
- Implement proper resource limits
- Have rollback plan ready

---

## 5. Security Questions

### Q15: How do you implement security best practices in Kubernetes?

**Answer:**

**1. Pod Security:**
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 2000
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop:
    - ALL
    add:
    - NET_BIND_SERVICE
```

**2. Network Policies:**
```yaml
# Default deny all
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress

# Allow specific traffic
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
spec:
  podSelector:
    matchLabels:
      app: backend
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - port: 8080
```

**3. RBAC:**
```yaml
# Principle of least privilege
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list"]
```

**4. Secrets Management:**
- Use external secret managers (Vault, AWS Secrets Manager)
- Enable encryption at rest for etcd
- Rotate secrets regularly
- Use Sealed Secrets for GitOps

**5. Image Security:**
- Scan images for vulnerabilities (Trivy, Clair)
- Use trusted registries
- Implement image signing
- Use specific image tags (not :latest)
- Regular image updates

**6. Audit Logging:**
```yaml
# Enable audit logging
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
- level: Metadata
  resources:
  - group: ""
    resources: ["secrets", "configmaps"]
```

**7. Additional Measures:**
- Enable Pod Security Standards
- Implement admission controllers
- Regular security audits
- Vulnerability scanning
- Compliance checks (CIS benchmarks)
- Network segmentation
- TLS everywhere

---

### Q16: How do you manage secrets in Kubernetes?

**Answer:**

**Approaches:**

**1. Kubernetes Secrets (Basic):**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
type: Opaque
data:
  username: YWRtaW4=  # base64 encoded
  password: cGFzc3dvcmQxMjM=
```

**Limitations:**
- Base64 encoding (not encryption)
- Stored in etcd (enable encryption at rest)
- Visible to anyone with access

**2. External Secret Managers:**

**HashiCorp Vault:**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  serviceAccountName: myapp
  containers:
  - name: myapp
    image: myapp:1.0
    env:
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: vault-secret
          key: password
```

**AWS Secrets Manager:**
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-secret
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: db-secret
  data:
  - secretKey: password
    remoteRef:
      key: prod/db/password
```

**3. Sealed Secrets (GitOps):**
```bash
# Encrypt secret
kubeseal --format yaml < secret.yaml > sealed-secret.yaml

# Commit to Git
git add sealed-secret.yaml
git commit -m "Add sealed secret"

# Controller decrypts in cluster
```

**4. Best Practices:**
- Never commit secrets to Git
- Use RBAC to limit access
- Rotate secrets regularly
- Audit secret access
- Use short-lived credentials
- Implement secret scanning in CI/CD
- Encrypt etcd at rest
- Use separate secrets per environment

---

## 6. Performance and Scaling Questions

### Q17: How do you optimize Kubernetes cluster performance?

**Answer:**

**1. Resource Management:**
```yaml
# Set appropriate requests and limits
resources:
  requests:
    cpu: "500m"
    memory: "512Mi"
  limits:
    cpu: "1000m"
    memory: "1Gi"
```

**2. Horizontal Pod Autoscaling:**
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
  minReplicas: 3
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
```

**3. Cluster Autoscaling:**
- Enable cluster autoscaler
- Set appropriate node pool sizes
- Use multiple node pools for different workloads

**4. Pod Disruption Budgets:**
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: myapp-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: myapp
```

**5. Affinity and Anti-Affinity:**
```yaml
# Spread pods across nodes
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        labelSelector:
          matchLabels:
            app: myapp
        topologyKey: kubernetes.io/hostname
```

**6. Resource Quotas:**
```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
  namespace: production
spec:
  hard:
    requests.cpu: "20"
    requests.memory: "40Gi"
    limits.cpu: "40"
    limits.memory: "80Gi"
```

**7. Monitoring and Optimization:**
- Use Prometheus for metrics
- Implement custom metrics for HPA
- Monitor node resource usage
- Optimize container images (multi-stage builds)
- Use caching strategies
- Implement connection pooling
- Tune garbage collection

**8. Network Optimization:**
- Use service mesh for advanced routing
- Implement caching layers
- Use CDN for static content
- Optimize DNS resolution
- Use persistent connections

---

### Q18: Explain your approach to capacity planning.

**Answer:**

**1. Current State Analysis:**
```bash
# Resource usage
kubectl top nodes
kubectl top pods --all-namespaces

# Resource requests/limits
kubectl describe nodes | grep -A 5 "Allocated resources"
```

**2. Metrics Collection:**
- CPU utilization trends
- Memory usage patterns
- Network throughput
- Storage IOPS
- Request rates
- Response times

**3. Growth Projection:**
- Historical data analysis
- Business growth forecasts
- Seasonal patterns
- Marketing campaigns impact

**4. Capacity Calculation:**
```
Required Capacity = (Current Usage × Growth Factor) + Buffer

Example:
Current: 100 pods, 50% CPU usage
Growth: 50% increase expected
Buffer: 20% for spikes

Required = (100 × 1.5) + (150 × 0.2) = 180 pods
```

**5. Resource Allocation:**
- Node sizing (CPU, memory, storage)
- Number of nodes needed
- Node pool configuration
- Multi-AZ distribution

**6. Cost Optimization:**
- Right-size workloads
- Use spot/preemptible instances
- Implement autoscaling
- Schedule non-critical workloads
- Use reserved instances for baseline

**7. Monitoring and Adjustment:**
- Set up alerts for capacity thresholds
- Regular capacity reviews
- Adjust based on actual usage
- Plan for peak periods

---

## 7. Agile and Collaboration Questions

### Q19: How do you work in an Agile environment with Kubernetes?

**Answer:**

**Sprint Planning:**
- Break down infrastructure tasks into user stories
- Estimate story points for K8s work
- Prioritize based on business value
- Include DevOps tasks in sprint backlog

**Daily Standups:**
- Share progress on deployments
- Discuss blockers (cluster issues, resource constraints)
- Coordinate with developers on deployment needs

**Sprint Review:**
- Demo new features deployed
- Show monitoring dashboards
- Present performance improvements
- Discuss deployment metrics

**Retrospectives:**
- Review deployment incidents
- Discuss what went well/poorly
- Identify process improvements
- Update runbooks

**Tools:**
- **Jira**: Track stories, bugs, tasks
- **Confluence**: Documentation, runbooks
- **Slack**: Team communication
- **Git**: Version control, PR reviews

**Example Jira Workflow:**
```
To Do → In Progress → Code Review → Testing → Done

Labels: kubernetes, deployment, hotfix, tech-debt
Epic: Q1 Infrastructure Improvements
Story Points: Fibonacci scale (1, 2, 3, 5, 8)
```

**Collaboration Practices:**
- Pair programming for complex deployments
- Code reviews for all changes
- Knowledge sharing sessions
- Documentation as code
- Blameless postmortems

---

### Q20: How do you handle on-call and incident management?

**Answer:**

**On-Call Preparation:**
- Maintain updated runbooks
- Access to all necessary tools
- Escalation procedures documented
- Recent incident reviews

**Incident Response Process:**

**1. Detection:**
- Automated alerts (PagerDuty, Opsgenie)
- Monitoring dashboards
- User reports

**2. Triage:**
- Assess severity (P0-P4)
- Determine impact
- Engage appropriate team members

**3. Investigation:**
```bash
# Quick checks
kubectl get pods --all-namespaces
kubectl get nodes
kubectl top nodes
kubectl get events --sort-by=.metadata.creationTimestamp

# Detailed investigation
kubectl describe pod <failing-pod>
kubectl logs <failing-pod>
kubectl get events -n <namespace>
```

**4. Communication:**
- Update incident channel
- Notify stakeholders
- Provide regular updates
- Set expectations

**5. Resolution:**
- Implement fix
- Verify solution
- Monitor for recurrence
- Document actions taken

**6. Post-Incident:**
- Write postmortem (blameless)
- Identify root cause
- Create action items
- Update runbooks
- Share learnings

**Example Postmortem Structure:**
```markdown
# Incident: Production API Outage
Date: 2024-01-15
Duration: 45 minutes
Severity: P1

## Impact
- 503 errors for 15% of requests
- Revenue impact: $50K

## Timeline
14:30 - Alert triggered
14:35 - On-call engineer engaged
14:45 - Root cause identified
15:00 - Fix deployed
15:15 - Verified resolution

## Root Cause
Memory leak in application causing OOMKilled

## Resolution
- Increased memory limits
- Deployed hotfix
- Implemented memory monitoring

## Action Items
1. Add memory leak detection
2. Improve alerting thresholds
3. Update deployment checklist
4. Schedule code review

## Lessons Learned
- Need better memory profiling
- Earlier detection possible
- Communication was effective
```

---

## Quick Interview Tips

### STAR Method Template
**Situation**: Set the context
**Task**: Explain your responsibility
**Action**: Describe what you did
**Result**: Share the outcome

### Key Points to Emphasize
- 8-10 years experience level
- Production experience
- Problem-solving approach
- Team collaboration
- Continuous learning
- Best practices adherence

### Questions to Ask Interviewer
1. What's the current Kubernetes setup?
2. What are the main challenges?
3. What's the team structure?
4. What's the deployment frequency?
5. What monitoring tools are used?
6. What's the on-call rotation?
7. What's the tech stack?
8. What are the growth plans?

### Red Flags to Avoid
- "I don't know" without follow-up
- Blaming others for failures
- Not admitting mistakes
- Lack of curiosity
- No questions for interviewer
- Overconfidence without substance

### Confidence Builders
- Prepare specific examples
- Know your numbers (cluster sizes, deployment times)
- Practice explaining concepts simply
- Review recent Kubernetes releases
- Be honest about what you don't know
- Show willingness to learn
