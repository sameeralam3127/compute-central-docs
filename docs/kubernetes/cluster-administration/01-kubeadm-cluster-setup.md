---
title: "kubeadm Cluster Setup: init, join, and Control-Plane Topology"
icon: lucide/server-cog
description: How to bootstrap a Kubernetes cluster with kubeadm, why nodes stay NotReady until a CNI is installed, and stacked versus external etcd topologies.
tags:
  - Kubernetes
  - Cluster Administration
---

# kubeadm Cluster Setup

## What You'll Learn

- The exact sequence `kubeadm init` and `kubeadm join` run, and what each prerequisite actually does
- Why every node reports `NotReady` until you install a CNI plugin, and why that's expected
- The difference between stacked etcd and external etcd control-plane topologies, and when each earns its complexity

## Why This Matters

Most engineers only ever join an already-running managed cluster. But `kubeadm` is still how you stand up on-prem clusters, air-gapped clusters, and most Kubernetes certification labs — and understanding what it does under the hood is what turns "the cluster won't come up" from a panic into a checklist.

## Mental Model

`kubeadm` doesn't install Kubernetes for you — it bootstraps the minimum control plane needed for Kubernetes to take over managing itself. It generates certificates, writes static pod manifests for the control-plane components, and starts a single-node control plane that then admits more nodes via a join token. Everything after that first boot is regular Kubernetes reconciliation.

### Control-plane prerequisites

Before `kubeadm init` will succeed, every control-plane and worker host needs:

| Prerequisite | Why |
|---|---|
| A container runtime (containerd, CRI-O) implementing the CRI | kubelet doesn't run containers itself — it delegates to the runtime |
| Swap disabled | The kubelet refuses to start with swap on by default (memory accounting becomes unreliable) |
| Unique hostname, MAC address, and `product_uuid` per node | kubeadm and the scheduler use these as node identity; cloned VMs sometimes share them by accident |
| Required ports open between nodes (6443, 2379-2380, 10250-10259) | API server, etcd peer/client traffic, kubelet API, scheduler/controller-manager health |
| `br_netfilter` kernel module and `net.bridge.bridge-nf-call-iptables=1` | So iptables can see bridged traffic, which most CNI plugins depend on |

### Initializing the first control-plane node

```bash
sudo kubeadm init \
  --control-plane-endpoint "cp-lb.internal.example.com:6443" \
  --upload-certs \
  --pod-network-cidr 192.168.0.0/16

mkdir -p "$HOME"/.kube
sudo cp -i /etc/kubernetes/admin.conf "$HOME"/.kube/config
sudo chown "$(id -u)":"$(id -g)" "$HOME"/.kube/config
```

- `--control-plane-endpoint` should point at a load balancer or DNS name in front of the control plane, even for a single control-plane node — adding more later requires it to have been set from the start.
- `--pod-network-cidr` must match whatever CNI plugin you're about to install; get it wrong and pod-to-pod networking silently never works.
- `--upload-certs` lets additional control-plane nodes join without manually copying certificates around.

`kubeadm init` prints a `kubeadm join` command with a token and CA cert hash at the end — save it, it's how every other node gets in.

### The CNI-before-Ready gotcha

```bash
kubectl get nodes
# NAME           STATUS     ROLES           AGE   VERSION
# cp-1           NotReady   control-plane   90s   v1.30.4
```

This is expected. The kubelet reports `NotReady` until a CNI plugin is installed and pod networking is functional — the node has no way to give pods IP addresses yet. Install a CNI immediately after `init`:

```bash
kubectl apply -f https://raw.githubusercontent.com/cilium/cilium/v1.15.6/install/kubernetes/quick-install.yaml
```

Within a minute or two of the CNI's own pods becoming `Running`, the node flips to `Ready`. If it never does, the CNI's pod CIDR doesn't match `--pod-network-cidr`, or the CNI's DaemonSet pods themselves aren't scheduling — check `kubectl get pods -n kube-system` first.

### Joining more nodes

```bash
# Worker node
sudo kubeadm join cp-lb.internal.example.com:6443 \
  --token abcdef.0123456789abcdef \
  --discovery-token-ca-cert-hash sha256:1234...

# Additional control-plane node
sudo kubeadm join cp-lb.internal.example.com:6443 \
  --token abcdef.0123456789abcdef \
  --discovery-token-ca-cert-hash sha256:1234... \
  --control-plane \
  --certificate-key <key-from-upload-certs>
```

Join tokens expire after 24 hours by default. Generate a fresh one with `kubeadm token create --print-join-command` rather than reusing an old one from your shell history.

## Single vs. Stacked vs. External etcd Topologies

```mermaid
flowchart TB
    subgraph Stacked["Stacked etcd (default)"]
        direction LR
        CP1["Control plane 1<br/>API server + etcd"] --- CP2["Control plane 2<br/>API server + etcd"] --- CP3["Control plane 3<br/>API server + etcd"]
    end
    subgraph External["External etcd"]
        direction LR
        E1["etcd 1"] --- E2["etcd 2"] --- E3["etcd 3"]
        A1["API server 1"] -.-> E1
        A2["API server 2"] -.-> E2
        A3["API server 3"] -.-> E3
    end
```

| Topology | Layout | Failure blast radius | Operational cost |
|---|---|---|---|
| Single control plane | One node runs everything | Losing it takes down the whole control plane | Lowest — fine for dev/test |
| Stacked etcd HA | Each control-plane node co-locates its own etcd member | Losing a control-plane node loses an etcd member too, but the two fail together, which is simpler to reason about | Moderate — `kubeadm`'s default and best-documented HA path |
| External etcd HA | etcd runs on separate dedicated hosts, API servers connect to the etcd cluster remotely | A control-plane node can fail without touching etcd, and vice versa | Highest — more hosts to patch, monitor, and back up |

For most teams, stacked etcd with 3 control-plane nodes is the right default. External etcd is worth the extra hosts only when etcd's resource needs (see the next chapter) are so different from the API server's that co-locating them causes contention, or when you need to scale control-plane and etcd node counts independently.

## Common Mistakes

- Forgetting `--control-plane-endpoint` on the very first `kubeadm init`, then discovering it can't be added retroactively without rebuilding the control plane.
- Not installing a CNI right after `init` and assuming the cluster is broken because nodes sit `NotReady`.
- Reusing a join token from documentation or an old runbook instead of generating a fresh one — tokens are single-cluster and time-limited.
- Mismatching `--pod-network-cidr` against the CNI manifest's expected CIDR, causing pods to get no IP or the wrong IP range.
- Running `kubeadm init` a second time on a node that failed partway through, without `kubeadm reset` first, leaving stale certificates and static pod manifests behind.

## Interview Questions

- What exactly does `kubeadm init` set up, and what does it deliberately leave to you?
- Why does a freshly initialized control-plane node show `NotReady`, and what fixes it?
- When would you choose external etcd over the default stacked topology?
- What's the role of `--control-plane-endpoint`, and why must it be set before the first node joins?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [etcd and Control Plane Internals](02-etcd-and-control-plane-internals.md) to understand what that etcd member you just stood up is actually doing for the cluster.
