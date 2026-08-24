---
title: "Docker Desktop Kubernetes Lab: Local Cluster Walkthrough"
icon: lucide/container
description: Enable Kubernetes in Docker Desktop, deploy and expose a pinned-image workload, inspect pods and events, and clean up — full commands and output.
tags:
  - Kubernetes
  - Labs
---

# Docker Desktop Lab

Docker Desktop ships a full single-node Kubernetes cluster you can turn on with a checkbox — useful if you already run Docker Desktop daily and don't want a second tool to manage for local Kubernetes work.

## Prerequisites

- Docker Desktop installed (macOS or Windows)
- `kubectl` installed (bundled with Docker Desktop, or install separately)
- At least 4 GB of memory allocated to Docker Desktop in Settings → Resources

## 1. Enable Kubernetes

Docker Desktop → **Settings** → **Kubernetes** → check **Enable Kubernetes** → **Apply & Restart**.

This takes a couple of minutes the first time — Docker Desktop is pulling and starting the actual control-plane components.

## 2. Confirm the context

Docker Desktop registers a `docker-desktop` context and normally switches to it automatically. Don't skip this check if you also have minikube or kind clusters configured — it's easy to apply a manifest to the wrong one.

```bash
kubectl config get-contexts
kubectl config current-context
# docker-desktop
```

If it's pointed elsewhere:

```bash
kubectl config use-context docker-desktop
```

Check the cluster is actually healthy:

```bash
kubectl cluster-info
kubectl get nodes
# NAME             STATUS   ROLES           AGE   VERSION
# docker-desktop   Ready    control-plane   5m    v1.31.0
```

## 3. Deploy a workload

```bash
kubectl create namespace docker-desktop-lab

kubectl create deployment web \
  --image=nginx:1.27 \
  --replicas=2 \
  -n docker-desktop-lab

kubectl rollout status deployment/web -n docker-desktop-lab
```

```text
Waiting for deployment "web" rollout to finish: 0 of 2 updated replicas are available...
deployment "web" successfully rolled out
```

## 4. Expose it

Docker Desktop's Kubernetes has working `LoadBalancer` support out of the box — services of that type get `localhost` as their external address, no cloud provider needed:

```bash
kubectl expose deployment web \
  --type=LoadBalancer \
  --port=80 \
  --target-port=80 \
  -n docker-desktop-lab

kubectl get service web -n docker-desktop-lab
```

```text
NAME   TYPE           CLUSTER-IP     EXTERNAL-IP   PORT(S)        AGE
web    LoadBalancer   10.103.42.1    localhost     80:31894/TCP   10s
```

```bash
curl http://localhost:80
```

You should see the nginx welcome page. If you'd rather not bind port 80, `kubectl port-forward` works too and doesn't require the Service to be `LoadBalancer`:

```bash
kubectl port-forward service/web 8080:80 -n docker-desktop-lab
```

```bash
curl http://localhost:8080
```

## 5. Inspect pods, events, and logs

```bash
kubectl get pods -n docker-desktop-lab -o wide
kubectl describe pod -l app=web -n docker-desktop-lab
kubectl get events -n docker-desktop-lab --sort-by=.metadata.creationTimestamp
kubectl logs deployment/web -n docker-desktop-lab
```

`describe pod` is the single most useful command when something doesn't come up as expected — its `Events` section at the bottom shows the scheduler's and kubelet's actual decisions (image pull, container create, readiness state) in order.

!!! tip "Resource limits matter here too"
    Docker Desktop's Kubernetes node has exactly as much CPU/memory as you've allocated to Docker Desktop overall. A pod stuck `Pending` on this lab is almost always a resources problem, not a Kubernetes problem — check Settings → Resources before debugging further.

## Troubleshooting

- **`kubectl` can't connect** — Docker Desktop's Kubernetes takes a minute to finish starting after "Enable Kubernetes"; check the whale icon shows "Kubernetes is running" before retrying.
- **Wrong context** — `kubectl config use-context docker-desktop`.
- **Port 80 already in use** — expose with a different `--target-port`/use `port-forward` on a free local port instead (`8081:80`).
- **Pod `Pending`** — check `kubectl describe pod` events for `Insufficient cpu`/`Insufficient memory`, then raise the CPU/memory allocated to Docker Desktop.

## Cleanup

```bash
kubectl delete namespace docker-desktop-lab
```

To fully remove the cluster (not just this lab's objects), uncheck **Enable Kubernetes** in Docker Desktop settings — this deletes all cluster state.

## Next

Continue to the [Podman Lab](04-podman-lab.md) for a daemonless alternative and generating Kubernetes YAML directly from a running container.
