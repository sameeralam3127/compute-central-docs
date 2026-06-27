---
description: Troubleshoot Kubernetes and OpenShift issues including pending pods, CrashLoopBackOff, image pulls, services, DNS, storage, rollouts, RBAC, and node problems.
---

# Kubernetes and OpenShift Troubleshooting Guide

## 1. Systematic Troubleshooting Approach

### The 5-Step Method
```
1. IDENTIFY → What is the problem?
2. GATHER  → Collect relevant information
3. ANALYZE → Examine logs, events, metrics
4. ISOLATE → Narrow down the root cause
5. RESOLVE → Fix and verify the solution
```

### Troubleshooting Checklist
- [ ] Check pod status and events
- [ ] Review container logs
- [ ] Verify resource availability
- [ ] Check network connectivity
- [ ] Validate configurations
- [ ] Review RBAC permissions
- [ ] Check node health
- [ ] Verify storage availability

---

## 2. Pod Issues

### Pod Stuck in Pending State

**Symptoms:**
```bash
$ kubectl get pods
NAME                    READY   STATUS    RESTARTS   AGE
myapp-5d4b8c7f9-abc12   0/1     Pending   0          5m
```

**Diagnosis:**
```bash
# Check pod events
kubectl describe pod myapp-5d4b8c7f9-abc12

# Common causes in events:
# - "Insufficient cpu/memory"
# - "No nodes available"
# - "PersistentVolumeClaim not found"
# - "ImagePullBackOff"
```

**Solutions:**

**1. Insufficient Resources:**
```bash
# Check node resources
kubectl top nodes
kubectl describe nodes

# Check resource requests
kubectl get pod myapp-5d4b8c7f9-abc12 -o yaml | grep -A 5 resources

# Solutions:
# - Add more nodes
# - Reduce resource requests
# - Delete unused pods
# - Scale down other deployments
```

**2. Node Selector/Affinity Issues:**
```bash
# Check node labels
kubectl get nodes --show-labels

# Check pod node selector
kubectl get pod myapp-5d4b8c7f9-abc12 -o yaml | grep -A 5 nodeSelector

# Solution: Add required labels to nodes
kubectl label nodes node1 disktype=ssd
```

**3. PVC Not Bound:**
```bash
# Check PVC status
kubectl get pvc

# Check PV availability
kubectl get pv

# Solution: Create PV or fix storage class
```

### CrashLoopBackOff

**Symptoms:**
```bash
$ kubectl get pods
NAME                    READY   STATUS             RESTARTS   AGE
myapp-5d4b8c7f9-abc12   0/1     CrashLoopBackOff   5          10m
```

**Diagnosis:**
```bash
# Check logs
kubectl logs myapp-5d4b8c7f9-abc12
kubectl logs myapp-5d4b8c7f9-abc12 --previous

# Check events
kubectl describe pod myapp-5d4b8c7f9-abc12

# Common causes:
# - Application error
# - Missing dependencies
# - Configuration error
# - Failed health checks
# - Insufficient permissions
```

**Solutions:**

**1. Application Error:**
```bash
# Debug with shell access
kubectl run debug --rm -it --image=busybox -- sh

# Or debug the actual pod
kubectl debug myapp-5d4b8c7f9-abc12 -it --image=busybox

# Check application configuration
kubectl get configmap myapp-config -o yaml
kubectl get secret myapp-secret -o yaml
```

**2. Failed Liveness Probe:**
```yaml
# Adjust probe settings
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 60  # Increase if app takes time to start
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

**3. Permission Issues:**
```bash
# Check security context
kubectl get pod myapp-5d4b8c7f9-abc12 -o yaml | grep -A 10 securityContext

# For OpenShift, check SCC
oc describe pod myapp-5d4b8c7f9-abc12 | grep scc
```

### ImagePullBackOff

**Symptoms:**
```bash
$ kubectl get pods
NAME                    READY   STATUS             RESTARTS   AGE
myapp-5d4b8c7f9-abc12   0/1     ImagePullBackOff   0          2m
```

**Diagnosis:**
```bash
# Check events
kubectl describe pod myapp-5d4b8c7f9-abc12

