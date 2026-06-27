---
description: Automate Kubernetes and OpenShift operations with shell scripts, Python helpers, backup jobs, monitoring checks, cleanup tasks, and reusable command patterns.
---

# Kubernetes and OpenShift Scripting and Automation Guide

## 1. Shell Scripting Essentials

### Kubernetes Deployment Script
```bash
#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Configuration
NAMESPACE="${NAMESPACE:-production}"
DEPLOYMENT_NAME="${DEPLOYMENT_NAME:-myapp}"
IMAGE="${IMAGE:-myapp:latest}"
REPLICAS="${REPLICAS:-3}"
TIMEOUT="${TIMEOUT:-300}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl."
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster."
        exit 1
    fi
    
    log_info "Prerequisites check passed."
}

# Create namespace if not exists
ensure_namespace() {
    log_info "Ensuring namespace ${NAMESPACE} exists..."
    
    if kubectl get namespace "${NAMESPACE}" &> /dev/null; then
        log_info "Namespace ${NAMESPACE} already exists."
    else
        kubectl create namespace "${NAMESPACE}"
        log_info "Namespace ${NAMESPACE} created."
    fi
}

# Deploy application
deploy_application() {
    log_info "Deploying ${DEPLOYMENT_NAME} to ${NAMESPACE}..."
    
    # Check if deployment exists
    if kubectl get deployment "${DEPLOYMENT_NAME}" -n "${NAMESPACE}" &> /dev/null; then
        log_info "Updating existing deployment..."
        kubectl set image deployment/"${DEPLOYMENT_NAME}" \
            "${DEPLOYMENT_NAME}=${IMAGE}" \
            -n "${NAMESPACE}"
    else
        log_info "Creating new deployment..."
        kubectl create deployment "${DEPLOYMENT_NAME}" \
            --image="${IMAGE}" \
            --replicas="${REPLICAS}" \
            -n "${NAMESPACE}"
    fi
}

# Wait for rollout
wait_for_rollout() {
    log_info "Waiting for rollout to complete (timeout: ${TIMEOUT}s)..."
    
    if kubectl rollout status deployment/"${DEPLOYMENT_NAME}" \
        -n "${NAMESPACE}" \
        --timeout="${TIMEOUT}s"; then
        log_info "Rollout completed successfully."
    else
        log_error "Rollout failed or timed out."
        return 1
    fi
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    local ready_replicas=$(kubectl get deployment "${DEPLOYMENT_NAME}" \
        -n "${NAMESPACE}" \
        -o jsonpath='{.status.readyReplicas}')
    
    local desired_replicas=$(kubectl get deployment "${DEPLOYMENT_NAME}" \
        -n "${NAMESPACE}" \
        -o jsonpath='{.spec.replicas}')
    
    if [ "${ready_replicas}" -eq "${desired_replicas}" ]; then
        log_info "All ${ready_replicas} replicas are ready."
        return 0
    else
        log_error "Only ${ready_replicas}/${desired_replicas} replicas are ready."
        return 1
    fi
}

# Rollback on failure
rollback() {
    log_warn "Rolling back deployment..."
    kubectl rollout undo deployment/"${DEPLOYMENT_NAME}" -n "${NAMESPACE}"
    log_info "Rollback initiated."
}

# Main execution
main() {
    log_info "Starting deployment process..."
    
    check_prerequisites
    ensure_namespace
    deploy_application
    
    if wait_for_rollout && verify_deployment; then
        log_info "Deployment successful!"
        exit 0
    else
        log_error "Deployment failed!"
        rollback
        exit 1
    fi
}

# Trap errors and cleanup
trap 'log_error "Script failed at line $LINENO"' ERR

# Run main function
main "$@"
```

