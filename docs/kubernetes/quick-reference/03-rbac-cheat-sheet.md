---
title: "Kubernetes RBAC Cheat Sheet: Role, ClusterRole, and Bindings"
icon: lucide/lock
description: RBAC YAML skeletons for Role, ClusterRole, RoleBinding, and ClusterRoleBinding, plus common verb/resource combos and kubectl auth can-i recipes.
tags:
  - Kubernetes
  - Quick Reference
---

# RBAC Cheat Sheet

## Role (namespace-scoped)

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: production
  name: pod-reader
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch"]
```

## ClusterRole (cluster-scoped, can be bound namespace-scoped)

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: node-reader
rules:
  - apiGroups: [""]
    resources: ["nodes"]
    verbs: ["get", "list", "watch"]
```

## RoleBinding

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: production
subjects:
  - kind: ServiceAccount
    name: myapp-sa
    namespace: production
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

## ClusterRoleBinding

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: read-nodes-global
subjects:
  - kind: Group
    name: sre-team
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: node-reader
  apiGroup: rbac.authorization.k8s.io
```

## ServiceAccount

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: myapp-sa
  namespace: production
automountServiceAccountToken: false   # set true only if the pod actually calls the API
```

## Common Verb/Resource Combos

| Need | apiGroups | resources | verbs |
|---|---|---|---|
| Read-only on pods and logs | `[""]` | `["pods", "pods/log"]` | `["get", "list", "watch"]` |
| Manage Deployments | `["apps"]` | `["deployments"]` | `["get", "list", "watch", "create", "update", "patch", "delete"]` |
| Read ConfigMaps, not Secrets | `[""]` | `["configmaps"]` | `["get", "list", "watch"]` |
| Exec into pods | `[""]` | `["pods/exec"]` | `["create"]` |
| Port-forward to pods | `[""]` | `["pods/portforward"]` | `["create"]` |
| Manage Ingress | `["networking.k8s.io"]` | `["ingresses"]` | `["get", "list", "watch", "create", "update", "delete"]` |
| Full admin, one namespace | `["*"]` | `["*"]` | `["*"]` |
| Full cluster admin | `["*"]` | `["*"]` | `["*"]` (bind via `ClusterRoleBinding`) |

## Built-in Aggregated ClusterRoles

| ClusterRole | Grants |
|---|---|
| `view` | Read-only on most namespaced resources, not Secrets |
| `edit` | Read/write on most namespaced resources, not RBAC objects |
| `admin` | `edit` plus the ability to manage Roles/RoleBindings in the namespace |
| `cluster-admin` | Unrestricted access to everything, cluster-wide |

## `kubectl auth can-i` Recipes

```bash
kubectl auth can-i create pods
kubectl auth can-i create pods -n production
kubectl auth can-i delete deployments --as=system:serviceaccount:production:myapp-sa
kubectl auth can-i '*' '*'                              # am I cluster-admin?
kubectl auth can-i --list                               # everything I can do, current context
kubectl auth can-i --list --as=system:serviceaccount:production:myapp-sa
kubectl auth whoami
```

## Related

[Security & RBAC interview questions](../interview-prep/04-security-and-rbac-questions.md) · [YAML Cheat Sheet](02-yaml-cheat-sheet.md)