# Common errors:
# - "Failed to pull image"
# - "manifest unknown"
# - "unauthorized"
# - "connection refused"
```

**Solutions:**

**1. Image Doesn't Exist:**
```bash
# Verify image exists
docker pull myapp:v1.0

# Check image name in deployment
kubectl get deployment myapp -o yaml | grep image:

# Fix: Update to correct image
kubectl set image deployment/myapp myapp=myapp:v1.0
```

**2. Authentication Required:**
```bash
# Create docker registry secret
kubectl create secret docker-registry regcred \
  --docker-server=docker.io \
  --docker-username=myuser \
  --docker-password=mypass \
  --docker-email=myemail@example.com

# Add to deployment
kubectl patch deployment myapp -p '
{
  "spec": {
    "template": {
      "spec": {
        "imagePullSecrets": [{"name": "regcred"}]
      }
    }
  }
}'
```

**3. Network Issues:**
```bash
# Test connectivity from node
ssh node1
curl -I https://registry.example.com

# Check proxy settings
kubectl get configmap -n kube-system kube-proxy -o yaml
```

### OOMKilled (Out of Memory)

**Symptoms:**
```bash
$ kubectl get pods
NAME                    READY   STATUS      RESTARTS   AGE
myapp-5d4b8c7f9-abc12   0/1     OOMKilled   3          5m
```

**Diagnosis:**
```bash
# Check memory usage
kubectl top pod myapp-5d4b8c7f9-abc12

# Check memory limits
kubectl get pod myapp-5d4b8c7f9-abc12 -o yaml | grep -A 5 resources

# Check events
kubectl describe pod myapp-5d4b8c7f9-abc12
```

**Solutions:**
```yaml
# Increase memory limits
resources:
  requests:
    memory: "512Mi"
  limits:
    memory: "1Gi"  # Increased from 512Mi

# Or investigate memory leak in application
```

---

## 3. Service and Networking Issues

### Service Not Accessible

**Diagnosis:**
```bash
# Check service
kubectl get svc myapp-service
kubectl describe svc myapp-service

# Check endpoints
kubectl get endpoints myapp-service

# If no endpoints, pods don't match selector
kubectl get pods --show-labels
kubectl get svc myapp-service -o yaml | grep selector
```

**Solutions:**

**1. Label Mismatch:**
```bash
# Fix pod labels
kubectl label pods myapp-5d4b8c7f9-abc12 app=myapp

# Or fix service selector
kubectl patch svc myapp-service -p '{"spec":{"selector":{"app":"myapp"}}}'
```

**2. Port Mismatch:**
```bash
# Check service ports
kubectl get svc myapp-service -o yaml

# Check container ports
kubectl get pod myapp-5d4b8c7f9-abc12 -o yaml | grep containerPort

# Fix service port
kubectl patch svc myapp-service -p '
{
  "spec": {
    "ports": [{
      "port": 80,
      "targetPort": 8080
    }]
  }
}'
```

**3. Network Policy Blocking:**
```bash
# Check network policies
kubectl get networkpolicy

# Test connectivity
kubectl run test --rm -it --image=busybox -- wget -O- http://myapp-service
```

### DNS Resolution Issues

**Diagnosis:**
```bash
# Test DNS from pod
kubectl run test --rm -it --image=busybox -- nslookup myapp-service

# Check CoreDNS pods
kubectl get pods -n kube-system -l k8s-app=kube-dns

# Check CoreDNS logs
kubectl logs -n kube-system -l k8s-app=kube-dns
```

**Solutions:**
```bash
# Restart CoreDNS
kubectl rollout restart deployment/coredns -n kube-system

# Check CoreDNS ConfigMap
kubectl get configmap coredns -n kube-system -o yaml

# Verify service exists
kubectl get svc myapp-service
```

### Ingress Not Working

**Diagnosis:**
```bash
# Check ingress
kubectl get ingress
kubectl describe ingress myapp-ingress

# Check ingress controller
kubectl get pods -n ingress-nginx
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx

# Test backend service
kubectl run test --rm -it --image=curlimages/curl -- \
  curl http://myapp-service.default.svc.cluster.local
