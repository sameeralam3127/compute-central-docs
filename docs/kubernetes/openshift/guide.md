---
description: Learn OpenShift installation options, platform components, projects, routes, builds, SCCs, operators, monitoring, networking, and operational workflows.
---

# Red Hat OpenShift Platform Guide for Kubernetes Teams

OpenShift is Red Hat's enterprise Kubernetes platform for building, running, and operating containerized applications across local, datacenter, and cloud environments.

This guide now covers not just platform concepts, but also how to choose an installation model, what prerequisites matter, where virtualization fits, and how to approach setup safely.

## 1. Installation Types

OpenShift can be installed in several ways depending on your goal, budget, and environment maturity.

### OpenShift Local (CRC)

OpenShift Local, previously known as CodeReady Containers or `crc`, is the best option for:

- Local learning
- Feature exploration
- Basic operator testing
- Developer-focused labs on a single machine

It is not designed for production workloads.

### Installer-Provisioned Infrastructure (IPI)

With IPI, the installer creates and configures much of the required infrastructure for you.

This is usually the best option when:

- You are starting fresh on a supported cloud
- You want faster time to a working cluster
- You prefer more automation during installation

### User-Provisioned Infrastructure (UPI)

With UPI, you prepare the infrastructure yourself and then install OpenShift on top of it.

This is useful when:

- You need tighter network or security control
- Your organization has custom infrastructure standards
- You are installing on-premises or in more complex enterprise environments

### Assisted Installer

The Assisted Installer is a guided installation workflow that helps with host discovery, readiness checks, and deployment.

It is useful when:

- You want more guidance than raw UPI
- You are setting up bare metal or custom environments
- You want validation before the cluster is deployed

!!! note "Official installation methods"
Red Hat documents installer-provisioned, user-provisioned, and Assisted Installer approaches for OpenShift Container Platform. For OpenShift Virtualization specifically, Red Hat notes that installation method and cluster topology can affect features such as snapshots and live migration.

---

## 2. Requirements and Planning

Before installing OpenShift, decide what kind of environment you are building:

- Local single-node lab
- Shared development cluster
- Production platform on cloud
- On-premises or edge deployment

### Minimum Planning Areas

No matter which installation type you choose, plan for:

- CPU, memory, and storage capacity
- DNS and naming
- Load balancing
- Network ranges and routing
- Pull secret access
- Cluster admin access
- Persistent storage strategy
- Backup and disaster recovery expectations

### Why Requirements Matter

OpenShift is more opinionated and more operationally complete than a minimal Kubernetes lab. That means under-sizing the environment usually leads to slow installs, unstable operators, and misleading test results.

---

## 3. Benefits of Virtualization in the OpenShift Ecosystem

OpenShift is primarily a container platform, but virtualization becomes important in a few practical cases:

- Running legacy virtual machine workloads alongside containers
- Gradually modernizing older applications instead of rewriting everything at once
- Giving platform teams one operational surface for containers and VMs
- Supporting mixed workload migration strategies

### OpenShift Virtualization

OpenShift Virtualization extends OpenShift so virtual machines can run on the same platform as containerized workloads.

Benefits include:

- Unified operations for VMs and containers
- Shared networking and storage patterns
- Operator-driven lifecycle management
- Easier migration from traditional virtualization estates

### Important Considerations

Based on Red Hat's OpenShift Virtualization documentation, these points matter:

- Installation method and topology can affect features such as snapshots and live migration
- Restricted or disconnected environments need additional operator and catalog preparation
- Platform networking and storage decisions directly affect VM usability

---

## 4. Virtualization Basics for OpenShift Local and Labs

For local lab environments, virtualization support on your workstation matters a lot.

### Why Virtualization Matters

OpenShift Local runs as a local virtualized cluster, so the host machine must support and allow hardware virtualization.

Typical requirements include:

- Virtualization enabled in BIOS or UEFI
- A supported hypervisor stack for your operating system
- Enough free CPU and RAM for the cluster to stay healthy

### Common Host Considerations

- On macOS, local OpenShift setups usually depend on a supported virtualization framework or hypervisor workflow
- On Windows, WSL or Hyper-V related configuration can affect local cluster setup
- On Linux, KVM support is commonly important for local virtualization-based workflows

