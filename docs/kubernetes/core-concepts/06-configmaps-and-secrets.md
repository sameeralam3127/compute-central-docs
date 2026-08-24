---
title: "Kubernetes ConfigMaps and Secrets: The Basics"
icon: lucide/key
description: Intro-level ConfigMaps and Secrets — consuming them as environment variables or mounted volumes, and why Secrets are base64-encoded, not encrypted.
tags:
  - Kubernetes
  - Core Concepts
---

# ConfigMaps and Secrets

## What You'll Learn

- How to create a ConfigMap and a Secret, and the two ways to consume either in a Pod
- Why a Secret being base64-encoded is not the same thing as it being encrypted
- Where the deeper material on both — and on encryption at rest — actually lives

## Why This Matters

Baking configuration and credentials directly into a container image means rebuilding the image every time a value changes, and it means anyone with the image has the credentials. ConfigMaps and Secrets decouple configuration from the image, which is what makes the same image deployable, unmodified, to dev, staging, and prod.

## ConfigMaps: Non-Sensitive Configuration

```bash
kubectl create configmap app-config \
  --from-literal=DATABASE_URL=postgres://db:5432 \
  --from-literal=LOG_LEVEL=info
```

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  DATABASE_URL: "postgres://db:5432"
  LOG_LEVEL: "info"
  config.json: |
    {
      "featureFlags": { "newUi": true }
    }
```

## Secrets: Sensitive Values

```bash
kubectl create secret generic db-secret \
  --from-literal=username=admin \
  --from-literal=password='change-me'
```

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
type: Opaque
data:
  username: YWRtaW4=       # base64 of "admin"
  password: Y2hhbmdlLW1l   # base64 of "change-me"
```

!!! warning "base64 is encoding, not encryption"
    Anyone with `get`/`list` permission on Secrets in a namespace — or read access to etcd itself — can trivially recover the plaintext with `echo <value> | base64 -d`. A Secret's real protection comes from RBAC restricting who can read it and, ideally, **encryption at rest** for etcd, which is not enabled by default on every distribution. See [Secrets and Encryption at Rest](../security/06-secrets-and-encryption-at-rest.md) for how to actually secure them.

## Consuming Either in a Pod

**As environment variables:**

```yaml
spec:
  containers:
    - name: app
      image: myapp:1.4.2
      env:
        - name: LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: LOG_LEVEL
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
```

**As a mounted volume** — each key becomes a file, which is preferable for larger values or config files, and (for Secrets) avoids the value showing up in `kubectl describe pod` output or process-environment dumps:

```yaml
spec:
  containers:
    - name: app
      image: myapp:1.4.2
      volumeMounts:
        - name: config-volume
          mountPath: /etc/config
        - name: secret-volume
          mountPath: /etc/secret
          readOnly: true
  volumes:
    - name: config-volume
      configMap:
        name: app-config
    - name: secret-volume
      secret:
        secretName: db-secret
```

A mounted ConfigMap or Secret volume updates automatically when the underlying object changes (with a short delay, via the kubelet's sync loop) — env vars set at Pod start do **not** update until the Pod restarts.

## Common Mistakes

- Treating `data` in a Secret as encrypted because it looks unreadable — it's just base64, reversible by anyone with the string.
- Committing a Secret manifest with real values to source control — the YAML `data` field is plaintext-equivalent, not a safe thing to check in.
- Expecting an environment variable sourced from a ConfigMap/Secret to update live when the source changes — only volume-mounted values refresh without a Pod restart.
- Using ConfigMaps for values that are actually sensitive "because it's easier" — if it's a credential, it belongs in a Secret (and ideally an external secret store), not a ConfigMap.

## Interview Questions

- Why is a Kubernetes Secret's base64 encoding not a security control by itself?
- What's the practical difference between consuming a ConfigMap as an environment variable versus a mounted volume?
- How would you rotate a database password stored in a Secret without restarting every Pod that consumes it as an env var?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

This page only covers the basics of getting a value into a Pod. For real config-management patterns (immutable ConfigMaps, `envFrom`, templating with Kustomize/Helm), continue to [ConfigMaps In Depth](../configuration-and-packaging/01-configmaps-in-depth.md) and [Secrets In Depth](../configuration-and-packaging/02-secrets-in-depth.md).
