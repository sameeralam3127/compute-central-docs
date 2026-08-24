---
title: "OpenShift Routes vs. Ingress and the SDN/OVN-Kubernetes Layer"
icon: lucide/route
description: How OpenShift Routes compare to Kubernetes Ingress, how the built-in HAProxy router works, and how OpenShift's SDN and OVN-Kubernetes networking layers fit together.
tags:
  - Kubernetes
  - OpenShift
---

# Routes and Networking

## What You'll Learn

- How a Route differs from an Ingress, and why OpenShift supports both
- How the built-in HAProxy router actually handles TLS termination and traffic
- How OpenShift's SDN and OVN-Kubernetes network plugins fit into the bigger Kubernetes networking picture

## Why This Matters

Every OpenShift cluster ships a working ingress path out of the box — no separate ingress controller to install, no chart to pick. That's convenient, but it also means Routes predate and work differently from standard Kubernetes Ingress, and conflating the two leads to confusion about TLS termination modes and why a plain Ingress manifest sometimes behaves unexpectedly on OpenShift.

## Mental Model

> A Route is OpenShift's original, native way of exposing a Service externally — it existed before Kubernetes Ingress did. OpenShift still supports standard Ingress objects (translated internally into Routes by the router), but Routes expose OpenShift-specific TLS termination modes that Ingress alone doesn't model.

## How It Works

### Route vs. Ingress

| | Kubernetes Ingress | OpenShift Route |
|---|---|---|
| API group | `networking.k8s.io/v1` | `route.openshift.io/v1` |
| Portable across distributions | Yes | No — OpenShift-specific |
| Requires installing a controller | Yes (nginx, Traefik, etc.) | No — the router ships with the platform |
| TLS termination modes | Controller-dependent | Edge, Passthrough, Re-encrypt — first-class fields |
| Weighted traffic splitting across backends | Not native to the spec | Native (`spec.to.weight`, `spec.alternateBackends`) |

```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: payments-api
  namespace: payments
spec:
  host: payments.apps.cluster.example.com
  to:
    kind: Service
    name: payments-api
    weight: 100
  port:
    targetPort: http
  tls:
    termination: edge
    insecureEdgeTerminationPolicy: Redirect
```

```bash
# Quickest way to expose an existing Service as a Route
oc expose service payments-api

# Create a TLS-terminated route explicitly
oc create route edge payments-api-secure --service=payments-api

oc get routes -n payments
```

**TLS termination modes**, unique to Routes:

- **Edge** — TLS terminates at the router; traffic to the pod is plain HTTP. Simplest option when the app doesn't need to see TLS itself.
- **Passthrough** — TLS is not decrypted by the router at all; it passes straight through to the pod, which must terminate TLS itself. Needed when the application requires the client certificate or must manage its own TLS.
- **Re-encrypt** — TLS terminates at the router, then the router re-encrypts a new TLS connection to the pod. Gives you router-level features (like host-based routing) while still encrypting traffic inside the cluster.

A standard Ingress resource still works on OpenShift — the cluster's Ingress Operator watches Ingress objects and creates a corresponding Route on your behalf, so both APIs ultimately drive the same router. Teams writing portable manifests (meant to also run on vanilla Kubernetes) often stick to Ingress; teams that want OpenShift-specific features like traffic weighting or Passthrough TLS use Route directly.

### The built-in HAProxy router

Every OpenShift cluster runs a default IngressController backed by HAProxy, deployed as pods in the `openshift-ingress` namespace. It watches Route (and Ingress) objects cluster-wide and reconfigures HAProxy automatically as Routes are created, updated, or deleted — no reload step for operators to manage themselves.

```bash
# The router's own pods
oc get pods -n openshift-ingress

# Cluster-wide router configuration (replica count, scope, etc.)
oc get ingresscontroller default -n openshift-ingress-operator -o yaml
```

For high-traffic clusters, the default router can be scaled with more replicas, and additional IngressControllers can be deployed for traffic isolation (e.g., a separate router dedicated to internal-only traffic) — this is a common production tuning step that a fresh OpenShift install doesn't do for you automatically.

### SDN and OVN-Kubernetes

OpenShift's pod networking is implemented by a CNI plugin, same as any Kubernetes distribution — OpenShift historically shipped its own **OpenShift SDN** plugin, and has moved to **OVN-Kubernetes** as the default network plugin (the default since OpenShift 4.12, and the only supported option in current 4.x releases going forward). OVN-Kubernetes is based on Open Virtual Network and Open vSwitch, and brings capabilities OpenShift SDN didn't have natively — including better NetworkPolicy egress support and IPv6/dual-stack networking.

```bash
# Check which network plugin the cluster is running
oc get network.config.openshift.io cluster -o jsonpath='{.spec.networkType}'

# Cluster-wide network configuration
oc get network.config.openshift.io cluster -o yaml
```

Standard Kubernetes `NetworkPolicy` objects work the same way regardless of which plugin is underneath — the plugin is what enforces them, not what you author against:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-from-same-namespace
  namespace: payments
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector: {}
```

## Common Mistakes

- Assuming Ingress "doesn't work" on OpenShift — it does; the Ingress Operator translates it into a Route behind the scenes.
- Choosing Passthrough TLS termination by default instead of Edge — Passthrough pushes TLS management onto the application unnecessarily unless there's a real requirement (mTLS to the pod, client cert inspection) for it.
- Forgetting the router itself can become a bottleneck at scale — not scaling router replicas or isolating traffic with a second IngressController on a high-traffic cluster.
- Confusing OpenShift SDN (legacy) with OVN-Kubernetes (current default) when reading older documentation or troubleshooting an older cluster.

## Interview Questions

- What's the difference between edge, passthrough, and re-encrypt TLS termination on a Route?
- How does a standard Kubernetes Ingress object behave on an OpenShift cluster?
- What changed when OpenShift moved from OpenShift SDN to OVN-Kubernetes as the default network plugin?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Source-to-Image and Builds](04-source-to-image-and-builds.md) to see how OpenShift builds the images these Routes expose.