```

**Solutions:**

**1. Ingress Class Missing:**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
spec:
  ingressClassName: nginx  # Add this
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

**2. DNS Not Pointing to Ingress:**
```bash
# Get ingress IP
kubectl get ingress myapp-ingress

# Verify DNS
nslookup myapp.example.com

# Update DNS A record to point to ingress IP
```

---

## 4. Storage Issues

### PVC Stuck in Pending

**Diagnosis:**
```bash
# Check PVC
kubectl get pvc
kubectl describe pvc myapp-pvc

# Check storage class
kubectl get storageclass

# Check PV availability
kubectl get pv
```

**Solutions:**

**1. No Storage Class:**
```bash
# Set default storage class
kubectl patch storageclass standard -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'

# Or specify in PVC
kubectl patch pvc myapp-pvc -p '{"spec":{"storageClassName":"standard"}}'
```

**2. No Available PV:**
```bash
# Create PV manually
kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-manual
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: /mnt/data
EOF
```

### Volume Mount Issues

**Diagnosis:**
```bash
# Check pod events
kubectl describe pod myapp-5d4b8c7f9-abc12

# Common errors:
# - "Unable to mount volumes"
# - "Volume is already attached"
# - "Permission denied"
```

**Solutions:**

**1. Volume Already Attached:**
```bash
# Find which pod is using the volume
kubectl get pods -o json | jq -r '.items[] | 
  select(.spec.volumes[]?.persistentVolumeClaim.claimName=="myapp-pvc") | 
  .metadata.name'

# Delete the old pod
kubectl delete pod <old-pod-name>
```

**2. Permission Issues:**
```yaml
# Set fsGroup in security context
securityContext:
  fsGroup: 2000
  runAsUser: 1000
```

---

## 5. Node Issues

### Node NotReady

**Diagnosis:**
```bash
# Check node status
kubectl get nodes
kubectl describe node node1

# Check node conditions
kubectl get node node1 -o yaml | grep -A 10 conditions

# SSH to node and check
ssh node1
systemctl status kubelet
journalctl -u kubelet -n 100
```

**Solutions:**

**1. Kubelet Not Running:**
```bash
# On the node
systemctl start kubelet
systemctl enable kubelet

# Check kubelet logs
journalctl -u kubelet -f
```

**2. Disk Pressure:**
```bash
# Check disk usage
df -h

# Clean up
docker system prune -a
kubectl delete pods --field-selector=status.phase=Failed -A

# Increase disk or add new node
```

**3. Network Issues:**
```bash
# Check CNI plugin
kubectl get pods -n kube-system | grep -E 'calico|flannel|weave'

# Restart CNI pods
kubectl delete pods -n kube-system -l k8s-app=calico-node
```

### High Resource Usage

**Diagnosis:**
```bash
# Check node resources
kubectl top nodes
kubectl describe node node1

# Find resource-hungry pods
kubectl top pods --all-namespaces --sort-by=memory
kubectl top pods --all-namespaces --sort-by=cpu
```

**Solutions:**
```bash
# Set resource limits
kubectl set resources deployment myapp --limits=cpu=500m,memory=512Mi

# Implement HPA
kubectl autoscale deployment myapp --min=2 --max=10 --cpu-percent=70

# Add more nodes or scale down workloads
```

---

## 6. Deployment Issues

### Rollout Stuck

**Diagnosis:**
```bash
# Check rollout status
kubectl rollout status deployment/myapp

# Check deployment
kubectl describe deployment myapp

# Check replica sets
kubectl get rs
kubectl describe rs myapp-5d4b8c7f9
```

**Solutions:**

**1. Insufficient Resources:**
```bash
# Check events
kubectl get events --sort-by=.metadata.creationTimestamp

# Scale down or add resources
kubectl scale deployment myapp --replicas=2
```

**2. Image Pull Issues:**
```bash
# Check new pods
kubectl get pods -l app=myapp

# Fix image or add pull secret
kubectl set image deployment/myapp myapp=myapp:v1.0
```

**3. Failed Readiness Probe:**
```bash
# Check pod logs
kubectl logs -l app=myapp

