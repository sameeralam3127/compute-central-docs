---
title: "Kubernetes Services Explained: ClusterIP, NodePort, LoadBalancer"
icon: lucide/network
description: Services as stable network identity for a moving set of Pods, and an intro-level look at the four Service types — ClusterIP, NodePort, LoadBalancer, and ExternalName.
tags:
  - Kubernetes
  - Core Concepts
---

# Services

## What You'll Learn

- Why Pods need a stable network abstraction sitting in front of them
- The four Service types, and which problem each one solves
- How a Service actually finds the Pods it should route to

## Why This Matters

Every Pod IP is disposable — a rollout, a crash, or a reschedule replaces it. If clients had to track individual Pod IPs, every deployment would break every client. A Service exists to make that non-issue: it's the one address that stays the same while everything behind it churns.

## Mental Model

> A Service is a stable virtual IP and DNS name that load-balances traffic across whichever Pods currently match its selector — updated automatically, every time a matching Pod appears or disappears.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: hello-web
spec:
  type: ClusterIP
  selector:
    app: hello-web
  ports:
    - protocol: TCP
      port: 80
      targetPort: 80
```

That `selector` is the whole mechanism: the Service controller continuously watches for Pods matching `app: hello-web` and keeps an **Endpoints** (or `EndpointSlice`) object listing their current IPs up to date. `kube-proxy` on every node reads that list and programs local routing rules so traffic to the Service's virtual IP gets load-balanced across those Pods — see [Architecture and the Control Plane](../getting-started/02-architecture-and-control-plane.md) for where kube-proxy sits in the bigger picture.

```bash
kubectl get endpoints hello-web
```

If that command shows no addresses, the Service's selector doesn't match any `Ready` Pod — the single most common "Service not working" root cause, covered fully in [Labels, Selectors, and Annotations](05-labels-selectors-and-annotations.md).

## The Four Service Types (Intro Level)

| Type | Reachable from | Typical use |
|---|---|---|
| **ClusterIP** (default) | Inside the cluster only, via a stable virtual IP | Internal service-to-service traffic — the default for anything not meant to face the internet directly |
| **NodePort** | Any node's IP, on a static port in the 30000–32767 range | Quick external access without a cloud load balancer, often used behind a manually configured external LB |
| **LoadBalancer** | The internet, via a cloud provider–provisioned load balancer | Public-facing services on a cloud-managed cluster — the cloud-controller-manager provisions the actual LB |
| **ExternalName** | Not a Pod-routing Service at all — returns a CNAME to an external DNS name | Giving an in-cluster DNS name to something outside the cluster, like a managed database endpoint |

```bash
# ClusterIP is the default — no --type needed
kubectl expose deployment hello-web --port=80 --target-port=80

# NodePort — reachable at <any-node-ip>:<allocated-port>
kubectl expose deployment hello-web --port=80 --target-port=80 --type=NodePort

# LoadBalancer — cloud provider provisions an external LB
kubectl expose deployment hello-web --port=80 --target-port=80 --type=LoadBalancer
```

A `LoadBalancer` Service is actually a superset of `NodePort`, which is itself a superset of `ClusterIP` — each type adds a layer of external reachability on top of the one before it, rather than replacing it.

## Where the Depth Actually Lives

This page is deliberately the "know what to reach for" level. The mechanics of how `kube-proxy` implements Services under the hood (iptables vs. IPVS mode), headless Services (`clusterIP: None`) for direct Pod-to-Pod addressing — the pattern StatefulSets depend on — and multi-port/named-port Services all get the full treatment in [Services Deep Dive](../networking/02-services-deep-dive.md).

## Common Mistakes

- Expecting a `ClusterIP` Service to be reachable from outside the cluster — it never is, by design; that's what `NodePort` and `LoadBalancer` are for.
- Creating an `Ingress` and assuming it works without any Service behind it, or without an Ingress controller installed at all — Ingress routes to Services, it doesn't replace them.
- Forgetting that a Service's selector must match the Pod's *labels*, not its name — a typo in either place produces a Service with zero endpoints and no error message.

## Interview Questions

- What problem does a Service solve that a Pod IP alone doesn't?
- What's the relationship between `ClusterIP`, `NodePort`, and `LoadBalancer` — are they mutually exclusive?
- How would you debug a Service that returns connection refused or times out for every client?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Namespaces](04-namespaces.md) to see how Kubernetes scopes objects like this Service within a cluster.
