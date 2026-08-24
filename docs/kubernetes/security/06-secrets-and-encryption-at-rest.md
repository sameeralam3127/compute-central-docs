---
title: "Kubernetes Secrets, etcd Encryption at Rest, and Audit Logging"
icon: lucide/lock-keyhole
description: Why a Kubernetes Secret is only base64-encoded by default, how to enable etcd encryption at rest with a KMS provider, and the basics of audit logging.
tags:
  - Kubernetes
  - Security
---

# Secrets and Encryption at Rest

## What You'll Learn

- Why a Kubernetes `Secret` object is not, by itself, an encrypted secret
- How to actually encrypt Secret data at rest in etcd using `EncryptionConfiguration` and a KMS provider
- How network-layer protection (mTLS) and audit logging complement Secret encryption rather than replace it

## Why This Matters

"We use Kubernetes Secrets, so our credentials are encrypted" is one of the most common false assumptions in Kubernetes security reviews. A `Secret` is base64-encoded — not encrypted — and by default it's stored in etcd in that same recoverable form. Anyone with read access to the etcd data store, or a backup of it, can trivially decode every Secret in the cluster. Closing that gap is a distinct, deliberate configuration step, not something that happens automatically.

## Mental Model

> A Kubernetes `Secret` is a resource *type* that signals "handle this carefully" to Kubernetes tooling (RBAC treats it distinctly, `kubectl get -o yaml` doesn't print it in `describe` output by default) — but the actual bytes stored in etcd are base64, which is an encoding, not an encryption. Real protection requires wiring in etcd encryption at rest **on top of** the Secret object model.

## How It Works

### Why Secrets alone don't equal "encrypted"

```bash
kubectl create secret generic db-secret --from-literal=password='S3cr3t!' -n production
kubectl get secret db-secret -n production -o jsonpath='{.data.password}' | base64 -d
# S3cr3t!
```

Anyone with `get` permission on that Secret via RBAC can decode it in one command. And without encryption at rest configured, the same value sits in etcd's on-disk data files in that same reversible form — readable by anyone with filesystem access to an etcd node, or a copy of an etcd snapshot/backup.

### etcd encryption at rest

Kubernetes supports encrypting Secret (and optionally other resource) data before it's written to etcd, configured via an `EncryptionConfiguration` file passed to the API server.

```yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
      - secrets
    providers:
      - kms:
          apiVersion: v2
          name: myKmsPlugin
          endpoint: unix:///var/run/kmsplugin/socket.sock
          timeout: 3s
      - identity: {}  # fallback: allows reading pre-existing unencrypted Secrets
```

- `kms` — delegates the actual encryption key to an external Key Management Service (AWS KMS, GCP Cloud KMS, HashiCorp Vault's Transit engine) via a small local plugin. This is the recommended provider: keys never live on the API server's disk, and key rotation is handled by the KMS itself.
- `identity` — a no-op provider; listing it last as a fallback lets the API server still read Secrets written before encryption was enabled, without decrypting anything.

The API server is started with `--encryption-provider-config=/path/to/config.yaml`. Providers are tried **in order for reads** (so old data written under a previous provider is still readable) and the **first provider in the list is used for all new writes** — this is exactly why `identity` should never be listed first once encryption is turned on, and why rotating providers means putting the new one first while keeping the old one available for decrypting existing data.

Enabling this **does not retroactively encrypt existing Secrets** — they're only encrypted the next time they're written. A full rewrite is needed to bring existing data under the new provider:

```bash
kubectl get secrets --all-namespaces -o json | kubectl replace -f -
```

### Network-layer protection: mTLS

Encryption at rest protects data sitting in etcd. It says nothing about data moving between pods over the network — a Secret's value, once mounted into a pod and used (say, as a database password sent over the wire), is only as safe as the transport carrying it. A **service mesh** (Istio, Linkerd) commonly provides automatic mutual TLS between pods, encrypting and authenticating pod-to-pod traffic without application code changes. This is a complementary control, not a substitute for encryption at rest or RBAC — it protects data in transit, a different threat than data at rest or data over-permissioned.

### Audit logging

Encryption prevents casual disclosure; **audit logging** answers "who accessed or changed what, and when" after the fact — essential for detecting misuse and for forensics if a Secret is suspected compromised.

```yaml
# audit-policy.yaml — log Secret access at Metadata level (records who/when/what, not values)
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  - level: Metadata
    resources:
      - group: ""
        resources: ["secrets"]
```

The API server is started with `--audit-policy-file=/path/to/audit-policy.yaml` and `--audit-log-path=...` to write matching events to a log. `level: Metadata` records the request (who, verb, resource, timestamp) without capturing the Secret's actual payload — `level: Request`/`RequestResponse` would capture request/response bodies too, which for Secrets usually creates more exposure than it's worth logging.

## Common Mistakes

- Assuming `Secret` objects are encrypted by default — without `EncryptionConfiguration`, they're base64 in etcd, full stop.
- Enabling encryption at rest going forward but forgetting existing Secrets need an explicit rewrite (`kubectl replace`) to actually become encrypted.
- Putting `identity` first in the `providers` list after enabling encryption, which silently makes all *new* writes unencrypted again.
- Treating a service mesh's mTLS as covering encryption at rest — it only protects data in transit between pods, not what's sitting in etcd or in a backup.
- Logging Secret access at `Request`/`RequestResponse` audit level, which can capture the Secret payload itself in the audit log — usually the opposite of the intended protection.

## Interview Questions

- Why is a Kubernetes Secret not encrypted by default, and what would you configure to actually encrypt it at rest?
- What's the role of the KMS provider in `EncryptionConfiguration`, and why is it preferred over storing a raw key on the API server?
- If you enable etcd encryption at rest today, are your existing Secrets protected immediately? Why or why not?
- How do encryption at rest, mTLS, and audit logging each address a different part of the Secrets threat model?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Observability](../observability/index.md) — once access and secrets are locked down, the next requirement is being able to see what's actually happening inside the cluster.
