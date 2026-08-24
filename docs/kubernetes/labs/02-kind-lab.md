---
title: "kind Lab: Multi-Node Cluster and Local Image Loading"
icon: lucide/boxes
description: Install kind, create a multi-node cluster from a config file, build a local image, load it with kind load docker-image, deploy, and clean up.
tags:
  - Kubernetes
  - Labs
---

# kind Lab

[kind](https://kind.sigs.k8s.io/) (Kubernetes IN Docker) runs each cluster node as a Docker container. That makes it fast to create, trivial to script, and — uniquely useful for local development — able to load an image straight from your machine's Docker daemon into the cluster without ever pushing it to a registry.

This lab creates a three-node cluster from a config file, builds a small local image, loads it into the cluster, and deploys it.

## Prerequisites

- Docker installed and running
- `kubectl` installed (see the [Minikube Lab](01-minikube-lab.md) install steps if you skipped it)
- Go is **not** required — install the prebuilt binary below

## 1. Install kind

**macOS**

```bash
brew install kind
```

**Linux**

```bash
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.24.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind
```

Verify:

```bash
kind version
# kind v0.24.0 go1.22.6 linux/amd64
```

## 2. Define a multi-node cluster

Create a config file describing one control-plane node and two workers, and pin the node image so every run gives you the same Kubernetes version:

```yaml title="kind-config.yaml"
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    image: kindest/node:v1.31.0
    extraPortMappings:
      - containerPort: 30080
        hostPort: 30080
        protocol: TCP
  - role: worker
    image: kindest/node:v1.31.0
  - role: worker
    image: kindest/node:v1.31.0
```

`extraPortMappings` on the control-plane node is what lets a `NodePort` service inside the cluster be reachable at `localhost:30080` on your machine later in this lab.

## 3. Create the cluster

```bash
kind create cluster --name lab --config kind-config.yaml
```

Expected output (abbreviated):

```text
Creating cluster "lab" ...
 ✓ Ensuring node image (kindest/node:v1.31.0) 🖼
 ✓ Preparing nodes 📦 📦 📦
 ✓ Writing configuration 📜
 ✓ Starting control-plane 🕹️
 ✓ Installing CNI 🔌
 ✓ Installing StorageClass 💾
 ✓ Joining worker nodes 🚜
Set kubectl context to "kind-lab"
You can now use your cluster with:

kubectl cluster-info --context kind-lab
```

`kind create cluster` already switched your current `kubectl` context to `kind-lab`. Confirm all three nodes are `Ready`:

```bash
kubectl config current-context
# kind-lab

kubectl get nodes
# NAME                 STATUS   ROLES           AGE   VERSION
# lab-control-plane    Ready    control-plane   60s   v1.31.0
# lab-worker           Ready    <none>          40s   v1.31.0
# lab-worker2          Ready    <none>          40s   v1.31.0
```

## 4. Build a local image

Create a tiny app so the point of this lab — loading an image you built locally, with no registry involved — is obvious:

```dockerfile title="Dockerfile"
FROM nginx:1.27
RUN echo "served from a kind-loaded local image" > /usr/share/nginx/html/index.html
```

```bash
docker build -t local/hello-kind:1.0 .
docker images | grep local/hello-kind
```

## 5. Load the image into the cluster

```bash
kind load docker-image local/hello-kind:1.0 --name lab
```

```text
Image: "local/hello-kind:1.0" with ID "sha256:..." not yet present on node "lab-control-plane", loading...
Image: "local/hello-kind:1.0" with ID "sha256:..." not yet present on node "lab-worker", loading...
Image: "local/hello-kind:1.0" with ID "sha256:..." not yet present on node "lab-worker2", loading...
```

`kind load docker-image` copies the image directly into containerd on every node in the named cluster. No registry, no `docker push`, no image pull secret — this is the fastest inner loop for testing a locally built image against real Kubernetes scheduling and networking.

!!! warning "Set imagePullPolicy: IfNotPresent"
    If the Deployment's `imagePullPolicy` is `Always` (or unset on a tag Kubernetes treats as mutable), the kubelet will try to pull `local/hello-kind:1.0` from a registry, fail, and the pod will sit in `ImagePullBackOff` — even though the image is already loaded onto the node. Explicitly setting `IfNotPresent` is what makes the loaded image actually get used.

## 6. Deploy and expose it

```yaml title="hello-kind.yaml"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hello-kind
  labels:
    app: hello-kind
spec:
  replicas: 3
  selector:
    matchLabels:
      app: hello-kind
  template:
    metadata:
      labels:
        app: hello-kind
    spec:
      containers:
        - name: hello-kind
          image: local/hello-kind:1.0
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: hello-kind
spec:
  type: NodePort
  selector:
    app: hello-kind
  ports:
    - port: 80
      targetPort: 80
      nodePort: 30080
```

```bash
kubectl apply -f hello-kind.yaml
kubectl rollout status deployment/hello-kind
```

## 7. Verify

Confirm the pods actually landed on different worker nodes — this is the multi-node scheduling behavior a single-node minikube cluster can't demonstrate:

```bash
kubectl get pods -o wide
# NAME                          READY   STATUS    NODE
# hello-kind-6c8f9d5b7f-2f4kk   1/1     Running   lab-worker
# hello-kind-6c8f9d5b7f-9h2lm   1/1     Running   lab-worker2
# hello-kind-6c8f9d5b7f-vx8qc   1/1     Running   lab-worker
```

Because the control-plane node maps container port 30080 to `localhost:30080` on your machine (from the `extraPortMappings` in step 2), you can curl it directly — no `minikube service` / `kubectl port-forward` needed:

```bash
curl http://localhost:30080
# served from a kind-loaded local image
```

## Troubleshooting

- **Pod stuck in `ImagePullBackOff`** — almost always `imagePullPolicy` wasn't set to `IfNotPresent`, or the image tag loaded doesn't exactly match the tag in the manifest.
- **`curl localhost:30080` connection refused** — the `extraPortMappings` block only takes effect for nodes it's declared on; confirm it's under the `control-plane` node entry in `kind-config.yaml` and that you created the cluster with `--config kind-config.yaml`.
- **New image changes don't show up** — `kind load docker-image` doesn't overwrite an already-loaded image with the same tag reliably; bump the tag (`:1.1`) or delete the pods to force a re-pull from containerd's local cache.
- **Nodes stuck `NotReady`** — kind installs its own CNI automatically; if this happens, check `docker ps` shows all three `lab-*` containers running and `kubectl describe node <name>` for the actual condition.

## Cleanup

```bash
kubectl delete -f hello-kind.yaml
kind delete cluster --name lab
docker rmi local/hello-kind:1.0
```

## Next

Continue to the [Docker Desktop Lab](03-docker-desktop-lab.md) to compare this against the Kubernetes cluster built into Docker Desktop.
