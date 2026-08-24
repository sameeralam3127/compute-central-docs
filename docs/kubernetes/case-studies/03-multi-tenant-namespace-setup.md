---
title: "Kubernetes Multi-Tenant Namespace Setup Case Study"
icon: lucide/users
description: Provisioning an isolated namespace for a new team with ResourceQuota, LimitRange, RBAC RoleBindings, and default-deny NetworkPolicy with explicit allows.
tags:
  - Kubernetes
  - Case Studies
---

# Case Study: Multi-Tenant Namespace Setup

## Scenario

The `fraud-detection` team is joining a shared Kubernetes cluster that already runs several other teams' workloads. Platform engineering needs to onboard them with a namespace that's isolated enough that a mistake on their side — a runaway Deployment, an over-broad `kubectl` grant, an unrestricted egress call — can't affect anyone else on the cluster, without standing up a separate cluster just for one team.

## Requirements

- The team can only see and modify objects in their own namespace, never cluster-wide resources or other namespaces
- A hard ceiling on total CPU, memory, and object count the namespace can consume, so one team's workload can't starve the shared cluster
- Every container in the namespace must declare resource requests/limits — no pod should be able to skip that as an oversight
- Network traffic is denied by default; only the specific paths the team actually needs (DNS, same-namespace traffic, ingress from the shared ingress controller) are explicitly allowed

## Solution Walkthrough

### 1. The namespace

```yaml title="fraud-detection-namespace.yaml"
apiVersion: v1
kind: Namespace
metadata:
  name: fraud-detection
  labels:
    team: fraud-detection
    pod-security.kubernetes.io/enforce: baseline
```

```bash
kubectl apply -f fraud-detection-namespace.yaml
```

### 2. ResourceQuota — a hard ceiling on the whole namespace

```yaml title="resourcequota.yaml"
apiVersion: v1
kind: ResourceQuota
metadata:
  name: fraud-detection-quota
  namespace: fraud-detection
spec:
  hard:
    requests.cpu: "8"
    requests.memory: 16Gi
    limits.cpu: "16"
    limits.memory: 32Gi
    pods: "40"
    services: "10"
    persistentvolumeclaims: "5"
```

```bash
kubectl apply -f resourcequota.yaml
```

!!! warning "ResourceQuota forces requests/limits to exist"
    Once a `ResourceQuota` sets a `requests.cpu`/`requests.memory` (or `limits.*`) value, the API server **rejects** any pod in that namespace whose containers don't explicitly declare that same resource. This is a deliberate side effect, not a bug — it's what makes the `LimitRange` below actually matter, since without it every pod creation would need to specify requests/limits by hand or fail outright.

### 3. LimitRange — sane per-container defaults

```yaml title="limitrange.yaml"
apiVersion: v1
kind: LimitRange
metadata:
  name: fraud-detection-limits
  namespace: fraud-detection
spec:
  limits:
    - type: Container
      default:
        cpu: 500m
        memory: 512Mi
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      max:
        cpu: "2"
        memory: 2Gi
      min:
        cpu: 50m
        memory: 64Mi
```

```bash
kubectl apply -f limitrange.yaml
```

With this in place, a container that omits `resources` entirely gets `defaultRequest`/`default` applied automatically instead of being rejected by the `ResourceQuota` — the two objects are meant to be deployed together.

### 4. RBAC — scoped to the namespace only

```yaml title="rbac.yaml"
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: fraud-detection-editor
  namespace: fraud-detection
rules:
  - apiGroups: ["", "apps", "batch"]
    resources:
      ["pods", "services", "configmaps", "secrets", "deployments", "jobs", "cronjobs"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: [""]
    resources: ["pods/log", "pods/exec"]
    verbs: ["get", "create"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: fraud-detection-team-binding
  namespace: fraud-detection
subjects:
  - kind: Group
    name: fraud-detection-team
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: fraud-detection-editor
  apiGroup: rbac.authorization.k8s.io
```

```bash
kubectl apply -f rbac.yaml
```

A `Role` + `RoleBinding` (not `ClusterRole`/`ClusterRoleBinding`) is what keeps this grant namespace-scoped — the exact same `Role` name could exist independently in another team's namespace with completely different rules, and neither grant leaks into the other's territory or the cluster's shared resources (`Nodes`, `Namespaces`, `ClusterRoles` themselves).

### 5. NetworkPolicy — default-deny, then explicit allows

```yaml title="networkpolicy-default-deny.yaml"
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: fraud-detection
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
```