# Adjust probe or fix application
kubectl patch deployment myapp -p '
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "myapp",
          "readinessProbe": {
            "initialDelaySeconds": 60
          }
        }]
      }
    }
  }
}'
```

### Rollback Required

**Commands:**
```bash
# View rollout history
kubectl rollout history deployment/myapp

# Rollback to previous version
kubectl rollout undo deployment/myapp

# Rollback to specific revision
kubectl rollout undo deployment/myapp --to-revision=2

# Pause rollout
kubectl rollout pause deployment/myapp

# Resume rollout
kubectl rollout resume deployment/myapp
```

---

## 7. RBAC and Permission Issues

### Forbidden Errors

**Diagnosis:**
```bash
# Check current user
kubectl auth whoami

# Check permissions
kubectl auth can-i create pods
kubectl auth can-i create pods --as=system:serviceaccount:default:myapp-sa

# Check role bindings
kubectl get rolebindings
kubectl describe rolebinding myapp-binding
```

**Solutions:**

**1. Create Role:**
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: default
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
```

**2. Create RoleBinding:**
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: default
subjects:
- kind: ServiceAccount
  name: myapp-sa
  namespace: default
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

**3. For OpenShift SCC Issues:**
```bash
# Check SCC
oc describe pod myapp-5d4b8c7f9-abc12 | grep scc

# Add SCC to service account
oc adm policy add-scc-to-user anyuid -z myapp-sa
```

---

## 8. Performance Issues

### Slow Application Response

**Diagnosis:**
```bash
# Check resource usage
kubectl top pods
kubectl top nodes

# Check HPA status
kubectl get hpa

# Check pod distribution
kubectl get pods -o wide

# Check network latency
kubectl run test --rm -it --image=nicolaka/netshoot -- \
  ping myapp-service.default.svc.cluster.local
```

**Solutions:**

**1. Scale Up:**
```bash
# Manual scaling
kubectl scale deployment myapp --replicas=5

# Enable HPA
kubectl autoscale deployment myapp --min=3 --max=10 --cpu-percent=70
```

**2. Optimize Resources:**
```yaml
resources:
  requests:
    cpu: "500m"
    memory: "512Mi"
  limits:
    cpu: "1000m"
    memory: "1Gi"
```

**3. Add Caching:**
```yaml
# Add Redis sidecar
containers:
- name: redis
  image: redis:6
  ports:
  - containerPort: 6379
```

---

## 9. Logging and Monitoring Issues

### Missing Logs

**Diagnosis:**
```bash
# Check if pod is running
kubectl get pods

# Try different log commands
kubectl logs myapp-5d4b8c7f9-abc12
kubectl logs myapp-5d4b8c7f9-abc12 --previous
kubectl logs myapp-5d4b8c7f9-abc12 -c container-name

# Check logging infrastructure
kubectl get pods -n kube-system | grep -E 'fluentd|filebeat|logstash'
```

**Solutions:**
```bash
# Ensure application logs to stdout/stderr
# Check log rotation settings
# Verify logging agent is running
kubectl get daemonset -n kube-system
```

### Metrics Not Available

**Diagnosis:**
```bash
# Check metrics server
kubectl get deployment metrics-server -n kube-system
kubectl top nodes  # Should work if metrics server is running

# Check metrics server logs
kubectl logs -n kube-system -l k8s-app=metrics-server
```

**Solutions:**
```bash
# Install metrics server
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# For development clusters, may need to disable TLS
kubectl patch deployment metrics-server -n kube-system --type='json' \
  -p='[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}]'
```

---

## 10. Common Troubleshooting Commands

### Quick Diagnostics
```bash
# Get all resources
kubectl get all -A

# Check events
kubectl get events --sort-by=.metadata.creationTimestamp -A

# Check resource usage
kubectl top nodes
kubectl top pods -A

# Check cluster info
kubectl cluster-info
kubectl version

# Check component status
kubectl get componentstatuses

# Check API server
kubectl get --raw /healthz
kubectl get --raw /readyz
```

