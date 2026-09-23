---
title: "Fix Kubernetes ImagePullBackOff and ErrImagePull"
icon: lucide/cloud-off
description: "Fix Kubernetes ImagePullBackOff and ErrImagePull: bad tags, missing registry credentials, rate limits, and architecture mismatches, with the commands."
tags:
  - Kubernetes
  - Troubleshooting
  - ImagePullBackOff
---

# Fix Kubernetes ImagePullBackOff and ErrImagePull

## Problem

A pod is stuck in `ErrImagePull` or `ImagePullBackOff`: the node can't download the container image, so the container never starts.

```text
NAME                        READY   STATUS             RESTARTS   AGE
orders-api-7c9d8b6f5-k2x4p  0/1     ImagePullBackOff   0          4m
```

`ErrImagePull` is the first failed attempt. `ImagePullBackOff` means the kubelet is waiting before retrying, with delays that grow up to five minutes.

## Symptoms

- `RESTARTS` stays at `0` — the container has never run, so there are no logs.
- Events show `Failed to pull image`, followed by `Back-off pulling image`.
- A rollout stalls with new pods stuck while old pods keep serving.
- It may affect only some nodes (for example, new nodes without registry access, or a different CPU architecture).

## Likely Causes

The error message in the events almost always names the cause. Match it:

| Message in events (abridged) | Cause |
|---|---|
| `manifest unknown`, `not found` | Tag or digest doesn't exist in that repository |
| `pull access denied`, `repository does not exist or may require authorization` | Wrong repository name, or a private image with no credentials |
| `unauthorized: authentication required`, `401 Unauthorized` | Credentials missing, wrong, or expired |
| `403 Forbidden`, `denied` | Credentials valid but not allowed to pull that repository |
| `toomanyrequests`, `You have reached your pull rate limit` | Registry rate limit (common with anonymous Docker Hub pulls) |
| `no match for platform in manifest` | Image not built for the node's CPU architecture |
| `dial tcp: lookup … no such host` | DNS resolution failing on the node |
| `i/o timeout`, `context deadline exceeded` | Network path to the registry blocked (firewall, NAT, proxy, missing VPC endpoint) |
| `x509: certificate signed by unknown authority` | Private registry with a CA the node doesn't trust |

## Diagnostic Commands

```bash
# 1. The exact error
kubectl describe pod orders-api-7c9d8b6f5-k2x4p | sed -n '/Events:/,$p'

# 2. The image reference Kubernetes is trying to pull
kubectl get pod orders-api-7c9d8b6f5-k2x4p \
  -o jsonpath='{range .spec.containers[*]}{.name}{"\t"}{.image}{"\n"}{end}'

# 3. Which pull secrets the pod actually has (directly or via its service account)
kubectl get pod orders-api-7c9d8b6f5-k2x4p -o jsonpath='{.spec.imagePullSecrets}{"\n"}'
kubectl get serviceaccount "$(kubectl get pod orders-api-7c9d8b6f5-k2x4p -o jsonpath='{.spec.serviceAccountName}')" -o yaml

# 4. Does the tag exist, and for which platforms? (from your workstation)
docker buildx imagetools inspect registry.example.com/orders-api:2.14.0

# 5. Which node, and its architecture
kubectl get pod orders-api-7c9d8b6f5-k2x4p -o wide
kubectl get node <node-name> -o jsonpath='{.status.nodeInfo.architecture}{"\n"}'
```

On a node you can access (or through `kubectl debug node/<name> -it --image=busybox`), pull the image with the container runtime directly to separate Kubernetes configuration from network and registry problems:

```bash
crictl pull registry.example.com/orders-api:2.14.0
```

## Step-by-Step Debugging

1. **Copy the exact error from events.** Don't guess from the status — the message distinguishes a typo from an auth problem from a network problem.
2. **Verify the reference.** Check registry host, repository path, tag, and digest character by character. `orders-api:2.14` and `orders-api:2.14.0` are different tags.
3. **Confirm the tag exists** with `docker buildx imagetools inspect`, and note the platforms it was built for.
4. **Check credentials** if the error mentions authorization: is a pull secret attached, does it target the right registry host, and is it still valid?
5. **Check the node's path to the registry** if the error is a timeout or DNS failure — this is a network problem, not a Kubernetes manifest problem.
6. **Check whether only some nodes fail.** If the pod works on one node pool but not another, compare architecture, network placement, and node IAM roles.

