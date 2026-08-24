---
title: "Pod Security Standards and Pod Security Admission"
icon: lucide/shield-check
description: Pod Security Admission's Privileged, Baseline, and Restricted levels, namespace labels that enable them, and the securityContext fields they enforce.
tags:
  - Kubernetes
  - Security
---

# Pod Security Standards

## What You'll Learn

- The three Pod Security Standards levels and exactly what each one blocks
- How to turn enforcement on per namespace with labels, with no separate controller to install
- The `securityContext` fields that actually satisfy the Restricted standard, at the pod and container level

## Why This Matters

RBAC controls who can *submit* a pod spec. It says nothing about what that pod spec is allowed to *contain* — nothing stops an authorized user from submitting a pod that runs as root, mounts the host filesystem, and disables every container isolation Linux provides. Pod Security Standards is the layer that closes that gap, and it's built into the API server itself, with no extra component to deploy.

## Mental Model

> Pod Security Admission is a built-in **validating admission controller** that checks every pod against one of three increasingly strict standards, based on a label on the pod's namespace. It cannot mutate a pod to make it compliant — it can only accept or reject.

| Level | Intent | What it allows |
|---|---|---|
| **Privileged** | Unrestricted | Everything — full host access, privileged containers, any capability. For system-level and infra workloads (CNI plugins, storage drivers). |
| **Baseline** | Minimally restrictive | Blocks known privilege escalations (host namespaces, privileged mode, most capabilities) but stays broadly compatible with common workloads. |
| **Restricted** | Heavily restrictive, current hardening best practice | Enforces the full modern hardening checklist: non-root, no privilege escalation, dropped capabilities, restricted seccomp, and more. |

## How It Works

### Enabling enforcement with namespace labels

No controller to install, no CRD to create — Pod Security Admission is compiled into the API server and activated purely through labels on a Namespace object.

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

Three independent modes can be set per namespace, each pointing at a level:

- `enforce` — actually rejects non-compliant pods at admission time.
- `audit` — allows the pod, but records a violation in the audit log.
- `warn` — allows the pod, but returns a warning to the client (visible in `kubectl` output).

A common rollout pattern: set `warn` and `audit` to `restricted` while leaving `enforce` at `baseline`, watch the audit log for violations across real workloads, then flip `enforce` to `restricted` once nothing legitimate would break.

### The fields that satisfy Restricted

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hardened-pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: app
      image: myregistry.example.com/app:2.1.0
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL
```

| Field | What it prevents |
|---|---|
| `runAsNonRoot: true` | Container process can't run as UID 0, even if the image's `USER` directive is missing or wrong |
| `allowPrivilegeEscalation: false` | Blocks setuid binaries and other mechanisms from gaining more privileges than the parent process had |
| `readOnlyRootFilesystem: true` | Container can't write to its own root filesystem — write access requires an explicit volume mount |
| `capabilities.drop: [ALL]` | Removes every Linux capability by default; add back only the specific ones a workload genuinely needs (e.g. `NET_BIND_SERVICE` to bind port 80) |
| `seccompProfile.type: RuntimeDefault` | Applies the container runtime's default seccomp filter, blocking a large set of rarely-needed, high-risk syscalls |

All five together are effectively the checklist the Restricted standard is enforcing — a pod missing any one of them will fail admission in a namespace labeled `enforce: restricted`.

### Checking compliance before you enforce

```bash
# Dry-run a manifest against the current namespace's Pod Security label
kubectl apply -f pod.yaml --dry-run=server

# See whether a namespace has Pod Security Admission configured
kubectl get ns production -o jsonpath='{.metadata.labels}'
```

### A note on PodSecurityPolicy

Older material and older clusters may still reference **PodSecurityPolicy (PSP)**, a cluster-scoped admission controller that predated Pod Security Admission. PSP was deprecated in Kubernetes 1.21 and **removed entirely in 1.25**. It is legacy/historical context only — do not design new clusters around it, and treat any tutorial that recommends creating a `PodSecurityPolicy` object as outdated for any currently supported Kubernetes version.

## Common Mistakes

- Referencing PodSecurityPolicy as a current recommendation — it was removed in Kubernetes 1.25 and has no replacement resource of the same name; Pod Security Admission is the built-in successor.
- Setting `enforce: restricted` cluster-wide without first running `audit`/`warn` to see what would actually break — this reliably takes down workloads that were never hardened.
- Assuming a Restricted namespace label retroactively fixes already-running pods — enforcement only applies at admission time, so existing pods that predate the label keep running as they are until recreated.
- Dropping all capabilities and forgetting to add back the one a workload actually needs (commonly `NET_BIND_SERVICE` for services binding to a privileged port).
- Confusing `readOnlyRootFilesystem` with "the container can't write anything" — it still can, to any volume explicitly mounted; only the root filesystem itself is locked.

## Interview Questions

- What are the three Pod Security Standards levels, and what's the practical difference between Baseline and Restricted?
- How do you enable Pod Security Admission for a namespace, and what's the difference between its `enforce`, `audit`, and `warn` modes?
- What happened to PodSecurityPolicy, and what replaced it?
- Name the `securityContext` fields required to satisfy the Restricted standard and what each one blocks.

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Image and Supply Chain Security](05-image-and-supply-chain-security.md) to control what actually gets into the images these hardened pods run.