### Backup Script for etcd
```bash
#!/bin/bash
set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/etcd}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
ETCD_ENDPOINTS="${ETCD_ENDPOINTS:-https://127.0.0.1:2379}"
ETCD_CACERT="${ETCD_CACERT:-/etc/kubernetes/pki/etcd/ca.crt}"
ETCD_CERT="${ETCD_CERT:-/etc/kubernetes/pki/etcd/server.crt}"
ETCD_KEY="${ETCD_KEY:-/etc/kubernetes/pki/etcd/server.key}"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Generate backup filename with timestamp
BACKUP_FILE="${BACKUP_DIR}/etcd-backup-$(date +%Y%m%d-%H%M%S).db"

# Perform backup
echo "Starting etcd backup..."
ETCDCTL_API=3 etcdctl snapshot save "${BACKUP_FILE}" \
    --endpoints="${ETCD_ENDPOINTS}" \
    --cacert="${ETCD_CACERT}" \
    --cert="${ETCD_CERT}" \
    --key="${ETCD_KEY}"

# Verify backup
echo "Verifying backup..."
ETCDCTL_API=3 etcdctl snapshot status "${BACKUP_FILE}" \
    --write-out=table

# Compress backup
echo "Compressing backup..."
gzip "${BACKUP_FILE}"

# Remove old backups
echo "Removing backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "etcd-backup-*.db.gz" -mtime +${RETENTION_DAYS} -delete

# Upload to S3 (optional)
if [ -n "${AWS_S3_BUCKET:-}" ]; then
    echo "Uploading to S3..."
    aws s3 cp "${BACKUP_FILE}.gz" "s3://${AWS_S3_BUCKET}/etcd-backups/"
fi

echo "Backup completed successfully: ${BACKUP_FILE}.gz"
```

### Health Check Script
```bash
#!/bin/bash

# Health check for Kubernetes cluster
check_cluster_health() {
    echo "=== Cluster Health Check ==="
    
    # Check API server
    echo -n "API Server: "
    if kubectl cluster-info &> /dev/null; then
        echo "✓ Healthy"
    else
        echo "✗ Unhealthy"
        return 1
    fi
    
    # Check nodes
    echo -n "Nodes: "
    local not_ready=$(kubectl get nodes --no-headers | grep -v " Ready" | wc -l)
    if [ "$not_ready" -eq 0 ]; then
        echo "✓ All nodes ready"
    else
        echo "✗ ${not_ready} nodes not ready"
        kubectl get nodes
    fi
    
    # Check system pods
    echo -n "System Pods: "
    local failing_pods=$(kubectl get pods -n kube-system --no-headers | \
        grep -v "Running\|Completed" | wc -l)
    if [ "$failing_pods" -eq 0 ]; then
        echo "✓ All system pods running"
    else
        echo "✗ ${failing_pods} pods not running"
        kubectl get pods -n kube-system | grep -v "Running\|Completed"
    fi
    
    # Check component status
    echo "Component Status:"
    kubectl get componentstatuses
    
    # Check resource usage
    echo -e "\nResource Usage:"
    kubectl top nodes 2>/dev/null || echo "Metrics server not available"
}

check_cluster_health
```

---

## 2. Python Automation Scripts

