---
description: Practice Kubernetes-style local workflows with Podman, podman kube commands, pinned images, validation checks, logs, and safe cleanup steps.
---

# Kubernetes Lab with Podman Guide

This page gives a practical Podman-based workflow for local Kubernetes experiments where the environment supports it. Podman is useful when you want daemonless container tooling and want to understand how container pods map to Kubernetes-style manifests.

## What You Will Learn

- Confirm Podman and Kubernetes CLI prerequisites
- Run a local container workload with a pinned image
- Generate Kubernetes YAML from a Podman workload
- Validate logs and container state
- Clean up local resources safely

## Prerequisites

- Podman installed
- `kubectl` installed if you will apply generated YAML to a cluster
- A local Kubernetes environment such as Minikube, Kind, or OpenShift Local if you want to run the manifest
- Basic comfort with container images, ports, and logs

!!! note "Podman and Kubernetes"
    Podman can generate Kubernetes-style YAML for local containers and pods. To run that YAML as real Kubernetes objects, you still need a Kubernetes cluster.

## Suggested Flow

1. Confirm Podman and `kubectl` are installed.
2. Start the local cluster or lab environment.
3. Deploy a small workload with a pinned image tag.
4. Validate networking, logs, and rollout behavior.
5. Tear down the environment after testing.

## Step-by-Step Lab

Check your local tools:

```bash
podman --version
kubectl version --client
```

Run a simple container with a pinned image:

```bash
podman run -d --name podman-web -p 8080:80 nginx:1.27
podman ps
```

Test the container:

```bash
curl http://localhost:8080
podman logs podman-web
```

Generate Kubernetes YAML from the running container:

```bash
podman generate kube podman-web > podman-web.yaml
```

If you have a local Kubernetes cluster ready, apply the generated manifest in a test namespace:

```bash
kubectl create namespace podman-lab
kubectl apply -f podman-web.yaml -n podman-lab
kubectl get pods -n podman-lab
```

## Quick Validation

```bash
podman ps
podman logs podman-web
kubectl get nodes
kubectl get pods -n podman-lab
kubectl describe pod <pod-name> -n podman-lab
kubectl logs <pod-name> -n podman-lab
```

## Troubleshooting

- If `curl` fails, confirm the Podman container is running and port `8080` is free.
- If `podman generate kube` fails, check that the container name is correct.
- If `kubectl apply` fails, confirm a Kubernetes cluster is running and your context is correct.
- If a pod cannot pull the image, check network access and image policy restrictions.

## Cleanup

```bash
kubectl delete namespace podman-lab
podman rm -f podman-web
rm podman-web.yaml
```

## Next Steps

- Compare this with the [Docker Desktop lab](docker-lab.md)
- Practice a full cluster workflow in the [Minikube lab](minikube-lab.md)
- Review [Kubernetes fundamentals](../fundamentals.md)
