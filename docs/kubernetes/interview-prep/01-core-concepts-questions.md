---
title: "Kubernetes Interview Questions: Pods, Deployments, and Services"
icon: lucide/message-circle-question
description: Leveled Kubernetes interview questions on Pods, Deployments, Services, namespaces, ConfigMaps/Secrets, and label selectors, with detailed model answers.
tags:
  - Kubernetes
  - Interview Preparation
---

# Interview Prep: Core Concepts

## What is a Pod, and why doesn't Kubernetes just run containers directly?

**Short answer:** A Pod is the smallest deployable unit in Kubernetes — one or more containers that share a network namespace and storage volumes, and are always scheduled together.

**Detailed:** Kubernetes needs an atomic unit of scheduling and networking. If it scheduled bare containers, there'd be no clean way to co-locate a main process with a tightly-coupled helper (a log shipper, a proxy) that needs to share `localhost` and a filesystem with it. A Pod solves that: every container in it shares one IP and can reach every other container's ports over `localhost`.

**Common misconception:** That a Pod is just "a container with extra steps." Multi-container Pods (sidecar pattern) are the actual reason Pods exist as their own abstraction — a logging sidecar or an Envoy proxy container running alongside the app container, sharing its network and volumes, is something a bare container runtime has no primitive for.

**Senior follow-up:** "When would you *not* put two containers in the same Pod, even though they're related?" — when they need to scale independently. Pods scale as a unit; if the proxy needs 10 replicas and the app needs 2, they can't be sidecars in the same Pod.

## What's the actual relationship between a Deployment, a ReplicaSet, and a Pod?

**Short answer:** A Deployment manages ReplicaSets, and a ReplicaSet manages Pods — you almost never create or edit a ReplicaSet directly.

**Detailed:** A Deployment's job is rollout history and strategy — when you change the pod template (a new image, say), it creates a *new* ReplicaSet at the new spec and scales it up while scaling the old ReplicaSet down, which is what makes rolling updates and `kubectl rollout undo` possible. The ReplicaSet's only job is the simpler one: keep exactly `N` Pods matching a label selector alive at all times.

**Common misconception:** That scaling a Deployment and scaling its ReplicaSet are different operations. They're the same operation from the API's point of view — `kubectl scale deployment` just writes `spec.replicas` on the Deployment, which the Deployment controller then applies to the current ReplicaSet.

**Senior follow-up:** "You `kubectl edit`ed a ReplicaSet directly instead of the Deployment — what happens on the next reconcile?" — the Deployment controller will overwrite your edit, because the ReplicaSet's spec is derived from the Deployment's `template`, not the other way around.

## What are the four Service types, and when do you actually use each?

**Short answer:** `ClusterIP` (internal-only, the default), `NodePort` (exposes a static port on every node), `LoadBalancer` (provisions a cloud load balancer), and `ExternalName` (a DNS alias to something outside the cluster, no proxying involved).

**Detailed:** In practice, production traffic almost never uses `NodePort` or `LoadBalancer` directly for HTTP/S — an Ingress (backed by a `ClusterIP` Service) handles routing for many hostnames through one load balancer, which is both cheaper and easier to manage than one `LoadBalancer` Service per application. `NodePort` shows up mostly in bare-metal clusters without a cloud load balancer integration, or as the mechanism an Ingress controller itself sometimes uses under the hood.

**Common misconception:** That a Service is a load balancer that actively routes traffic. It's a stable virtual IP plus a set of iptables/IPVS rules maintained by `kube-proxy` on every node — there's no single process "in the middle" that packets pass through.

**Senior follow-up:** "A `LoadBalancer` Service has been `<pending>` for 10 minutes — what layer is that, and what would you check?" — it's a cloud-integration problem, not a Kubernetes scheduling problem; check the cloud-controller-manager logs and the cloud provider's own load balancer quota/permissions.

## What is a Namespace for, and what *isn't* namespaced?

**Short answer:** A Namespace is a way to divide one cluster into isolated groups of names — for multi-team or multi-environment separation — but it is not a security boundary or a network boundary on its own.

**Detailed:** Resources like Pods, Services, Deployments, and ConfigMaps live inside a namespace. Cluster-scoped resources — Nodes, PersistentVolumes, ClusterRoles, StorageClasses, and the Namespace object itself — don't belong to any namespace, because they describe the cluster as a whole rather than one team's slice of it.

**Common misconception:** That namespaces provide network isolation by default. They don't — a Pod in `team-a` can reach a Pod in `team-b` unless a `NetworkPolicy` explicitly says otherwise. Isolation is something you add with RBAC and NetworkPolicy, not something Namespaces give you for free.

**Senior follow-up:** "Two teams each create a `ResourceQuota` in their own namespace — does that stop one team from starving the other of cluster-wide capacity?" — no; `ResourceQuota` caps what one namespace can request, but if the underlying nodes are genuinely full, both namespaces are still competing for the same finite capacity. Real multi-tenant capacity isolation needs node pools or cluster-level capacity planning on top of quotas.

## What's the practical difference between a ConfigMap and a Secret?

**Short answer:** Structurally they're nearly identical — key/value data injected into Pods as environment variables or mounted files — but a Secret's values are base64-encoded, not encrypted, and Kubernetes treats Secrets with a few extra protections a ConfigMap doesn't get.

**Detailed:** Those extra protections are meaningful but limited: `kubectl get secret -o yaml` still shows the (decodable) base64 data to anyone with read access, and Secrets are stored in `etcd` in plaintext by default unless you've explicitly enabled encryption at rest. Treating "it's a Secret" as equivalent to "it's protected" is a real and common production mistake.

**Common misconception:** That base64 is a form of encryption. It's an encoding — reversible by anyone, with no key required (`echo <value> | base64 -d`).

**Senior follow-up:** "An engineer wants to store a production database password — is a Kubernetes Secret good enough?" — for a small team with `etcd` encryption at rest and tight RBAC, arguably yes as a baseline; for most production setups, the better answer is an external secrets manager (Vault, AWS Secrets Manager) synced in via something like External Secrets Operator, so the actual credential never lives in `etcd` or Git at all.

## How does a label selector actually connect resources together?

**Short answer:** Labels are arbitrary key/value pairs attached to objects; a selector is a query against those labels, and it's the mechanism a Service uses to find its Pods, a Deployment uses to find the Pods it owns, and a NetworkPolicy uses to decide which Pods it applies to.

**Detailed:** There's no naming convention or ownership pointer involved — a Service reaches its Pods purely because `spec.selector` on the Service matches `metadata.labels` on the Pods, evaluated fresh on every reconcile. This is also exactly why label mismatches are one of the most common Kubernetes outages: nothing errors when a selector matches zero Pods, it just silently produces an empty `endpoints` list.

**Common misconception:** That a Deployment's `spec.selector` can be changed freely after creation. It's immutable — changing which Pods a Deployment considers "mine" after the fact is disallowed specifically because it could orphan or double-adopt Pods.

**Senior follow-up:** "Two Deployments accidentally use overlapping label selectors — what actually happens?" — both ReplicaSets try to claim and manage the same Pods, leading to a fight over Pod count and unpredictable scaling behavior; this is why production label schemes should include a unique identifier (like a Deployment-specific `app.kubernetes.io/instance` label) beyond just `app`.

## Next

Continue to [Architecture & Networking](02-architecture-and-networking-questions.md).
