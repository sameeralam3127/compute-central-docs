---
description: Learn Kubernetes and OpenShift from container fundamentals to local labs, managed clusters, workloads, services, troubleshooting, and production practices.
---

# Kubernetes and OpenShift: From Basics to Practical Operations

Kubernetes is a container orchestration platform for deploying, scaling, and operating applications across a cluster of machines.

This guide is written for DevOps engineers, SREs, and learners who want a practical mental model first, then safe hands-on commands.

!!! info "What this page covers"
    - Why Kubernetes exists
    - The runtime and kernel concepts underneath it
    - Local environments for learning
    - Managed platforms for production
    - Core objects you will use every day

!!! tip "Read this as a map, not a certification cram sheet"
    Learn the flow first: container -> runtime -> node -> cluster -> workload -> service -> ingress -> observability.

!!! warning "Copy-safe guidance"
    Examples on this page avoid patterns that age badly in production, such as `:latest` image tags or long-lived credentials. Pin versions and adapt manifests to your own environment before deploying them.

## Kubernetes Section Map

- [Fundamentals](fundamentals.md)
- [CI/CD Pipelines](operations/cicd-pipelines.md)
- [Scripting and Automation](operations/scripting-automation.md)
- [Troubleshooting](operations/troubleshooting.md)
- [OpenShift Guide](openshift/guide.md)
- [Hands-On Scenarios](labs/hands-on-scenarios.md)
- [Docker Lab](labs/docker-lab.md)
- [Minikube Lab](labs/minikube-lab.md)
- [Podman Lab](labs/podman-lab.md)
- [Quick Reference](reference/quick-reference.md)
- [Interview Handbook](interview/questions.md)

---

## Why Kubernetes Exists

Before containers became common, teams usually deployed applications directly to physical servers or virtual machines.

That model created recurring problems:

- Dependency conflicts between applications on the same host
- Inconsistent environments across development, test, and production
- Slow scaling and manual recovery during failures
- Operational drift caused by hand-managed servers

Containers improved packaging and consistency, but running a few containers manually is very different from operating hundreds of them across multiple nodes.

Kubernetes solves the cluster-level problems:

- Scheduling workloads across machines
- Restarting failed containers automatically
- Scaling services up and down
- Exposing applications over stable networking
- Rolling out updates safely
- Managing configuration, secrets, and storage

!!! note "Short version"
    Docker popularized containers. Kubernetes operationalized them at scale.

---

## Core Building Blocks Under the Hood

### OCI

The Open Container Initiative defines standards so container images and runtimes can work across tools and platforms.

- The image specification defines how images are packaged
- The runtime specification defines how containers are started and managed

### `runc`

`runc` is a low-level runtime that creates containers using Linux kernel primitives. Most teams do not use it directly every day, but it helps explain what higher-level tools are doing underneath.

### Namespaces

Namespaces isolate processes so a container gets its own view of key system resources.

- PID namespace: process IDs
- Network namespace: interfaces, routes, ports
- Mount namespace: filesystem view
- User namespace: users and groups

### cgroups

Control groups limit and account for resource usage.

- CPU shares and quotas
- Memory limits
- I/O limits

### `containerd`

`containerd` is a production-grade container runtime used by many Kubernetes environments. It sits above lower-level runtimes and handles image management, execution, and lifecycle tasks.

!!! summary "Mental model"
    Kubernetes does not run containers by itself. It relies on node-level runtimes, which rely on Linux isolation and resource-control features.

---

## A Minimal `runc` Demo

This is a learning exercise, not a normal day-to-day Kubernetes workflow.

### Install `runc`

**Ubuntu/Debian**

```bash
sudo apt-get update
sudo apt-get install -y runc
```

**RHEL-compatible**

```bash
sudo dnf install -y runc
```

### Create a demo root filesystem

```bash
mkdir rootfs
docker export "$(docker create busybox:1.36)" | tar -C rootfs -xvf -
```

### Generate a default runtime spec and start a container

```bash
runc spec
sudo runc run mycontainer
```

### Inspect the container from the host

```bash
sudo runc list
sudo runc state mycontainer
```

!!! note "Why this matters"
    This shows that containers are not magic. They are regular Linux processes started with isolation and resource controls.

---

## Choosing a Local Kubernetes Environment

Use local clusters for learning, testing manifests, and validating deployment flow before touching shared environments.

### Minikube

Minikube is a lightweight local Kubernetes environment and a strong choice for learning fundamentals.

**Best for**

- First Kubernetes labs
- Testing manifests locally
- Exploring core `kubectl` workflows

**Typical requirements**

- 2+ CPUs
- 4 GB RAM recommended
- 20 GB free disk
- Docker, Podman, or a supported hypervisor