### Kubernetes Resource Manager
```python
#!/usr/bin/env python3
"""
Kubernetes Resource Manager
Automates common Kubernetes operations
"""

import sys
import argparse
import logging
from kubernetes import client, config
from kubernetes.client.rest import ApiException

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class KubernetesManager:
    """Manage Kubernetes resources"""
    
    def __init__(self, namespace='default'):
        """Initialize Kubernetes client"""
        try:
            config.load_kube_config()
        except:
            config.load_incluster_config()
        
        self.namespace = namespace
        self.apps_v1 = client.AppsV1Api()
        self.core_v1 = client.CoreV1Api()
        self.batch_v1 = client.BatchV1Api()
    
    def list_deployments(self):
        """List all deployments in namespace"""
        try:
            deployments = self.apps_v1.list_namespaced_deployment(
                namespace=self.namespace
            )
            
            logger.info(f"Deployments in {self.namespace}:")
            for dep in deployments.items:
                replicas = dep.status.replicas or 0
                ready = dep.status.ready_replicas or 0
                logger.info(f"  {dep.metadata.name}: {ready}/{replicas} ready")
            
            return deployments.items
        except ApiException as e:
            logger.error(f"Error listing deployments: {e}")
            return []
    
    def scale_deployment(self, name, replicas):
        """Scale a deployment"""
        try:
            # Get current deployment
            deployment = self.apps_v1.read_namespaced_deployment(
                name=name,
                namespace=self.namespace
            )
            
            # Update replicas
            deployment.spec.replicas = replicas
            
            # Patch deployment
            self.apps_v1.patch_namespaced_deployment(
                name=name,
                namespace=self.namespace,
                body=deployment
            )
            
            logger.info(f"Scaled {name} to {replicas} replicas")
            return True
        except ApiException as e:
            logger.error(f"Error scaling deployment: {e}")
            return False
    
    def restart_deployment(self, name):
        """Restart a deployment by updating annotation"""
        try:
            from datetime import datetime
            
            # Get current deployment
            deployment = self.apps_v1.read_namespaced_deployment(
                name=name,
                namespace=self.namespace
            )
            
            # Add restart annotation
            if deployment.spec.template.metadata.annotations is None:
                deployment.spec.template.metadata.annotations = {}
            
            deployment.spec.template.metadata.annotations[
                'kubectl.kubernetes.io/restartedAt'
            ] = datetime.utcnow().isoformat()
            
            # Patch deployment
            self.apps_v1.patch_namespaced_deployment(
                name=name,
                namespace=self.namespace,
                body=deployment
            )
            
            logger.info(f"Restarted deployment {name}")
            return True
        except ApiException as e:
            logger.error(f"Error restarting deployment: {e}")
            return False
    
    def get_pod_logs(self, pod_name, container=None, tail_lines=100):
        """Get logs from a pod"""
        try:
            logs = self.core_v1.read_namespaced_pod_log(
                name=pod_name,
                namespace=self.namespace,
                container=container,
                tail_lines=tail_lines
            )
            return logs
        except ApiException as e:
            logger.error(f"Error getting pod logs: {e}")
            return None
    
    def delete_failed_pods(self):
        """Delete all failed pods in namespace"""
        try:
            pods = self.core_v1.list_namespaced_pod(
                namespace=self.namespace
            )
            
            deleted_count = 0
            for pod in pods.items:
                if pod.status.phase in ['Failed', 'Unknown']:
                    logger.info(f"Deleting failed pod: {pod.metadata.name}")
                    self.core_v1.delete_namespaced_pod(
                        name=pod.metadata.name,
                        namespace=self.namespace
                    )
                    deleted_count += 1
            
            logger.info(f"Deleted {deleted_count} failed pods")
            return deleted_count
        except ApiException as e:
            logger.error(f"Error deleting failed pods: {e}")
            return 0
    
    def create_configmap(self, name, data):
        """Create a ConfigMap"""
        try:
            configmap = client.V1ConfigMap(
                metadata=client.V1ObjectMeta(name=name),
                data=data
            )
            
            self.core_v1.create_namespaced_config_map(
                namespace=self.namespace,
                body=configmap
            )
            
            logger.info(f"Created ConfigMap: {name}")
            return True
        except ApiException as e:
            logger.error(f"Error creating ConfigMap: {e}")
            return False
    
    def run_job(self, name, image, command):
        """Run a one-time job"""
        try:
            job = client.V1Job(
                metadata=client.V1ObjectMeta(name=name),
                spec=client.V1JobSpec(
                    template=client.V1PodTemplateSpec(
                        spec=client.V1PodSpec(
                            containers=[
                                client.V1Container(
                                    name=name,
                                    image=image,
                                    command=command
                                )
                            ],
                            restart_policy='Never'
                        )
                    ),
                    backoff_limit=3
                )
            )
            
            self.batch_v1.create_namespaced_job(
                namespace=self.namespace,
                body=job
            )
            
            logger.info(f"Created job: {name}")
            return True
        except ApiException as e:
            logger.error(f"Error creating job: {e}")
            return False


def main():
    """Main function"""
    parser = argparse.ArgumentParser(description='Kubernetes Resource Manager')
    parser.add_argument('-n', '--namespace', default='default',
                       help='Kubernetes namespace')
    parser.add_argument('action', choices=[
        'list', 'scale', 'restart', 'logs', 'cleanup', 'job'
    ], help='Action to perform')
    parser.add_argument('--name', help='Resource name')
    parser.add_argument('--replicas', type=int, help='Number of replicas')
    parser.add_argument('--image', help='Container image')
    parser.add_argument('--command', nargs='+', help='Command to run')
    
    args = parser.parse_args()
    
    manager = KubernetesManager(namespace=args.namespace)
    
    if args.action == 'list':
        manager.list_deployments()
    elif args.action == 'scale':
        if not args.name or args.replicas is None:
            logger.error("--name and --replicas required for scale")
            sys.exit(1)
        manager.scale_deployment(args.name, args.replicas)
    elif args.action == 'restart':
        if not args.name:
            logger.error("--name required for restart")
            sys.exit(1)
        manager.restart_deployment(args.name)
    elif args.action == 'logs':
        if not args.name:
            logger.error("--name required for logs")
            sys.exit(1)
        logs = manager.get_pod_logs(args.name)
        if logs:
            print(logs)
    elif args.action == 'cleanup':
        manager.delete_failed_pods()
    elif args.action == 'job':
        if not all([args.name, args.image, args.command]):
            logger.error("--name, --image, and --command required for job")
            sys.exit(1)
        manager.run_job(args.name, args.image, args.command)


if __name__ == '__main__':
    main()
```