If virtualization is disabled or unsupported, local cluster installation usually fails early or performs poorly.

---

## 5. OpenShift Local (CRC) Setup

OpenShift Local is the fastest route for learning OpenShift on a single machine.

### When to Use It

Use OpenShift Local when you want:

- A personal OpenShift lab
- CLI and console practice
- Route, project, SCC, and operator exploration
- A safe place to test manifests and workflows

### High-Level Setup Flow

1. Download and install OpenShift Local.
2. Download the pull secret from Red Hat.
3. Ensure virtualization is enabled on the host.
4. Run the setup command.
5. Start the cluster.
6. Log in with `oc` and open the web console.

### Example Workflow

```bash
crc setup
crc start
crc status
crc console
oc login -u kubeadmin -p <password> https://api.crc.testing:6443
```

### What to Validate After Setup

- `crc status` reports the cluster as running
- `oc whoami` succeeds
- `oc get nodes` returns the node
- The web console loads
- Core operators settle into healthy states

### Best Use Cases

- Learning core OpenShift concepts
- Testing `oc` commands
- Practicing routes, projects, builds, and operators
- Small-scale demos

### Limitations

- Not for production
- Single-machine resource limits apply
- Not a substitute for multi-node architecture testing

---

## 6. Cloud Platform Focus

For teams moving beyond local labs, cloud platforms are usually the most practical place to install and operate OpenShift.

### Why Cloud Is Often Easier

- Faster infrastructure provisioning
- Managed load balancers and networking integrations
- Easier scaling
- Better fit for IPI workflows
- Faster recovery and repeatable automation

### Common Cloud Directions

Platform teams often focus on:

- AWS for mature ecosystem support and strong OpenShift adoption
- Azure for Microsoft-centric enterprise environments
- Google Cloud for teams already invested in GCP

### What to Focus On During Cloud Setup

- VPC or virtual network design
- DNS delegation
- Ingress and API endpoint exposure
- Identity and access model
- Machine sizing
- Storage classes
- Internet-connected versus disconnected installation design

### Cloud Best Practice

For first-time teams, start with a supported and well-documented installer path on a cloud platform before attempting a more customized on-premises rollout.

---

## 7. Practical Installation and Setup Best Practices

These practices make OpenShift installation smoother and safer:

- Start with the installation model that matches your goal, not the most advanced one
- Use OpenShift Local for learning and IPI on a supported cloud for early team environments
- Validate DNS, time sync, routing, and load balancer behavior before blaming the installer
- Keep cluster sizing realistic; underpowered clusters create misleading failures
- Version-control install configs and post-install changes
- Separate lab guidance from production guidance clearly
- Plan storage and ingress early, because many platform features depend on them
- Use operators carefully and understand what each one adds to cluster overhead
- Document cluster access, credentials handling, and recovery steps from day one

### For OpenShift Virtualization

If your goal includes VMs on OpenShift:

- Verify storage class behavior early
- Plan networking with virtualization use cases in mind
- Review Red Hat guidance for snapshots, live migration, and disconnected environments
- Treat virtualization as a platform capability with extra operational requirements, not just another operator checkbox

---

## 8. Recommended Learning Path

If you are new to OpenShift, this sequence works well:

1. Start with OpenShift Local.
2. Learn projects, routes, SCCs, image streams, and the `oc` CLI.
3. Practice app deployment and basic troubleshooting.
4. Move to a cloud-based installer path.
5. Add operators, monitoring, logging, and policy controls.
6. Explore OpenShift Virtualization only after the cluster fundamentals are stable.

---

## 9. OpenShift vs Kubernetes - Key Differences

### What is OpenShift?

OpenShift is Red Hat's enterprise Kubernetes platform that adds:

- Integrated developer and operational tools
- Enhanced security features
- Built-in CI/CD capabilities
- Enterprise support and lifecycle management
- Opinionated best practices

### Architecture Comparison

```
Kubernetes                    OpenShift
├── API Server               ├── API Server (extended)
├── etcd                     ├── etcd
├── Scheduler                ├── Scheduler
├── Controller Manager       ├── Controller Manager
└── kubelet                  ├── kubelet
                             ├── OpenShift API Server
                             ├── OpenShift Controller Manager
                             └── OAuth Server
```

---

## 10. OpenShift-Specific Components