**Install `kubectl`**

**Linux**

```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
```

**macOS**

```bash
brew install kubectl
```

**Install Minikube**

**Linux**

```bash
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
```

**macOS**

```bash
brew install minikube
```

Windows users should use the official start guide:
[Minikube Start](https://minikube.sigs.k8s.io/docs/start/)

**Start and verify**

```bash
minikube start --driver=docker
kubectl get nodes
kubectl get pods -A
```

**Cleanup**

```bash
minikube stop
minikube delete
```

### Rancher Desktop

Rancher Desktop provides a local Kubernetes environment with a desktop UI and supports `containerd` or `dockerd`.

**Best for**

- Developers who want a GUI
- Local testing with `k3s`
- Teams already using Rancher tooling

**Verify**

```bash
kubectl get namespaces
kubectl config current-context
```

Official site:
[Rancher Desktop](https://rancherdesktop.io/)

### Docker Desktop

Docker Desktop can enable a local Kubernetes cluster on macOS and Windows.

**Best for**

- Local app development
- Teams already using Docker Desktop

**Verify**

```bash
kubectl cluster-info
kubectl get nodes
```

!!! note "Local cluster guidance"
    Local Kubernetes is for learning and development. It is not a substitute for production-grade cluster design, backup, access control, or node lifecycle management.

---

## Optional: Kubernetes Dashboard for Local Labs

Use the dashboard for learning, not as your primary operational interface in production.

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.7.0/aio/deploy/recommended.yaml
kubectl proxy
```

Access:
[Kubernetes Dashboard via Proxy](http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/)

!!! warning "Production note"
    Prefer `kubectl`, GitOps workflows, audit logging, and RBAC-reviewed access over relying on a web UI for cluster administration.

---

## Hands-On Browser Labs

- [Play with Kubernetes](https://labs.play-with-k8s.com/) for temporary browser-based clusters
- Vendor sandboxes and training labs for guided scenarios

Browser labs are useful for experimentation, but they are ephemeral and usually not suitable for repeatable team workflows.

---

## Managed Kubernetes Platforms

Production teams often prefer managed control planes so they can spend less time on cluster plumbing and more time on workload reliability.

### Amazon EKS

Amazon EKS is AWS's managed Kubernetes service.

**Good fit when**

- Your workloads already run heavily on AWS
- You need IAM, CloudWatch, ALB, and VPC integration
- Your team wants a managed control plane

**Example flow**

```bash
aws configure

curl --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

eksctl create cluster \
  --name my-cluster \
  --region us-west-2 \
  --nodegroup-name my-nodes \
  --node-type t3.medium \
  --nodes 2

kubectl get nodes
```

**Operational strengths**

- AWS IAM and networking integration
- Managed control plane
- Add-on ecosystem for autoscaling, ingress, and observability

### OpenShift

OpenShift is a Kubernetes platform with additional developer, security, and operational tooling.

**Good fit when**

- You want a more opinionated platform experience
- You need enterprise policy and built-in developer workflows
- Your organization already uses Red Hat tooling

**Try it**

- [Red Hat Developer Sandbox](https://developers.redhat.com/developer-sandbox)

### Other common managed platforms

- GKE for strong Google Cloud integration
- AKS for Azure-native operations
- IBM Cloud Kubernetes Service for IBM ecosystem users

!!! tip "Platform selection rule of thumb"
    Choose the platform that best matches your identity model, networking constraints, operations maturity, and existing cloud footprint, not the one with the longest feature list.

---

## A Small `containerd` Demo

If you want to see how a runtime behaves outside Kubernetes, this is a simple lab:

```bash
sudo dnf install -y containerd
sudo systemctl enable --now containerd

sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml
sudo systemctl restart containerd

sudo ctr image pull docker.io/library/alpine:3.20
export CTR_NAMESPACE=my-ns
sudo ctr --namespace "$CTR_NAMESPACE" run -t --rm docker.io/library/alpine:3.20 my-container sh

sudo ctr namespaces list
```

!!! note "Pinned image tag"
    The example uses `alpine:3.20` instead of `alpine:latest` so the behavior is more reproducible.

---

## Core Kubernetes Objects You Will Use Often

### Deployment

A Deployment manages stateless application replicas and rolling updates.

```bash
kubectl create deployment my-app --image=nginx:1.27.0 --replicas=3
kubectl get deployment my-app
kubectl rollout status deployment/my-app
```

### Service

A Service gives pods a stable network identity.

```bash
kubectl expose deployment my-app --type=NodePort --port=80 --target-port=80
kubectl get svc my-app
```

### Ingress

Ingress routes HTTP and HTTPS traffic into the cluster. It requires an ingress controller such as NGINX Ingress Controller or Traefik.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
spec:
  ingressClassName: nginx
  rules:
    - host: myapp.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: my-app
                port:
                  number: 80
```

### ConfigMap

ConfigMaps store non-sensitive configuration.

```bash
kubectl create configmap my-config --from-literal=APP_MODE=demo
kubectl describe configmap my-config
```

### Secret

Secrets store sensitive values, but you should still treat them carefully and prefer external secret-management patterns in production.

```bash
kubectl create secret generic my-secret --from-literal=password='change-me'
kubectl get secret my-secret
```

!!! warning "Important"
    Kubernetes Secrets are not a complete secret-management strategy by themselves. In production, combine them with encryption at rest, RBAC, and external secret stores where appropriate.

### PersistentVolume and PersistentVolumeClaim

Persistent storage is how workloads keep data beyond the life of an individual pod.

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: my-pv
spec:
  capacity:
    storage: 1Gi
  accessModes:
    - ReadWriteOnce
  hostPath:
    path: /mnt/data
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

!!! note "Lab vs production"
    `hostPath` is acceptable for local experiments. Production clusters typically use cloud block storage, shared filesystems, or CSI-backed storage classes instead.

---

## Helm Basics

Helm is a package manager for Kubernetes applications. It helps teams install, upgrade, and templatize common workloads.

**Install Helm**

```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
helm version
```

**Add a repository and deploy a chart**

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install my-ingress ingress-nginx/ingress-nginx
```

!!! tip "When Helm helps"
    Helm is useful when you need reusable packaging, values-based configuration, and lifecycle management for third-party applications.

---

## A Safe First Kubernetes Workflow

If you are just starting, this sequence gives you the right habits:

1. Start a local cluster with Minikube or Rancher Desktop.
2. Confirm context with `kubectl config current-context`.
3. Deploy a small pinned-image workload.
4. Expose it with a Service.
5. Watch rollout status and inspect pods.
6. Delete the workload and repeat from a manifest.

Useful verification commands:

```bash
kubectl get nodes
kubectl get pods -A
kubectl describe deployment my-app
kubectl logs deployment/my-app
kubectl rollout status deployment/my-app
```

---

## Common Mistakes to Avoid

- Using `:latest` tags in examples or production manifests
- Editing live objects manually without a source-controlled manifest
- Assuming Ingress works without installing an ingress controller
- Treating local cluster behavior as proof that production will behave the same way
- Storing sensitive values casually in manifests or shell history
- Skipping rollout verification after deployment

---

## Conclusion

Kubernetes is most useful when you understand both layers:

- The foundation layer: OCI, runtimes, namespaces, cgroups, `containerd`
- The platform layer: Deployments, Services, Ingress, storage, Helm, and managed clusters

Learn the local workflow first, then move to managed platforms with stronger operational practices around access, networking, observability, backup, and release safety.

## FAQ

### What is Kubernetes used for?

Kubernetes is used to run containerized applications across a cluster. It schedules workloads, restarts failed containers, exposes services, manages configuration, and supports controlled rollouts.

### Is Kubernetes the same as Docker?

No. Docker is commonly used to build and run containers. Kubernetes is a platform for operating containers across multiple nodes. A good learning path is [Docker first](../docker/docker.md), then [Kubernetes fundamentals](fundamentals.md).

### Should beginners use Minikube, Docker Desktop, or Podman?

Use [Minikube](labs/minikube-lab.md) when you want a dedicated local Kubernetes cluster. Use [Docker Desktop](labs/docker-lab.md) if it is already part of your daily workflow. Use [Podman](labs/podman-lab.md) when you want daemonless container tooling and Kubernetes-style YAML practice.

### What should I learn after Kubernetes basics?

Practice [hands-on scenarios](labs/hands-on-scenarios.md), then study [troubleshooting](operations/troubleshooting.md), [CI/CD pipelines](operations/cicd-pipelines.md), and [OpenShift](openshift/guide.md) if your target environment uses enterprise Kubernetes.

## Related Learning

- [Kubernetes quick reference](reference/quick-reference.md)
- [Kubernetes and OpenShift interview handbook](interview/questions.md)
- [Observability system design](../system-design/observability.md)
- [CI/CD platform design](../system-design/cicd-platform.md)

## Further Learning

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Minikube Documentation](https://minikube.sigs.k8s.io/docs/)
- [Rancher Desktop](https://rancherdesktop.io/)
- [Amazon EKS](https://aws.amazon.com/eks/)
- [OpenShift Developer Sandbox](https://developers.redhat.com/developer-sandbox)