### Resource Monitoring Script
```python
#!/usr/bin/env python3
"""
Monitor Kubernetes resource usage and send alerts
"""

import time
import smtplib
from email.mime.text import MIMEText
from kubernetes import client, config

config.load_kube_config()

# Thresholds
CPU_THRESHOLD = 80  # percent
MEMORY_THRESHOLD = 85  # percent
DISK_THRESHOLD = 90  # percent


def get_node_metrics():
    """Get node resource metrics"""
    custom_api = client.CustomObjectsApi()
    
    try:
        metrics = custom_api.list_cluster_custom_object(
            group="metrics.k8s.io",
            version="v1beta1",
            plural="nodes"
        )
        return metrics['items']
    except Exception as e:
        print(f"Error getting metrics: {e}")
        return []


def check_resource_usage():
    """Check resource usage and return alerts"""
    alerts = []
    
    metrics = get_node_metrics()
    core_v1 = client.CoreV1Api()
    
    for metric in metrics:
        node_name = metric['metadata']['name']
        
        # Get node capacity
        node = core_v1.read_node(node_name)
        capacity = node.status.capacity
        
        # Calculate usage percentages
        cpu_usage = int(metric['usage']['cpu'].rstrip('n')) / 1000000000
        cpu_capacity = float(capacity['cpu'])
        cpu_percent = (cpu_usage / cpu_capacity) * 100
        
        memory_usage = int(metric['usage']['memory'].rstrip('Ki')) / 1024
        memory_capacity = int(capacity['memory'].rstrip('Ki')) / 1024
        memory_percent = (memory_usage / memory_capacity) * 100
        
        # Check thresholds
        if cpu_percent > CPU_THRESHOLD:
            alerts.append(
                f"Node {node_name}: CPU usage {cpu_percent:.1f}% "
                f"exceeds threshold {CPU_THRESHOLD}%"
            )
        
        if memory_percent > MEMORY_THRESHOLD:
            alerts.append(
                f"Node {node_name}: Memory usage {memory_percent:.1f}% "
                f"exceeds threshold {MEMORY_THRESHOLD}%"
            )
    
    return alerts


def send_alert(alerts):
    """Send alert email"""
    if not alerts:
        return
    
    msg = MIMEText('\n'.join(alerts))
    msg['Subject'] = 'Kubernetes Resource Alert'
    msg['From'] = 'alerts@example.com'
    msg['To'] = 'admin@example.com'
    
    try:
        with smtplib.SMTP('localhost') as server:
            server.send_message(msg)
        print("Alert sent successfully")
    except Exception as e:
        print(f"Error sending alert: {e}")


def main():
    """Main monitoring loop"""
    print("Starting resource monitoring...")
    
    while True:
        alerts = check_resource_usage()
        if alerts:
            print(f"Found {len(alerts)} alerts:")
            for alert in alerts:
                print(f"  - {alert}")
            send_alert(alerts)
        else:
            print("All resources within thresholds")
        
        time.sleep(300)  # Check every 5 minutes


if __name__ == '__main__':
    main()
```

---

## 3. Ansible Playbooks

