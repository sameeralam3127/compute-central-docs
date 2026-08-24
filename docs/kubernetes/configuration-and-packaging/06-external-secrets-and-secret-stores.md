---
title: "External Secrets and Secret Stores: Vault, ESO, Sealed Secrets"
icon: lucide/shield-check
description: Why native Kubernetes Secrets aren't a complete secrets-management strategy, and a decision-level comparison of External Secrets Operator, Vault, Sealed Secrets, and cloud secret managers.
tags:
  - Kubernetes
  - Configuration & Packaging
---

# External Secrets and Secret Stores

## What You'll Learn

- Why native Kubernetes Secrets fall short as a complete secrets-management strategy on their own
- The External Secrets Operator pattern, and how it differs from writing Secret manifests directly
- How to choose between Vault, Sealed Secrets, and a cloud-native secret manager at a decision level

## Why This Matters

By default, a Kubernetes Secret is base64-encoded plaintext, stored unencrypted in etcd, readable by anyone with the right RBAC grant, and — if it's ever committed to Git as a manifest — permanently in that repo's history. None of that is a criticism of Kubernetes; Secrets were never designed to be a full secrets-management system, just a standard shape for delivering sensitive values to a pod. Real secrets management — rotation, audit trails, centralized revocation, never touching Git — needs something layered on top.

## Mental Model

> Native Secrets answer "how does a pod receive a sensitive value at runtime?" External secrets management answers a different question: "where does that value actually live, who can rotate it, and how does it get into the cluster without a human ever pasting it into a YAML file?" The tools on this page are all different answers to the second question.

| Approach | Where the secret actually lives | What it solves |
|---|---|---|
| Native Secret (plain manifest) | etcd, base64-encoded | Nothing beyond delivery — the manifest itself is the sensitive artifact |
| **Sealed Secrets** | Git, as ciphertext only a specific cluster controller can decrypt | Makes it safe to commit an *encrypted* Secret to Git |
| **External Secrets Operator (ESO)** | An external secret store (Vault, AWS/GCP/Azure) | Syncs from a real secret store into a native Secret automatically, on a refresh interval |
| **HashiCorp Vault** (direct integration) | Vault itself, with dynamic/leased credentials | Centralized secret storage, rotation, audit logging, and short-lived dynamic secrets (e.g., a database credential that expires in an hour) |
| **Cloud secret managers** (AWS Secrets Manager, GCP Secret Manager) | The cloud provider's managed store | Centralized storage integrated with cloud IAM, usually consumed via ESO or a CSI driver |

## How It Works

### External Secrets Operator: sync, don't author

ESO installs a controller that watches `ExternalSecret` custom resources, fetches the referenced value from a configured backend, and writes (and continuously refreshes) an ordinary native Secret for pods to consume unchanged.

```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: production
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: orders-db-credentials
  namespace: production
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: orders-db-credentials   # the native Secret ESO creates/updates
  data:
    - secretKey: password
      remoteRef:
        key: prod/orders-db
        property: password
```

The application manifest never changes — it still references `orders-db-credentials` via `secretKeyRef` exactly as in [Secrets in Depth](02-secrets-in-depth.md). The difference is that no human, and no CI pipeline, ever writes the actual value into a Kubernetes manifest at all; ESO keeps the native Secret in sync with the real source of truth on `refreshInterval`.

### HashiCorp Vault: centralized store with dynamic secrets

Vault can be integrated either through ESO (treating Vault as just another `SecretStore` backend) or through the Vault Agent Injector, which mutates pod specs to add a sidecar that authenticates to Vault (typically via the Kubernetes auth method, using the pod's own service account token) and writes secrets to a shared, memory-backed volume before the main container starts.

Vault's distinguishing feature is **dynamic secrets**: instead of a static database password stored somewhere and eventually rotated, Vault can generate a brand-new, short-lived database credential per lease, tied to a specific pod's session, and automatically revoke it on expiry — meaningfully shrinking the blast radius of a leaked credential compared to any static-secret approach.

### Sealed Secrets: safe to commit

Sealed Secrets solves a narrower, GitOps-shaped problem: teams that want their entire desired state, including secrets, committed to Git. The `kubeseal` CLI encrypts a Secret using the target cluster's public key; only the in-cluster Sealed Secrets controller (holding the private key) can decrypt it back into a native Secret.

```bash
kubectl create secret generic orders-db-credentials \
  --dry-run=client -o yaml \
  --from-literal=password="$DB_PASSWORD" \
  | kubeseal --format yaml > orders-db-credentials-sealed.yaml

# Safe to commit — ciphertext only this cluster's controller can decrypt
git add orders-db-credentials-sealed.yaml
```

```bash
kubectl apply -f orders-db-credentials-sealed.yaml
# The SealedSecrets controller decrypts it and creates a real Secret automatically
```

Sealed Secrets doesn't provide rotation, dynamic credentials, or a central audit trail the way Vault or a cloud secret manager does — it solves exactly one problem (Git-safe secrets) and nothing more.

### Cloud-native secret managers, at a decision level

| Manager | Strongest fit |
|---|---|
| **AWS Secrets Manager** | Already on AWS, want native rotation Lambdas and IAM-scoped access, consuming via ESO or the Secrets Store CSI Driver |
| **GCP Secret Manager** | Already on GCP, want IAM-integrated access and Workload Identity-based auth from GKE |
| **Azure Key Vault** | Already on Azure, need combined secrets/keys/certificates management in one service |

All three are typically consumed the same two ways: through ESO (syncing into native Secrets) or through the Secrets Store CSI Driver (mounting secrets directly as a volume without ever materializing a native Secret object at all — the tighter option when you want to avoid even a synced copy sitting in etcd).

## Common Mistakes

- Committing a plain (non-sealed, non-encrypted) Secret manifest to Git "just for now" — Git history is permanent even after the file is later removed or rotated.
- Treating Sealed Secrets as equivalent to Vault — it solves Git-safety, not rotation, leasing, or centralized audit.
- Standardizing on ESO but setting `refreshInterval` far longer than the actual rotation cadence of the upstream secret, so a rotated credential in the secret store doesn't reach the cluster for hours.
- Choosing a secret-management tool before deciding whether the actual requirement is "keep secrets out of Git" (Sealed Secrets), "centralize and rotate" (Vault/cloud manager + ESO), or both.

## Interview Questions

- Why isn't a native Kubernetes Secret sufficient as a full secrets-management strategy by itself?
- How does External Secrets Operator change the workflow for delivering a secret to a pod compared to writing a Secret manifest directly?
- What does Vault's "dynamic secrets" model provide that a static secret in any store, including Vault itself used statically, doesn't?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Security](../security/index.md) to see how these secret-delivery mechanisms fit into the cluster's broader security model — RBAC, Pod Security Standards, network policy, and encryption at rest.
