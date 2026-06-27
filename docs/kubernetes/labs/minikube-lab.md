---
description: Practice Kubernetes locally with Minikube by starting a cluster, deploying a sample app, checking rollout status, debugging pods, and cleaning up safely.
---

# Kubernetes Lab with Minikube Guide

This lab gives you a practical Minikube workflow for local Kubernetes practice. Use it when you want a small, disposable cluster for learning Deployments, Services, logs, rollout checks, and cleanup commands.

## What You Will Learn

- Start a local Kubernetes cluster with Minikube
- Confirm your `kubectl` context before applying resources
- Deploy and expose a small application
- Validate pods, services, logs, and rollout status
- Stop or delete the cluster when the lab is finished

## Prerequisites

- Docker, Podman, HyperKit, VirtualBox, or another supported Minikube driver
- `minikube` installed
- `kubectl` installed
- At least 2 CPUs and 4 GB RAM available for a small local cluster

!!! tip "Use a disposable cluster"
    Local labs are best for learning commands and object behavior. Do not treat a successful Minikube test as proof that production networking, storage, or security settings are complete.

## Suggested Flow

1. Start Minikube with your preferred driver.
2. Confirm the cluster and current namespace context.
3. Apply a sample Deployment and Service.
4. Check rollout status and logs.
5. Stop or delete the cluster when the exercise is finished.

## Step-by-Step Lab

Start a cluster with the Docker driver:

```bash
minikube start --driver=docker
```

Confirm that `kubectl` is pointing at Minikube:

```bash
kubectl config current-context
kubectl get nodes
```

Create a sample Deployment with a pinned image:

```bash
kubectl create deployment hello-minikube --image=nginx:1.27
kubectl rollout status deployment/hello-minikube
```

Expose the Deployment with a Service:

```bash
kubectl expose deployment hello-minikube --type=NodePort --port=80
kubectl get service hello-minikube
```

Open or inspect the service URL:

```bash
minikube service hello-minikube --url
```

## Quick Validation

```bash
minikube start --driver=docker
kubectl get nodes
kubectl get pods -A
kubectl rollout status deployment/hello-minikube
kubectl logs deployment/hello-minikube
```

## Troubleshooting

- If Minikube fails to start, check the selected driver and available CPU/RAM.
- If `kubectl` points to another cluster, run `kubectl config use-context minikube`.
- If the Service URL does not respond, verify the pod is running with `kubectl get pods`.
- If the image pull fails, check internet access and the image tag.

## Cleanup

Remove only the sample workload:

```bash
kubectl delete service hello-minikube
kubectl delete deployment hello-minikube
```

Stop or delete the full lab cluster:

```bash
minikube stop
minikube delete
```

## Next Steps

- Try the [hands-on Kubernetes scenarios](hands-on-scenarios.md)
- Review [Kubernetes fundamentals](../fundamentals.md)
- Keep [Kubernetes quick reference](../reference/quick-reference.md) open while practicing