An empty `podSelector: {}` with no `ingress`/`egress` rules matches every pod in the namespace and allows nothing — this is the whole namespace's baseline the moment it's applied.

```yaml title="networkpolicy-allows.yaml"
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-same-namespace
  namespace: fraud-detection
spec:
  podSelector: {}
  policyTypes: ["Ingress"]
  ingress:
    - from:
        - podSelector: {} # any pod in this same namespace
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-from-ingress-controller
  namespace: fraud-detection
spec:
  podSelector:
    matchLabels:
      tier: web
  policyTypes: ["Ingress"]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns-egress
  namespace: fraud-detection
spec:
  podSelector: {}
  policyTypes: ["Egress"]
  egress:
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53
```

```bash
kubectl apply -f networkpolicy-default-deny.yaml
kubectl apply -f networkpolicy-allows.yaml
```

Three separate allows, deliberately: same-namespace pod-to-pod traffic, ingress from the shared `ingress-nginx` namespace into anything labeled `tier: web`, and DNS egress to any namespace on port 53 — without that last one, cluster DNS resolution breaks for every pod in `fraud-detection`, which is the single most common self-inflicted outage after applying a default-deny policy.

## Verification

**RBAC is actually scoped correctly:**

```bash
kubectl auth can-i create deployments --namespace=fraud-detection --as-group=fraud-detection-team
# yes

kubectl auth can-i create deployments --namespace=other-team --as-group=fraud-detection-team
# no

kubectl auth can-i list nodes --as-group=fraud-detection-team
# no
```

**ResourceQuota is actually enforced:**

```bash
kubectl run quota-test --image=nginx:1.27 -n fraud-detection \
  --requests='cpu=100m,memory=128Mi' --limits='cpu=20,memory=2Gi'
# Error from server (Forbidden): pods "quota-test" is forbidden:
# exceeded quota: fraud-detection-quota, requested: limits.cpu=20,
# used: limits.cpu=0, limited: limits.cpu=16
```

**NetworkPolicy actually blocks what it should and allows what it should.** Start a test pod outside the namespace and confirm it's blocked, then a pod inside and confirm it's allowed:

```bash
kubectl run probe --rm -it --image=busybox:1.36 -n other-team -- \
  wget -T 3 -qO- http://some-service.fraud-detection.svc.cluster.local
# wget: download timed out — confirms cross-namespace ingress is blocked by default-deny

kubectl run probe --rm -it --image=busybox:1.36 -n fraud-detection -- \
  wget -T 3 -qO- http://some-service.fraud-detection.svc.cluster.local
# succeeds — confirms the same-namespace allow rule works

kubectl run dns-check --rm -it --image=busybox:1.36 -n fraud-detection -- \
  nslookup kubernetes.default
# succeeds — confirms DNS egress wasn't accidentally cut off
```

## What Could Go Wrong

- **Applying default-deny before the DNS-egress allow** — every pod in the namespace loses DNS resolution instantly, including pods that were already running (`NetworkPolicy` applies to existing pods immediately, not just new ones). Apply the default-deny and its allow rules from the same `kubectl apply -f` invocation on a directory, not as two separate steps with a gap.
- **Setting a `ResourceQuota` without a matching `LimitRange`** — every future `kubectl run` or bare Deployment created without explicit `resources` starts failing to schedule with a quota-exceeded error that has nothing to do with the actual manifest the team wrote, which reads as a confusing, unrelated failure to anyone who doesn't already know the quota exists.
- **Using a `ClusterRoleBinding` "just to get the team unblocked quickly"** — this is the most common way multi-tenant isolation quietly breaks: it looks like normal RBAC and works fine on the surface, but it grants the binding across every namespace in the cluster, not just this team's.
- **Forgetting the ingress-controller allow rule's label selector must match the real ingress namespace's actual labels** — `kubernetes.io/metadata.name` is auto-populated by Kubernetes on every namespace, but if the ingress controller lives in a namespace with a different name than assumed, the selector silently matches nothing and legitimate external traffic gets dropped.
- **Assuming NetworkPolicy is enforced without checking the CNI** — `NetworkPolicy` objects are inert unless the cluster's CNI plugin actually implements policy enforcement (Calico, Cilium, and most cloud-managed CNIs do; a bare-bones bridge CNI may not). Verify enforcement is real with the block/allow tests above rather than trusting the objects exist.

## Next

See [Autoscaling Under Load](04-autoscaling-under-load.md) for tuning HPA behavior once this team's workloads are running, and [Multi-Tenancy](../cluster-administration/06-multi-tenancy.md) for how this pattern compares to virtual clusters or fully separate clusters per tenant.