### Deploy Application Playbook
```yaml
---
- name: Deploy Application to Kubernetes
  hosts: localhost
  gather_facts: no
  
  vars:
    namespace: production
    app_name: myapp
    image: myapp:latest
    replicas: 3
    
  tasks:
    - name: Ensure namespace exists
      kubernetes.core.k8s:
        state: present
        definition:
          apiVersion: v1
          kind: Namespace
          metadata:
            name: "{{ namespace }}"
    
    - name: Create ConfigMap
      kubernetes.core.k8s:
        state: present
        definition:
          apiVersion: v1
          kind: ConfigMap
          metadata:
            name: "{{ app_name }}-config"
            namespace: "{{ namespace }}"
          data:
            DATABASE_URL: "postgres://db:5432/mydb"
            LOG_LEVEL: "info"
    
    - name: Create Secret
      kubernetes.core.k8s:
        state: present
        definition:
          apiVersion: v1
          kind: Secret
          metadata:
            name: "{{ app_name }}-secret"
            namespace: "{{ namespace }}"
          type: Opaque
          stringData:
            DB_PASSWORD: "{{ db_password }}"
    
    - name: Deploy application
      kubernetes.core.k8s:
        state: present
        definition:
          apiVersion: apps/v1
          kind: Deployment
          metadata:
            name: "{{ app_name }}"
            namespace: "{{ namespace }}"
          spec:
            replicas: "{{ replicas }}"
            selector:
              matchLabels:
                app: "{{ app_name }}"
            template:
              metadata:
                labels:
                  app: "{{ app_name }}"
              spec:
                containers:
                - name: "{{ app_name }}"
                  image: "{{ image }}"
                  ports:
                  - containerPort: 8080
                  envFrom:
                  - configMapRef:
                      name: "{{ app_name }}-config"
                  - secretRef:
                      name: "{{ app_name }}-secret"
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
    
    - name: Create Service
      kubernetes.core.k8s:
        state: present
        definition:
          apiVersion: v1
          kind: Service
          metadata:
            name: "{{ app_name }}-service"
            namespace: "{{ namespace }}"
          spec:
            selector:
              app: "{{ app_name }}"
            ports:
            - protocol: TCP
              port: 80
              targetPort: 8080
            type: LoadBalancer
    
    - name: Wait for deployment to be ready
      kubernetes.core.k8s_info:
        kind: Deployment
        name: "{{ app_name }}"
        namespace: "{{ namespace }}"
      register: deployment
      until: deployment.resources[0].status.readyReplicas == replicas
      retries: 30
      delay: 10
    
    - name: Get service endpoint
      kubernetes.core.k8s_info:
        kind: Service
        name: "{{ app_name }}-service"
        namespace: "{{ namespace }}"
      register: service
    
    - name: Display service endpoint
      debug:
        msg: "Application deployed at: {{ service.resources[0].status.loadBalancer.ingress[0].ip }}"
```

### Cluster Maintenance Playbook
```yaml
---
- name: Kubernetes Cluster Maintenance
  hosts: k8s_masters
  become: yes
  
  tasks:
    - name: Drain node for maintenance
      command: kubectl drain {{ inventory_hostname }} --ignore-daemonsets --delete-emptydir-data
      delegate_to: localhost
      when: maintenance_mode | default(false)
    
    - name: Update system packages
      apt:
        update_cache: yes
        upgrade: dist
      when: ansible_os_family == "Debian"
    
    - name: Restart kubelet
      systemd:
        name: kubelet
        state: restarted
        daemon_reload: yes
    
    - name: Wait for node to be ready
      command: kubectl wait --for=condition=Ready node/{{ inventory_hostname }} --timeout=300s
      delegate_to: localhost
    
    - name: Uncordon node
      command: kubectl uncordon {{ inventory_hostname }}
      delegate_to: localhost
      when: maintenance_mode | default(false)
    
    - name: Verify node status
      command: kubectl get node {{ inventory_hostname }}
      delegate_to: localhost
      register: node_status
    
    - name: Display node status
      debug:
        var: node_status.stdout_lines
```

---

## 4. Perl Scripts (Legacy Systems)

### Log Parser
```perl
#!/usr/bin/perl
use strict;
use warnings;
use JSON;

# Parse Kubernetes pod logs for errors
my $namespace = $ARGV[0] || 'default';
my $error_count = 0;
my %error_types;

# Get all pods in namespace
my @pods = `kubectl get pods -n $namespace -o json`;
my $pods_json = decode_json(join('', @pods));

foreach my $pod (@{$pods_json->{items}}) {
    my $pod_name = $pod->{metadata}{name};
    print "Checking pod: $pod_name\n";
    
    # Get pod logs
    my @logs = `kubectl logs $pod_name -n $namespace --tail=1000 2>/dev/null`;
    
    foreach my $line (@logs) {
        if ($line =~ /(ERROR|FATAL|Exception|failed)/i) {
            $error_count++;
            my $error_type = $1;
            $error_types{$error_type}++;
            print "  Found error: $line";
        }
    }
}

print "\n=== Summary ===\n";
print "Total errors found: $error_count\n";
print "Error types:\n";
foreach my $type (sort keys %error_types) {
    print "  $type: $error_types{$type}\n";
}
```

---

## 5. Configuration Management