### Deep Dive Commands
```bash
# Get pod YAML
kubectl get pod myapp-5d4b8c7f9-abc12 -o yaml

# Get pod JSON with jq
kubectl get pod myapp-5d4b8c7f9-abc12 -o json | jq '.status'

# Watch resources
kubectl get pods -w
kubectl get events -w

# Port forward for debugging
kubectl port-forward pod/myapp-5d4b8c7f9-abc12 8080:8080

# Execute commands in pod
kubectl exec -it myapp-5d4b8c7f9-abc12 -- /bin/bash
kubectl exec myapp-5d4b8c7f9-abc12 -- env
kubectl exec myapp-5d4b8c7f9-abc12 -- cat /etc/resolv.conf

# Copy files
kubectl cp myapp-5d4b8c7f9-abc12:/app/logs/app.log ./app.log

# Debug with ephemeral container (K8s 1.23+)
kubectl debug myapp-5d4b8c7f9-abc12 -it --image=busybox
```

---

## 11. Interview Preparation - Troubleshooting

### STAR Method Examples

**Situation:** Production pods were crashing with OOMKilled errors.

**Task:** Identify root cause and implement solution without downtime.

**Action:**
1. Checked pod events and logs
2. Analyzed memory usage patterns
3. Identified memory leak in application
4. Increased memory limits temporarily
5. Worked with dev team to fix leak
6. Implemented proper resource limits and monitoring

**Result:** Zero downtime, 40% reduction in memory usage after fix.

### Common Interview Questions

**Q: Walk me through debugging a pod that won't start.**
A:
1. Check pod status: `kubectl get pods`
2. Describe pod: `kubectl describe pod <name>`
3. Check events for errors
4. Review logs: `kubectl logs <name>`
5. Check previous logs if restarting
6. Verify image exists and is pullable
7. Check resource availability
8. Verify configurations (ConfigMaps, Secrets)
9. Check RBAC/SCC permissions
10. Test with debug container if needed

**Q: How do you troubleshoot network connectivity issues?**
A:
1. Verify service endpoints exist
2. Check pod labels match service selector
3. Test DNS resolution from pod
4. Check network policies
5. Verify ingress configuration
6. Test connectivity with debug pod
7. Check CNI plugin status
8. Review firewall rules
9. Verify load balancer configuration

**Q: Describe a complex production issue you resolved.**
Be ready with a real example covering:
- Initial symptoms
- Investigation process
- Tools used
- Root cause analysis
- Solution implemented
- Prevention measures
- Lessons learned

### Troubleshooting Toolkit

**Essential Tools:**
```bash
# Debug containers
kubectl run debug --rm -it --image=nicolaka/netshoot -- bash
kubectl run debug --rm -it --image=busybox -- sh

# Useful images:
# - nicolaka/netshoot (network debugging)
# - busybox (basic utilities)
# - curlimages/curl (HTTP testing)
# - alpine (lightweight with package manager)
```

**Useful Commands:**
```bash
# Inside debug pod
nslookup service-name
ping service-name
curl http://service-name
traceroute service-name
netstat -tulpn
ss -tulpn
tcpdump -i any port 80
```

---

## Quick Reference Card

### Pod Status Meanings
- **Pending**: Waiting to be scheduled
- **ContainerCreating**: Pulling image, creating container
- **Running**: All containers running
- **Succeeded**: All containers terminated successfully
- **Failed**: At least one container failed
- **CrashLoopBackOff**: Container keeps crashing
- **ImagePullBackOff**: Cannot pull image
- **OOMKilled**: Out of memory
- **Error**: Generic error state
- **Unknown**: Cannot determine state

### Common Exit Codes
- **0**: Success
- **1**: General error
- **2**: Misuse of shell command
- **126**: Command cannot execute
- **127**: Command not found
- **130**: Terminated by Ctrl+C
- **137**: Killed (SIGKILL) - often OOM
- **143**: Terminated (SIGTERM)

### Troubleshooting Flow
```
Problem Reported
    ↓
Check Pod Status
    ↓
Describe Pod (Events)
    ↓
Check Logs
    ↓
Verify Configuration
    ↓
Check Resources
    ↓
Test Connectivity
    ↓
Implement Fix
    ↓
Verify Solution
    ↓
Document & Monitor