### OpenShift API Server

- Extends Kubernetes API
- Manages OpenShift-specific resources (Routes, Projects, etc.)
- Handles user and group management

### OAuth Server

- Integrated authentication
- Multiple identity providers (LDAP, GitHub, Google, etc.)
- Token-based authentication

### Image Registry

- Built-in container registry
- Integrated with build process
- Automatic image pruning

### Router (HAProxy-based)

- Ingress controller
- Route resources (OpenShift's ingress)
- SSL/TLS termination
- Load balancing

---

## 11. OpenShift-Specific Resources

### Projects (vs Namespaces)

```bash
# Create project
oc new-project myapp-dev --display-name="My App Development"

# Switch project
oc project myapp-dev

# List projects
oc projects

# Get current project
oc project
```

**Projects = Namespaces + Additional Features:**

- Default network policies
- Default resource quotas
- Project-level RBAC
- Annotations for display names and descriptions

### Routes (vs Ingress)

```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: myapp-route
  namespace: myapp-dev
spec:
  host: myapp.apps.cluster.example.com
  to:
    kind: Service
    name: myapp-service
    weight: 100
  port:
    targetPort: 8080
  tls:
    termination: edge
    insecureEdgeTerminationPolicy: Redirect
  wildcardPolicy: None
```

**Route Types:**

- **Edge**: TLS termination at router
- **Passthrough**: TLS termination at pod
- **Re-encrypt**: TLS termination at router, re-encrypted to pod

```bash
# Create route
oc expose service myapp-service

# Create secure route
oc create route edge myapp-secure --service=myapp-service

# Get routes
oc get routes
```

### BuildConfig and ImageStreams

```yaml
# ImageStream
apiVersion: image.openshift.io/v1
kind: ImageStream
metadata:
  name: myapp
  namespace: myapp-dev
spec:
  lookupPolicy:
    local: true

---
# BuildConfig - Source-to-Image (S2I)
apiVersion: build.openshift.io/v1
kind: BuildConfig
metadata:
  name: myapp-build
spec:
  source:
    type: Git
    git:
      uri: https://github.com/myorg/myapp.git
      ref: main
  strategy:
    type: Source
    sourceStrategy:
      from:
        kind: ImageStreamTag
        name: nodejs:16
        namespace: openshift
  output:
    to:
      kind: ImageStreamTag
      name: myapp:latest
  triggers:
    - type: ConfigChange
    - type: ImageChange
    - type: GitHub
      github:
        secret: github-webhook-secret
```

**Build Strategies:**

1. **Source (S2I)**: Source code → Container image
2. **Docker**: Dockerfile-based builds
3. **Custom**: Custom builder image
4. **Pipeline**: Jenkins/Tekton pipelines

```bash
# Start build
oc start-build myapp-build

# Follow build logs
oc logs -f bc/myapp-build

# Get builds
oc get builds

# Cancel build
oc cancel-build myapp-build-1
```

### DeploymentConfig (Legacy, use Deployments now)

```yaml
apiVersion: apps.openshift.io/v1
kind: DeploymentConfig
metadata:
  name: myapp
spec:
  replicas: 3
  selector:
    app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: myapp:latest
          ports:
            - containerPort: 8080
  triggers:
    - type: ConfigChange
    - type: ImageChange
      imageChangeParams:
        automatic: true
        containerNames:
          - myapp
        from:
          kind: ImageStreamTag
          name: myapp:latest
```

**Note**: OpenShift 4.x recommends using standard Kubernetes Deployments over DeploymentConfigs.

---

## 12. Security Context Constraints (SCCs)

### What are SCCs?

OpenShift's security mechanism that controls:

- User/group IDs containers can run as
- Capabilities containers can use
- Volume types that can be mounted
- Host network/ports access
- SELinux context

### Default SCCs

```bash
# List SCCs
oc get scc

# Common SCCs:
# - restricted (default, most secure)
# - anyuid (run as any UID)
# - privileged (full access)
# - hostnetwork (host network access)
# - hostmount-anyuid (host volumes + any UID)
```

### Custom SCC

```yaml
apiVersion: security.openshift.io/v1
kind: SecurityContextConstraints
metadata:
  name: custom-scc
allowHostDirVolumePlugin: false
allowHostIPC: false
allowHostNetwork: false
allowHostPID: false
allowHostPorts: false
allowPrivilegedContainer: false
allowedCapabilities:
  - NET_BIND_SERVICE
defaultAddCapabilities: []
fsGroup:
  type: MustRunAs
  ranges:
    - min: 1000
      max: 65535
readOnlyRootFilesystem: false
requiredDropCapabilities:
  - KILL
  - MKNOD
  - SETUID
  - SETGID
runAsUser:
  type: MustRunAsRange
  uidRangeMin: 1000
  uidRangeMax: 65535
seLinuxContext:
  type: MustRunAs
supplementalGroups:
  type: RunAsAny
volumes:
  - configMap
  - downwardAPI
  - emptyDir
  - persistentVolumeClaim
  - projected
  - secret
```

### Granting SCC to Service Account

```bash
# Add SCC to service account
oc adm policy add-scc-to-user anyuid -z myapp-sa -n myapp-dev

# Add SCC to group
oc adm policy add-scc-to-group anyuid system:serviceaccounts:myapp-dev

# Check which SCC a pod is using
oc describe pod <pod-name> | grep scc
```

---

## 13. OpenShift CLI (oc) Commands

### Basic Commands

```bash
# Login
oc login https://api.cluster.example.com:6443 --token=<token>
oc login -u developer -p password

# Get current user
oc whoami
oc whoami --show-token
oc whoami --show-server

# Status
oc status
oc get all
```

### Project Management

```bash
# Create project
oc new-project myapp --description="My Application"

# Delete project
oc delete project myapp

# Grant access
oc adm policy add-role-to-user admin user1 -n myapp
oc adm policy add-role-to-user view user2 -n myapp
```

### Application Deployment

```bash
# New app from Git
oc new-app https://github.com/myorg/myapp.git --name=myapp

# New app from Docker image
oc new-app nginx:latest --name=nginx

# New app with specific builder
oc new-app nodejs:16~https://github.com/myorg/myapp.git

# Expose service
oc expose service myapp

# Scale
oc scale dc/myapp --replicas=3
```

### Build Operations

```bash
# Start build
oc start-build myapp

# Follow build logs
oc logs -f bc/myapp

# Import image
oc import-image myapp:latest --from=docker.io/myorg/myapp:latest --confirm

# Tag image
oc tag myapp:latest myapp:prod
```

### Debugging

```bash
# Debug pod
oc debug pod/myapp-1-abcde

# Debug with different image
oc debug pod/myapp-1-abcde --image=rhel8/support-tools

# Run debug pod
oc debug deployment/myapp

# Remote shell
oc rsh pod/myapp-1-abcde

# Port forward
oc port-forward pod/myapp-1-abcde 8080:8080
```

### Advanced Operations

```bash
# Extract resource definition
oc get deployment myapp -o yaml > deployment.yaml

# Process template
oc process -f template.yaml -p PARAM1=value1 | oc apply -f -

# Rollout
oc rollout latest dc/myapp
oc rollout status dc/myapp
oc rollout history dc/myapp
oc rollout undo dc/myapp

# Set environment variables
oc set env deployment/myapp DB_HOST=postgres

# Set resources
oc set resources deployment/myapp --limits=cpu=500m,memory=512Mi --requests=cpu=250m,memory=256Mi

# Set probe
oc set probe deployment/myapp --liveness --get-url=http://:8080/health --initial-delay-seconds=30
```

### Cluster Administration

```bash
# Get nodes
oc get nodes
oc adm top nodes

# Drain node
oc adm drain node1 --ignore-daemonsets --delete-emptydir-data

# Uncordon node
oc adm uncordon node1

# Manage certificates
oc adm certificate approve <csr-name>

# Prune resources
oc adm prune images --confirm
oc adm prune builds --confirm
oc adm prune deployments --confirm
```

---

## 14. OpenShift Operators

### What are Operators?

- Kubernetes-native applications
- Automate deployment, scaling, and management
- Encode operational knowledge
- Custom Resource Definitions (CRDs)

### Operator Lifecycle Manager (OLM)

```bash
# List available operators
oc get packagemanifests -n openshift-marketplace

# Install operator
oc create -f - <<EOF
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: elasticsearch-operator
  namespace: openshift-operators
spec:
  channel: stable
  name: elasticsearch-operator
  source: redhat-operators
  sourceNamespace: openshift-marketplace
EOF

# Check operator status
oc get csv -n openshift-operators
oc get installplan -n openshift-operators
```

### Common OpenShift Operators

- **Elasticsearch Operator**: Logging
- **Jaeger Operator**: Distributed tracing
- **Prometheus Operator**: Monitoring
- **Service Mesh Operator**: Istio-based service mesh
- **Serverless Operator**: Knative
- **Pipelines Operator**: Tekton

---

## 15. OpenShift Monitoring and Logging

### Built-in Monitoring Stack

- Prometheus for metrics
- Grafana for visualization
- Alertmanager for alerts

```bash
# Access monitoring
oc get routes -n openshift-monitoring

# Query metrics
oc exec -n openshift-monitoring prometheus-k8s-0 -- promtool query instant http://localhost:9090 'up'

# Create custom ServiceMonitor
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: myapp-monitor
  namespace: myapp-dev
spec:
  selector:
    matchLabels:
      app: myapp
  endpoints:
  - port: metrics
    interval: 30s
```

### Logging Stack (EFK)

- Elasticsearch: Storage
- Fluentd: Collection
- Kibana: Visualization

```bash
# Install logging operator
oc create -f - <<EOF
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: cluster-logging
  namespace: openshift-logging
spec:
  channel: stable
  name: cluster-logging
  source: redhat-operators
  sourceNamespace: openshift-marketplace
EOF

# Create ClusterLogging instance
apiVersion: logging.openshift.io/v1
kind: ClusterLogging
metadata:
  name: instance
  namespace: openshift-logging
spec:
  managementState: Managed
  logStore:
    type: elasticsearch
    elasticsearch:
      nodeCount: 3
      storage:
        size: 200G
  visualization:
    type: kibana
  collection:
    logs:
      type: fluentd
```

---

## 8. OpenShift Networking

### Software Defined Networking (SDN)

```bash
# Get network configuration
oc get network.config.openshift.io cluster -o yaml

# Network plugins:
# - OpenShift SDN (default in 3.x/4.x)
# - OVN-Kubernetes (default in 4.12+)
```

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-from-same-namespace
  namespace: myapp-dev
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector: {}
```

### Egress IP

```yaml
apiVersion: v1
kind: NetNamespace
metadata:
  name: myapp-dev
egressIPs:
  - 192.168.1.100
```

---

## 9. OpenShift Templates

### Template Structure

```yaml
apiVersion: template.openshift.io/v1
kind: Template
metadata:
  name: myapp-template
  annotations:
    description: "My Application Template"
    tags: "nodejs,mongodb"
objects:
  - apiVersion: v1
    kind: Service
    metadata:
      name: ${APP_NAME}
    spec:
      ports:
        - port: 8080
      selector:
        app: ${APP_NAME}
  - apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: ${APP_NAME}
    spec:
      replicas: ${{REPLICAS}}
      selector:
        matchLabels:
          app: ${APP_NAME}
      template:
        metadata:
          labels:
            app: ${APP_NAME}
        spec:
          containers:
            - name: ${APP_NAME}
              image: ${IMAGE}:${IMAGE_TAG}
              ports:
                - containerPort: 8080
              env:
                - name: DATABASE_URL
                  value: ${DATABASE_URL}
parameters:
  - name: APP_NAME
    description: Application name
    required: true
  - name: IMAGE
    description: Container image
    value: nodejs
  - name: IMAGE_TAG
    description: Image tag
    value: "16"
  - name: REPLICAS
    description: Number of replicas
    value: "2"
  - name: DATABASE_URL
    description: Database connection string
    generate: expression
    from: "mongodb://[a-z0-9]{8}:[a-z0-9]{8}@mongodb:27017/mydb"
```

### Using Templates

```bash
# Process template
oc process -f template.yaml -p APP_NAME=myapp -p REPLICAS=3

# Process and create
oc process -f template.yaml -p APP_NAME=myapp | oc create -f -

# Use template from project
oc new-app --template=myapp-template -p APP_NAME=myapp
```

---

## 10. Interview Preparation - OpenShift Specific

### Key Talking Points

**1. Why OpenShift over vanilla Kubernetes?**

- Enterprise support and SLA
- Integrated CI/CD (Builds, Pipelines)
- Enhanced security (SCCs, built-in RBAC)
- Developer-friendly (oc CLI, web console)
- Operator ecosystem
- Simplified upgrades and lifecycle management

**2. Security Advantages**

- Security Context Constraints (more granular than PSPs)
- Integrated OAuth and RBAC
- Image scanning and signing
- Network policies by default
- SELinux integration

**3. Developer Experience**

- Source-to-Image (S2I) builds
- Built-in image registry
- Developer catalog
- Topology view in web console
- Integrated monitoring and logging

**4. Operations Benefits**

- Operator Lifecycle Manager
- Automated updates
- Built-in monitoring stack
- Cluster autoscaling
- Machine management

### Common Interview Questions

**Q: Explain the difference between Routes and Ingress.**
A: Routes are OpenShift's native ingress mechanism, predating Kubernetes Ingress. They offer:

- Simpler configuration
- Built-in HAProxy router
- Better integration with OpenShift features
- Support for edge, passthrough, and re-encrypt TLS
  OpenShift 4.x supports both Routes and standard Ingress resources.

**Q: What are Security Context Constraints?**
A: SCCs control what pods can do and access. They define:

- User/group IDs
- Capabilities
- Volume types
- Host access
- SELinux context
  More fine-grained than Kubernetes Pod Security Policies.

**Q: How do you troubleshoot a failing build?**
A:

1. Check build logs: `oc logs -f bc/myapp`
2. Verify source repository access
3. Check builder image availability
4. Review build strategy configuration
5. Check resource quotas and limits
6. Verify network connectivity for pulling dependencies
7. Check for webhook configuration issues

**Q: Explain ImageStreams and their benefits.**
A: ImageStreams are:

- Abstraction over container images
- Track image changes and tags
- Trigger automatic deployments on updates
- Enable image rollback
- Provide image metadata and history
- Support image mirroring and caching

**Q: How do you perform zero-downtime deployments in OpenShift?**
A:

1. Use rolling deployment strategy
2. Configure readiness probes
3. Set appropriate maxSurge and maxUnavailable
4. Use pre/post lifecycle hooks if needed
5. Implement health checks
6. Consider blue-green or canary deployments
7. Use Routes for traffic splitting

### Hands-on Scenarios to Practice

1. **Deploy a multi-tier application**
   - Frontend (React)
   - Backend API (Node.js)
   - Database (PostgreSQL)
   - Configure Routes, Services, and NetworkPolicies

2. **Set up CI/CD pipeline**
   - Create BuildConfig with GitHub webhook
   - Configure ImageStream
   - Set up automatic deployments
   - Implement testing stages

3. **Implement security hardening**
   - Create custom SCC
   - Configure RBAC
   - Set up NetworkPolicies
   - Implement secrets management

4. **Troubleshooting exercise**
   - Debug failing pods
   - Resolve image pull errors
   - Fix networking issues
   - Resolve resource constraints

---

## 11. OpenShift 4.x Specific Features

### Machine API

- Declarative machine management
- Cluster autoscaling
- Machine health checks

### Cluster Operators

```bash
# List cluster operators
oc get clusteroperators

# Check operator status
oc get co/authentication -o yaml
```

### Web Console Enhancements

- Developer perspective vs Administrator perspective
- Topology view
- Monitoring dashboards
- Integrated terminal

### GitOps with ArgoCD

- Declarative continuous delivery
- Git as source of truth
- Automated sync and rollback

---

## Quick Command Reference

```bash
# Essential oc commands
oc login                    # Login to cluster
oc new-project             # Create project
oc new-app                 # Create application
oc expose                  # Create route
oc get all                 # Get all resources
oc describe                # Describe resource
oc logs                    # View logs
oc rsh                     # Remote shell
oc debug                   # Debug pod
oc start-build             # Start build
oc rollout                 # Manage rollouts
oc adm policy              # Manage policies
oc adm top                 # Resource usage
oc extract                 # Extract secrets/configmaps
oc set                     # Set resource properties
```

### Useful Aliases

```bash
alias ocl='oc logs -f'
alias ocd='oc describe'
alias ocg='oc get'
alias oce='oc edit'
alias ocp='oc project'
```
