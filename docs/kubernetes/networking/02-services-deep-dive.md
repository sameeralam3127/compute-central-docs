---
title: "Kubernetes Services Deep Dive: Types, kube-proxy, EndpointSlices"
icon: lucide/share-2
description: All four Kubernetes Service types, headless Services, how kube-proxy implements them in iptables vs IPVS mode, EndpointSlices, and session affinity.
tags:
  - Kubernetes
  - Networking
---

# Services Deep Dive

## What You'll Learn

- What each of the four Service types actually does, and when to use each
- How kube-proxy turns a Service into real traffic routing — iptables mode vs. IPVS mode
- How Endpoints/EndpointSlices track which pods are live, and how session affinity works

## Why This Matters

A Service looks like a single YAML object with a `type` field, but that field selects between four genuinely different mechanisms — one is purely internal DNS/VIP routing, one opens a port on every node, one provisions cloud infrastructure, and one isn't really a proxy at all. Picking the wrong one is a common source of "why can't I reach this from outside the cluster" and "why is this exposed to the internet when it shouldn't be."

## Mental Model

> A Service is a stable virtual IP and DNS name in front of a changing set of pods. It exists because pod IPs are ephemeral — a Service gives callers something that doesn't change even as the pods behind it are created, killed, and replaced.

| Type | Reachable from | Mechanism |
|---|---|---|
| `ClusterIP` (default) | Inside the cluster only | Stable virtual IP, routed by kube-proxy |
| `NodePort` | Outside, via `<any-node-ip>:<30000-32767>` | Builds on ClusterIP, plus a port opened on every node |
| `LoadBalancer` | Outside, via a cloud load balancer's IP/DNS | Builds on NodePort, plus a cloud LB provisioned by the cloud controller manager |
| `ExternalName` | Internally, via DNS CNAME only | No proxying at all — just a DNS alias to an external name |

## How It Works

### ClusterIP and headless Services

```yaml
apiVersion: v1
kind: Service
metadata:
  name: checkout-api
spec:
  type: ClusterIP
  selector:
    app: checkout-api
  ports:
    - port: 80
      targetPort: 8080
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 3600
```

Setting `clusterIP: None` makes it **headless** — no virtual IP, no load-balancing. DNS queries for the Service name return the individual pod IPs directly (or, for a StatefulSet, stable per-pod DNS names). Use a headless Service when the client needs to pick or address a specific backend pod, not "any healthy one."

### NodePort and LoadBalancer

```yaml
apiVersion: v1
kind: Service
metadata:
  name: checkout-api-public
spec:
  type: LoadBalancer
  selector:
    app: checkout-api
  ports:
    - port: 443
      targetPort: 8443
      nodePort: 31443   # optional explicit port, otherwise auto-assigned 30000-32767
```

`LoadBalancer` is a superset of `NodePort`: the cloud controller manager provisions an external load balancer (ELB/ALB, Cloud Load Balancer, etc.) and points it at the NodePort on every node. In a bare-metal cluster with no cloud integration, `type: LoadBalancer` gets stuck `<pending>` forever unless something like MetalLB is installed to fulfill it.

### ExternalName

```yaml
apiVersion: v1
kind: Service
metadata:
  name: legacy-db
spec:
  type: ExternalName
  externalName: db.legacy.internal.example.com
```

No selector, no ports, no proxying — this just makes `legacy-db.default.svc.cluster.local` resolve as a CNAME to the external hostname, so in-cluster code can use a consistent internal name for something that lives outside the cluster.

### How kube-proxy actually implements a Service

```mermaid
flowchart LR
    A[Pod dials ClusterIP:80] --> B{kube-proxy mode}
    B -->|iptables| C[DNAT rule rewrites dest to a randomly chosen pod IP]
    B -->|IPVS| D[IPVS virtual server load-balances across registered real servers]
    C --> E[Pod IP:targetPort]
    D --> E
```

| Mode | How it works | Trade-offs |
|---|---|---|
| `iptables` (long-time default) | Chains of DNAT rules per Service/endpoint, evaluated roughly linearly | Simple, but rule count grows with Service count — slower updates at very large scale |
| `IPVS` | Kernel-level load balancer (Linux IPVS), Services registered as virtual servers | O(1) lookup regardless of Service count, more LB algorithm choices (round robin, least connection, etc.) — the better choice for large clusters |

Some CNI plugins (notably Cilium) replace kube-proxy's job entirely with an eBPF datapath, skipping iptables/IPVS altogether for lower latency and better observability.

### Endpoints and EndpointSlices

```bash
kubectl get endpoints checkout-api
kubectl get endpointslices -l kubernetes.io/service-name=checkout-api
```

The classic `Endpoints` object lists every ready pod IP for a Service in one flat object — this doesn't scale well past a few thousand pods behind one Service. `EndpointSlices` (the modern default) shard that list into multiple smaller objects, which is both more efficient to update and lets kube-proxy/CNI process incremental changes instead of rewriting one giant object every time a pod's readiness flips.

### Session affinity

`sessionAffinity: ClientIP` makes kube-proxy route repeated requests from the same client IP to the same backend pod, for up to `timeoutSeconds`. It's the closest thing a plain Service has to sticky sessions — there's no cookie-based affinity at the Service layer; that requires an Ingress controller or a service mesh.

## Common Mistakes

- Using `type: LoadBalancer` for every internal Service — each one provisions real, billed cloud infrastructure; internal-only traffic should stay `ClusterIP` and go through an Ingress if it needs a single external entry point.
- Expecting a headless Service to load-balance — by definition it doesn't; clients get all pod IPs and must choose (or rely on the client library to).
- Forgetting that Service selectors match on pod **labels**, not names — a typo'd label silently produces a Service with zero endpoints (`kubectl get endpoints` shows `<none>`).
- Assuming `sessionAffinity: ClientIP` behaves like cookie-based sticky sessions — it keys purely on source IP, which breaks down behind NAT or shared corporate egress IPs.
- Not checking kube-proxy mode when debugging performance at scale — a cluster still on `iptables` mode with thousands of Services can see real latency in rule evaluation and updates.

## Interview Questions

- Explain the difference between all four Service types and give a real use case for each.
- How does kube-proxy actually get traffic from a ClusterIP to a specific pod, in either mode?
- Why do EndpointSlices exist when Endpoints already did the job?
- What's the practical difference between a headless Service and a normal ClusterIP Service?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Ingress and Ingress Controllers](03-ingress-and-ingress-controllers.md) for routing HTTP/HTTPS traffic into multiple Services through one entry point.
