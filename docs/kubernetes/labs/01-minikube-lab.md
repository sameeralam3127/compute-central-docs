---
title: "Minikube Lab: Local Kubernetes Cluster Walkthrough"
icon: lucide/play
description: Install minikube, start a local cluster, deploy and expose a pinned-image app, inspect pods and rollouts, then clean up — full commands and output.
tags:
  - Kubernetes
  - Labs
---

# Minikube Lab

Minikube runs a real single-node Kubernetes cluster inside a VM or container on your machine. It's the fastest way to get a disposable cluster for practicing `kubectl` without touching a shared environment.

## Prerequisites

- A driver: Docker or Podman (recommended), or a hypervisor such as HyperKit/VirtualBox
- 2+ CPUs and 4 GB RAM free
- 20 GB free disk

!!! note "This lab assumes the Docker driver"
    Every command below uses `--driver=docker`. If you're using Podman instead, replace it with `--driver=podman` — the rest of the lab is identical.

## 1. Install kubectl and minikube

**macOS**

```bash
brew install kubectl minikube
```

**Linux**

```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

curl -LO https://storage.googleapis.com/minikube/releases/v1.34.0/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
```

Verify both installed:

```bash
kubectl version --client
minikube version
```

## 2. Start the cluster

```bash
minikube start --driver=docker --cpus=2 --memory=4096
```

Expected tail of output:

```text
🏄  Done! kubectl is now configured to use "minikube" cluster and "default" namespace by default
```

Confirm `kubectl` is actually pointed at minikube, not some other cluster you have configured:

```bash
kubectl config current-context
# minikube

kubectl get nodes
# NAME       STATUS   ROLES           AGE   VERSION
# minikube   Ready    control-plane   30s   v1.31.0
```

!!! warning "Always check the context first"
    `kubectl` operates against whatever context is current. If you have other clusters in your kubeconfig, run `kubectl config current-context` before applying anything — it's the single most common way people accidentally deploy a test workload to the wrong cluster.

## 3. Enable the metrics-server addon

You'll want this for `kubectl top` later, and most of the [case studies](../case-studies/index.md) assume it's available:

```bash
minikube addons enable metrics-server
kubectl get deployment metrics-server -n kube-system
```

## 4. Deploy a real workload

Create a namespace to keep this lab's objects isolated:

```bash
kubectl create namespace minikube-lab
```

Deploy nginx with a pinned tag and three replicas:

```bash
kubectl create deployment hello-minikube \
  --image=nginx:1.27 \
  --replicas=3 \
  -n minikube-lab

kubectl rollout status deployment/hello-minikube -n minikube-lab
```

Expected output:

```text
Waiting for deployment "hello-minikube" rollout to finish: 0 of 3 updated replicas are available...
deployment "hello-minikube" successfully rolled out
```

## 5. Expose it

```bash
kubectl expose deployment hello-minikube \
  --type=NodePort \
  --port=80 \
  -n minikube-lab

kubectl get service hello-minikube -n minikube-lab
```

Minikube runs inside a VM/container, so `NodePort` alone usually isn't directly reachable from your host — use `minikube service` to get a working tunnel and URL:

```bash
minikube service hello-minikube -n minikube-lab --url
```

```text
http://192.168.49.2:31842
```

```bash
curl "$(minikube service hello-minikube -n minikube-lab --url)"
```

You should see the default nginx welcome page HTML.

## 6. Inspect the workload

```bash
kubectl get pods -n minikube-lab -o wide
kubectl describe deployment hello-minikube -n minikube-lab
kubectl logs deployment/hello-minikube -n minikube-lab
kubectl exec -it deploy/hello-minikube -n minikube-lab -- nginx -v
```

Watch a rolling update in real time by bumping the image tag in one terminal while `rollout status` runs in another:

```bash
kubectl set image deployment/hello-minikube nginx=nginx:1.27.1 -n minikube-lab
kubectl rollout status deployment/hello-minikube -n minikube-lab
kubectl rollout history deployment/hello-minikube -n minikube-lab
```

!!! tip "Open the dashboard"
    `minikube dashboard` opens a browser-based view of everything in the cluster. It's a good way to see object relationships visually while you're still building intuition, but don't make it your daily driver — prefer `kubectl` and manifests once you're past the learning stage.

## Troubleshooting

- **Minikube won't start** — check the driver is installed and running (`docker info` for the Docker driver) and that you have the CPU/RAM minikube asked for.
- **`kubectl` points somewhere else** — `kubectl config use-context minikube`.
- **Service URL doesn't respond** — confirm the pod is `Running`: `kubectl get pods -n minikube-lab`. A `Pending` pod usually means insufficient CPU/memory on the node.
- **Image pull fails** — check internet access from inside the minikube VM/container and that the tag exists: `minikube ssh -- docker pull nginx:1.27`.

## Cleanup

Remove just the lab's objects and keep the cluster running:

```bash
kubectl delete namespace minikube-lab
```

Or tear down the entire cluster:

```bash
minikube stop
minikube delete
```

## Next

Continue to the [kind Lab](02-kind-lab.md) for a multi-node cluster and loading locally built images without a registry.