### Ansible Inventory
```ini
[k8s_masters]
master1 ansible_host=192.168.1.10
master2 ansible_host=192.168.1.11
master3 ansible_host=192.168.1.12

[k8s_workers]
worker1 ansible_host=192.168.1.20
worker2 ansible_host=192.168.1.21
worker3 ansible_host=192.168.1.22

[k8s_cluster:children]
k8s_masters
k8s_workers

[k8s_cluster:vars]
ansible_user=ubuntu
ansible_ssh_private_key_file=~/.ssh/id_rsa
kubernetes_version=1.28.0
```

### Ansible Role Structure
```
roles/
└── kubernetes/
    ├── tasks/
    │   ├── main.yml
    │   ├── install.yml
    │   ├── configure.yml
    │   └── deploy.yml
    ├── templates/
    │   ├── deployment.yml.j2
    │   ├── service.yml.j2
    │   └── configmap.yml.j2
    ├── vars/
    │   └── main.yml
    ├── defaults/
    │   └── main.yml
    └── handlers/
        └── main.yml
```

---

## 6. Interview Preparation - Scripting & Automation

### Key Talking Points

**1. Scripting Best Practices**
- Error handling (set -e, try-catch)
- Logging and debugging
- Idempotency
- Input validation
- Documentation
- Testing

**2. Automation Tools Comparison**
- **Shell**: Quick tasks, simple automation
- **Python**: Complex logic, API interactions
- **Ansible**: Configuration management, orchestration
- **Terraform**: Infrastructure as Code

**3. Common Automation Tasks**
- Deployment automation
- Backup and restore
- Health checks and monitoring
- Resource cleanup
- Certificate rotation
- Log aggregation

### Common Interview Questions

**Q: How do you ensure script idempotency?**
A:
1. Check current state before making changes
2. Use declarative approaches
3. Implement proper error handling
4. Use tools like Ansible that are idempotent by design
5. Test scripts multiple times

**Q: Explain your approach to error handling in scripts.**
A:
1. Use `set -euo pipefail` in bash
2. Implement try-catch blocks
3. Log errors with context
4. Provide meaningful error messages
5. Implement rollback mechanisms
6. Set up alerting for failures

**Q: How do you manage secrets in automation scripts?**
A:
1. Never hardcode secrets
2. Use environment variables
3. Integrate with secret managers (Vault, AWS Secrets Manager)
4. Use Kubernetes Secrets
5. Implement proper access controls
6. Audit secret access

**Q: Describe your experience with Ansible for Kubernetes.**
A: Be ready to discuss:
- Playbook structure
- kubernetes.core collection
- Inventory management
- Variable precedence
- Role organization
- Integration with CI/CD

### Hands-on Scenarios

**Scenario 1: Write a deployment script**
- Check prerequisites
- Deploy application
- Wait for readiness
- Verify deployment
- Rollback on failure

**Scenario 2: Create monitoring script**
- Check resource usage
- Alert on thresholds
- Log metrics
- Send notifications

**Scenario 3: Automate backup**
- Backup etcd
- Backup persistent volumes
- Upload to remote storage
- Implement retention policy

---

## Quick Reference

### Useful Shell Commands
```bash
# Get all pods with high memory usage
kubectl top pods --all-namespaces --sort-by=memory

# Find pods in CrashLoopBackOff
kubectl get pods --all-namespaces --field-selector=status.phase=Failed

# Delete all evicted pods
kubectl get pods --all-namespaces -o json | \
  jq -r '.items[] | select(.status.reason=="Evicted") | 
  "kubectl delete pod \(.metadata.name) -n \(.metadata.namespace)"' | sh

# Get pod resource requests/limits
kubectl get pods -o custom-columns=\
NAME:.metadata.name,\
CPU_REQ:.spec.containers[*].resources.requests.cpu,\
MEM_REQ:.spec.containers[*].resources.requests.memory
```

### Python Kubernetes Client Examples
```python
# List pods
pods = core_v1.list_namespaced_pod(namespace='default')

# Create deployment
apps_v1.create_namespaced_deployment(namespace='default', body=deployment)

# Scale deployment
apps_v1.patch_namespaced_deployment_scale(
    name='myapp',
    namespace='default',
    body={'spec': {'replicas': 5}}
)

# Watch events
w = watch.Watch()
for event in w.stream(core_v1.list_namespaced_pod, namespace='default'):
    print(f"Event: {event['type']} {event['object'].metadata.name}")
```
