---
title: "oc CLI and OpenShift Projects: A kubectl Superset"
icon: lucide/terminal
description: How the oc CLI extends kubectl, how to log in with oc login, and how OpenShift Projects add quotas, limits, and self-service provisioning to namespaces.
tags:
  - Kubernetes
  - OpenShift
---

# oc CLI and Projects

## What You'll Learn

- Why `oc` is a superset of `kubectl` rather than a separate tool
- How to authenticate to a cluster with `oc login`
- What a Project adds on top of a plain namespace, and how to create one with `oc new-project`

## Why This Matters

Teams new to OpenShift often ask "do I need to learn a whole new CLI?" The honest answer is no — `oc` accepts every `kubectl` verb and resource type you already know, so existing muscle memory carries over completely. What's actually worth learning is the OpenShift-specific surface `oc` adds on top: login against an OAuth server, Projects, Routes, and builds — commands that have no `kubectl` equivalent because the underlying resources don't exist in vanilla Kubernetes.

## Mental Model

> `oc` = `kubectl` + OpenShift-specific verbs and resources. Anything that works with `kubectl` works with `oc` using identical syntax; `oc` simply understands more resource types (Route, Project, BuildConfig, DeploymentConfig) and adds convenience commands (`oc new-app`, `oc new-project`, `oc rsh`) that have no direct `kubectl` equivalent.

```bash
# These are interchangeable against an OpenShift cluster
kubectl get pods -n payments
oc get pods -n payments

# This only works with oc — Route is an OpenShift-specific resource
oc get routes -n payments
```

## How It Works

### Authenticating with oc login

Unlike a raw kubeconfig swap, `oc login` talks to OpenShift's integrated OAuth server and can authenticate with a username/password, a token, or against an identity provider (LDAP, GitHub, htpasswd) configured on the cluster:

```bash
# Interactive username/password login
oc login https://api.cluster.example.com:6443 -u developer

# Token-based login (common for CI/automation)
oc login https://api.cluster.example.com:6443 --token=sha256~<redacted-token>

# Confirm identity and context
oc whoami
oc whoami --show-server
oc config current-context
```

`oc login` writes to the same kubeconfig `kubectl` reads, so once authenticated, both tools operate against the same cluster context interchangeably.

### Projects: namespaces plus defaults and self-service

A Project **is** a namespace under the hood — `oc get namespace payments` and `oc get project payments` return the same underlying object — but creating one through the Project API also applies OpenShift-specific defaults and access controls that a plain `kubectl create namespace` does not:

| Capability | Plain namespace (`kubectl create namespace`) | OpenShift Project (`oc new-project`) |
|---|---|---|
| Default ResourceQuota | Not applied automatically | Can be templated cluster-wide via the Project template |
| Default LimitRange | Not applied automatically | Can be templated cluster-wide via the Project template |
| Creator's access | No automatic role binding | Creator is automatically granted `admin` role on the Project |
| Self-service creation | Requires cluster-admin-granted RBAC to create namespaces directly | Any authenticated user with the `self-provisioner` role can create their own Project without cluster-admin involvement |
| Display name / description | Not a first-class field | First-class annotations for human-readable metadata |

```bash
# Create a project — the current user becomes its admin automatically
oc new-project payments-dev --display-name="Payments (Development)" --description="Dev environment for the payments service"

# Switch active project (equivalent to setting the namespace in your kube context)
oc project payments-dev

# List projects you have access to
oc projects

# Grant another user access to this project specifically
oc adm policy add-role-to-user edit jane -n payments-dev
```

Cluster administrators typically configure a default Project template (`oc adm create-bootstrap-project-template`) so every self-service Project gets a consistent starting quota and limit range without a human having to apply one manually each time — this is what makes "self-service provisioning" safe at scale: developers can create their own Projects freely, while platform teams still guarantee no Project starts unbounded.

## Common Mistakes

- Assuming `oc` and `kubectl` are two separate, incompatible tools — they read the same kubeconfig and `oc` accepts the full `kubectl` verb surface.
- Creating namespaces with `kubectl create namespace` on an OpenShift cluster and being surprised they lack the quotas/limits a Project would have applied automatically.
- Granting `self-provisioner` broadly without a sane default Project template in place — self-service without default limits reintroduces the same unbounded-namespace problem it's meant to solve.
- Forgetting `oc project <name>` only changes the CLI's active context, not any RBAC — a user still needs an actual role binding to act within that project.

## Interview Questions

- In what sense is `oc` a superset of `kubectl`, and where does that equivalence break down?
- What does a Project add on top of a Kubernetes namespace, concretely?
- How does OpenShift's self-service Project provisioning stay safe at scale without every developer needing cluster-admin?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Routes and Networking](03-routes-and-networking.md) to expose a workload running inside one of these Projects.
