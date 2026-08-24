---
title: "Podman Lab: Kube YAML Generation and Daemonless Containers"
icon: lucide/box
description: Run a rootless Podman container, generate Kubernetes YAML from it with podman generate kube, apply it to a real cluster, and validate the result.
tags:
  - Kubernetes
  - Labs
---

# Podman Lab

Podman runs containers without a background daemon, and it speaks Kubernetes' pod model natively — `podman generate kube` turns a running container (or pod) into a Kubernetes manifest, and `podman play kube` runs that manifest locally without a cluster at all. This lab uses both, then applies the generated YAML to a real cluster to confirm it behaves the same way.

## Prerequisites

- Podman installed
- `kubectl` installed
- A local cluster to apply the generated manifest to — the [kind Lab](02-kind-lab.md) or [Minikube Lab](01-minikube-lab.md) both work; this lab assumes a cluster named `lab` is already running

## 1. Install Podman

**macOS** (Podman needs a Linux VM on macOS — `podman machine` manages it)

```bash
brew install podman
podman machine init
podman machine start
```

**Linux**

```bash
sudo dnf install -y podman   # Fedora/RHEL
# or
sudo apt-get install -y podman   # Debian/Ubuntu
```

Verify:

```bash
podman --version
kubectl version --client
```

## 2. Run a container with a pinned image

```bash
podman run -d --name podman-web -p 8080:80 nginx:1.27
podman ps
```

```text
CONTAINER ID  IMAGE                 COMMAND               PORTS                 NAMES
a1b2c3d4e5f6  docker.io/library/nginx:1.27  nginx -g ...  0.0.0.0:8080->80/tcp  podman-web
```

```bash
curl http://localhost:8080
podman logs podman-web
```

!!! note "Rootless by default"
    On Linux, `podman run` above runs fully rootless — no daemon, no root privileges. This is Podman's core difference from the Docker CLI, and it's part of why `podman generate kube` output tends to translate cleanly onto Kubernetes, which also runs containers without root by default under a properly configured `securityContext`.

## 3. Generate Kubernetes YAML from it

```bash
podman generate kube podman-web > podman-web.yaml
```

```yaml title="podman-web.yaml (excerpt)"
apiVersion: v1
kind: Pod
metadata:
  labels:
    app: podman-web
  name: podman-web
spec:
  containers:
    - name: podman-web
      image: docker.io/library/nginx:1.27
      ports:
        - containerPort: 80
          hostPort: 8080
      resources: {}
```

Podman generated a bare `Pod`, not a `Deployment` — fine for this lab, but note that a bare Pod has no self-healing or scaling. Real workloads should wrap this in a `Deployment` before running it anywhere persistent.

## 4. Apply it to a real cluster

Point `kubectl` at your kind (or minikube) cluster and apply the generated manifest into its own namespace:

```bash
kubectl config use-context kind-lab
kubectl create namespace podman-lab
kubectl apply -f podman-web.yaml -n podman-lab
kubectl get pods -n podman-lab
```

```text
NAME         READY   STATUS    RESTARTS   AGE
podman-web   1/1     Running   0          8s
```

## 5. Validate on both sides

```bash
# Podman side
podman ps
podman logs podman-web

# Kubernetes side
kubectl get pods -n podman-lab
kubectl describe pod podman-web -n podman-lab
kubectl logs podman-web -n podman-lab
```

Both should show the same nginx image serving the same default page — the manifest Podman generated really is a working Kubernetes Pod spec, not just a superficially similar file.

## 6. Optional: run the same manifest with no cluster at all

`podman play kube` interprets Kubernetes YAML directly with Podman, no cluster required — useful for a quick local sanity check before you ever touch `kubectl`:

```bash
podman play kube podman-web.yaml
podman pod ps
podman play kube --down podman-web.yaml
```

## Troubleshooting

- **`curl localhost:8080` fails** — confirm the Podman container is actually running: `podman ps`. On macOS, confirm `podman machine list` shows the machine `Running`.
- **`podman generate kube` errors** — double-check the container name matches exactly (`podman ps` output), and that the container is still running (a stopped container has no live config to inspect for some fields).
- **`kubectl apply` fails or times out** — confirm a cluster is actually up and current (`kubectl config current-context`, `kubectl get nodes`).
- **Pod can't pull the image on the cluster** — if you're using kind, remember it doesn't share Podman's local image store; the cluster pulls `nginx:1.27` from the registry independently, so this only fails if the cluster itself lacks network access.

## Cleanup

```bash
kubectl delete namespace podman-lab
podman rm -f podman-web
rm podman-web.yaml
```

## Next

Continue to [Hands-On Scenarios](05-hands-on-scenarios.md) for longer, guided multi-part exercises that build on everything from the previous four labs.
