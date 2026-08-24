---
title: "Kubernetes Networking Guide: Services, Ingress, DNS, CNI"
icon: lucide/network
description: How pods get IPs, how Services and Ingress route traffic, how NetworkPolicy restricts it, and how CoreDNS and CNI plugins make it all work.
tags:
  - Kubernetes
  - Networking
---

# Networking

How traffic actually moves in a Kubernetes cluster: the flat-network model every CNI plugin has to implement, how Services and Ingress expose workloads, how NetworkPolicy restricts traffic, and how DNS ties names to IPs underneath all of it.

If you already know how Services and Ingress work and just need storage details, skip ahead to [Storage](../storage/index.md).

## Read in this order

1. [Cluster Networking Model](01-cluster-networking-model.md) — the flat-network requirement, what a CNI plugin provides, pod-to-pod vs. pod-to-service paths
2. [Services Deep Dive](02-services-deep-dive.md) — all four Service types, headless Services, how kube-proxy implements them, EndpointSlices, session affinity
3. [Ingress and Ingress Controllers](03-ingress-and-ingress-controllers.md) — the Ingress resource vs. the controller that actually implements it, path/host routing, TLS with cert-manager
4. [Network Policies](04-network-policies.md) — the default-allow-all reality, default-deny patterns, ingress/egress rules
5. [DNS and CoreDNS](05-dns-and-coredns.md) — CoreDNS architecture, Service/Pod DNS naming, debugging DNS from a throwaway pod
6. [CNI Plugins](06-cni-plugins.md) — Calico, Flannel, Cilium, and Weave compared at a decision-making level

!!! tip "Ingress needs a controller"
    The single most common networking surprise: applying an `Ingress` manifest does nothing on its own. It requires an Ingress controller (nginx, Traefik, etc.) already running in the cluster to actually watch and act on it — see [Ingress and Ingress Controllers](03-ingress-and-ingress-controllers.md).

## Next

Once traffic reaches your pods correctly, continue to [Storage](../storage/index.md) for how those pods keep data.
