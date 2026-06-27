---
description: Learn Kubernetes with Docker Desktop by enabling the built-in cluster, deploying a test workload, exposing it, validating logs, and cleaning up resources.
---

# Kubernetes Lab with Docker Desktop Guide

This lab shows a simple flow for running Kubernetes practice workloads with Docker Desktop. It is useful when you already use Docker Desktop and want a local Kubernetes cluster without managing a separate VM.

## What You Will Learn

- Enable and verify Docker Desktop Kubernetes
- Confirm your current `kubectl` context
- Deploy a small application with a pinned image
- Expose the application locally
- Inspect pods, services, events, and logs
- Clean up the resources after testing

## Prerequisites

- Docker Desktop installed
- Kubernetes enabled in Docker Desktop settings
- `kubectl` available in your terminal
- Enough CPU and memory allocated to Docker Desktop for a small cluster

!!! note "Context matters"
    Docker Desktop usually uses the `docker-desktop` context. Always confirm the context before applying manifests so you do not accidentally deploy to another cluster.

## Suggested Flow

1. Enable Kubernetes in Docker Desktop.
2. Confirm the current context with `kubectl config current-context`.
3. Check cluster health with `kubectl get nodes`.
4. Deploy a small sample workload and expose it with a Service.
5. Clean up the resources after testing.

## Step-by-Step Lab

Confirm your cluster context:

```bash
kubectl config current-context
kubectl cluster-info
kubectl get nodes
```

Create a namespace for the lab:

```bash
kubectl create namespace docker-lab
```

Deploy a small web server:

```bash
kubectl create deployment web --image=nginx:1.27 -n docker-lab
kubectl rollout status deployment/web -n docker-lab
```

Expose the Deployment:

```bash
kubectl expose deployment web --port=80 --target-port=80 -n docker-lab
kubectl port-forward service/web 8080:80 -n docker-lab
```

In another terminal, test the service:

```bash
curl http://localhost:8080
```

## Quick Validation

```bash
kubectl cluster-info
kubectl get nodes
kubectl get pods -A
kubectl get all -n docker-lab
kubectl logs deployment/web -n docker-lab
```

## Troubleshooting

- If `kubectl` cannot connect, confirm Kubernetes is enabled and Docker Desktop has finished starting.
- If the context is wrong, switch with `kubectl config use-context docker-desktop`.
- If port `8080` is busy, use another local port such as `8081:80`.
- If the pod is pending, check Docker Desktop CPU and memory limits.

## Cleanup

```bash
kubectl delete namespace docker-lab
```

## Next Steps

- Continue with the [Minikube lab](minikube-lab.md) to compare local cluster workflows
- Practice larger examples in [hands-on Kubernetes scenarios](hands-on-scenarios.md)
- Review [Kubernetes troubleshooting](../operations/troubleshooting.md)
