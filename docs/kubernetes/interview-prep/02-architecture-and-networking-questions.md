---
title: "Kubernetes Interview Questions: Architecture and Networking"
icon: lucide/cpu
description: Kubernetes interview questions on control plane components, kubelet, kube-proxy, CNI, DNS, and Ingress vs. Service, with detailed model answers.
tags:
  - Kubernetes
  - Interview Preparation
---

# Interview Prep: Architecture & Networking

## Walk through the Kubernetes control plane components and what each one actually does.

**Short answer:** `kube-apiserver` (the front door), `etcd` (the source of truth), `kube-scheduler` (decides pod placement), and `kube-controller-manager` (runs the reconciliation loops).

**Detailed:** Every one of these talks to `etcd` only through the API server — nothing else has direct `etcd` access, which is what makes the API server the single point of authentication, authorization, and admission control for the whole cluster. The scheduler doesn't place Pods by directly telling a node to run something; it just writes `spec.nodeName` back through the API server, and the kubelet on that node picks it up.

**Common misconception:** That the scheduler "pushes" a Pod onto a node. It's the opposite — the scheduler's only job is deciding and writing which node a Pod *should* run on; the corresponding kubelet then pulls that assignment and does the actual work.

**Senior follow-up:** "The API server is up and `kubectl get pods` works, but nothing new ever gets scheduled — what would you check?" — whether `kube-scheduler` is actually running and currently the elected leader; the API server being healthy doesn't imply the scheduler or controller-manager are.

## What do kubelet and kube-proxy each do, and why are they both needed?

**Short answer:** `kubelet` is the per-node agent that makes containers on that node match the Pod specs the API server assigned to it; `kube-proxy` is the per-node component that implements the Service abstraction by programming network rules.

**Detailed:** `kubelet` doesn't route traffic and `kube-proxy` doesn't run containers — they solve two completely different problems. `kubelet` continuously reconciles "what containers should be running here" against "what's actually running," reporting status back up. `kube-proxy` watches Services and Endpoints and rewrites `iptables` (or `IPVS`) rules on every node so that traffic to a Service's virtual IP gets transparently routed to one of its backing Pods.

**Common misconception:** That `kube-proxy` is a proxy in the literal sense — a process traffic actually flows through. In `iptables` mode (the common default) it isn't in the data path at all; it only programs kernel rules, and the kernel does the actual packet rewriting.

**Senior follow-up:** "What's the practical tradeoff between `kube-proxy`'s `iptables` mode and `IPVS` mode?" — `iptables` rule evaluation is roughly linear in the number of rules, so it degrades as Service count grows into the thousands; `IPVS` uses hash tables and stays roughly constant, at the cost of being a less universally available kernel feature.

## What is CNI, and what's the actual division of labor between Kubernetes and a CNI plugin?

**Short answer:** The Container Network Interface is a plugin specification — Kubernetes itself implements no pod networking; a CNI plugin (Calico, Cilium, Flannel) is what actually gives every Pod an IP and makes pod-to-pod routing work.

**Detailed:** Kubernetes' networking model makes three guarantees — every Pod gets its own IP, Pods can reach all other Pods without NAT, and node-level agents can reach every Pod on their node — but it deliberately doesn't say *how*. That's the whole reason CNI exists as a swappable layer: an overlay network (Flannel VXLAN), a pure L3 BGP approach (Calico), or an eBPF-based data plane (Cilium) can all satisfy the same guarantees differently.

**Common misconception:** That NetworkPolicy enforcement is a Kubernetes-native feature. It isn't — the NetworkPolicy *API* is native, but nothing enforces it unless the CNI plugin in use actually implements it; Flannel by itself, for example, does not.

**Senior follow-up:** "You need NetworkPolicy enforcement plus low-overhead observability into every connection — what would push you toward Cilium over Calico?" — Cilium's eBPF data plane gives L7-aware policy and built-in flow visibility (Hubble) without a sidecar proxy, where Calico's strength is more mature, simpler L3/L4 policy with iptables or eBPF depending on configuration; the real answer should acknowledge both are valid and the choice depends on whether L7 policy/observability is actually a requirement.

## How does DNS actually work inside a cluster?

**Short answer:** CoreDNS runs as a cluster add-on (itself just Pods behind a Service), and every Pod's `/etc/resolv.conf` is configured to query it, resolving names like `myapp-service.namespace.svc.cluster.local` to the Service's ClusterIP.

**Detailed:** CoreDNS watches the API server for Services and Endpoints and serves records dynamically — there's no static zone file to update when a Service is created. The short-form name (`myapp-service`) resolves inside the same namespace because the Pod's `resolv.conf` includes a `search` path with the local namespace; from another namespace you need the full `myapp-service.other-namespace.svc.cluster.local` form.

**Common misconception:** That DNS failures are usually "CoreDNS is down." Far more often, the Service being queried simply doesn't exist yet, exists in a different namespace than assumed, or the querying Pod has a custom `dnsPolicy` that bypasses cluster DNS entirely.

**Senior follow-up:** "CoreDNS pods are healthy, but resolution is flaky under load — what would you look at?" — CoreDNS's own resource limits and replica count (it's a real workload that can be under-provisioned for cluster size) and whether `ndots:5` (the cluster default) is causing unnecessary extra DNS queries for external, fully-qualified lookups from inside Pods.

## What's the actual difference between a Service and an Ingress, and why do you need both?

**Short answer:** A Service provides a stable virtual IP and load-balances traffic to a set of Pods at L4; an Ingress is an L7 HTTP(S) routing layer that sits in front of one or more Services, handling host/path-based routing and TLS termination.

**Detailed:** An Ingress resource by itself does nothing — it's a set of routing rules that an Ingress *controller* (NGINX, Traefik, HAProxy, a cloud load balancer controller) actually implements by watching Ingress objects and configuring itself. That controller almost always sits in front of `ClusterIP` Services, not `NodePort` or `LoadBalancer` ones, since it's the single entry point doing the load balancing that a per-service `LoadBalancer` would otherwise duplicate.

**Common misconception:** That you need a separate `LoadBalancer` Service per application to expose it externally. In practice one Ingress controller (behind one `LoadBalancer` Service) can front many applications by hostname/path, which is both the cost-effective and the operationally simpler pattern.

**Senior follow-up:** "When would a Service alone — no Ingress — be the right choice for external exposure?" — non-HTTP protocols (raw TCP/UDP, a database, gRPC without an HTTP-aware Ingress controller in front) or genuinely low-traffic, single-application clusters where the extra layer buys nothing.

## Next

Continue to [Scenario-Based Questions](03-scenario-based-questions.md).