## Solutions

### The tag doesn't exist

```bash
kubectl set image deployment/orders-api app=registry.example.com/orders-api:2.14.0
```

Make CI deploy the exact tag or digest it just pushed, so a manifest can't reference an image that was never built.

### Private registry credentials

```bash
kubectl create secret docker-registry regcred \
  --namespace orders \
  --docker-server=registry.example.com \
  --docker-username=deploy-bot \
  --docker-password="$REGISTRY_TOKEN"

# Attach to the service account the pods use, so every workload inherits it
kubectl patch serviceaccount orders-api -n orders \
  -p '{"imagePullSecrets": [{"name": "regcred"}]}'
```

Pull secrets are namespaced: a secret in `default` doesn't help pods in `orders`. Existing pods don't pick up a patched service account — restart the rollout:

```bash
kubectl rollout restart deployment/orders-api -n orders
```

### Cloud registries (ECR, Artifact Registry, ACR)

Prefer node or workload identity over static pull secrets:

- **Amazon ECR:** give the node IAM role `ecr:GetAuthorizationToken` and read access to the repositories (for example the `AmazonEC2ContainerRegistryReadOnly` managed policy). ECR authorization tokens expire after 12 hours, so hand-created docker-registry secrets from `aws ecr get-login-password` stop working.
- **Google Artifact Registry and Azure Container Registry:** grant the node or cluster identity reader access to the registry.

### Rate limits

Authenticate pulls, mirror images into your own registry, or use a pull-through cache (for example ECR pull-through cache rules for Docker Hub). Pin images by digest and avoid `imagePullPolicy: Always` on tags that rarely change, so nodes reuse cached layers.

### Architecture mismatch

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t registry.example.com/orders-api:2.14.0 --push .
```

Or schedule the workload onto matching nodes with `nodeSelector: {kubernetes.io/arch: amd64}` until a multi-platform image exists.

### Network and DNS

From a debug pod on the affected node, test resolution and connectivity to the registry:

```bash
nslookup registry.example.com
wget -S --spider https://registry.example.com/v2/ 2>&1 | head
```

In private subnets, pulls need a NAT gateway or registry VPC endpoints (for ECR: the `ecr.api`, `ecr.dkr`, and S3 gateway endpoints). See [AWS VPC Networking](../../cloud/aws/03-vpc-networking.md#vpc-endpoints-reach-aws-services-privately).

## Prevention

- Deploy immutable tags or digests produced by the same CI run that built them.
- Attach pull credentials through service accounts or node identity, not per-Deployment copies.
- Mirror third-party images into a registry you control.
- Build multi-platform images whenever clusters mix `amd64` and `arm64` nodes.
- Add an admission policy that only allows approved registries — see [Image and Supply Chain Security](../security/05-image-and-supply-chain-security.md).

## Production Considerations

- **Rollouts protect you here.** With `maxUnavailable: 0`, old pods keep serving while new pods fail to pull. Roll back or fix the tag; don't scale old ReplicaSets manually.
- **Node replacement exposes hidden dependencies.** Images cached on old nodes mask missing credentials until a new node pulls for the first time — often during an autoscaling event, when you can least afford it.
- **Watch for registry outages.** Alert on events with reason `Failed` and message `Failed to pull image` across the cluster, not per pod.

## Related Problems

- [Pod stuck in Pending](pod-pending.md) — not scheduled yet, so no pull is attempted
- [CrashLoopBackOff](crashloopbackoff.md) — the image pulled and started, then exited
- [Init container failures](init-container-failures.md) — `Init:ImagePullBackOff` for init container images
- [Container Images: layers, tags, and digests](../../docker/16-container-images.md)
- [All pod startup errors](01-pod-scheduling-and-startup-problems.md)
