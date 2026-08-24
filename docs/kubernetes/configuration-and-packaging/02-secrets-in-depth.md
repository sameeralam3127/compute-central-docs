---
title: "Kubernetes Secrets In Depth: Types, Consumption, and RBAC"
icon: lucide/key-round
description: Kubernetes Secret types, consumption patterns, why base64 is encoding not encryption, and how RBAC scopes who can read Secrets.
tags:
  - Kubernetes
  - Configuration & Packaging
---

# Secrets in Depth

## What You'll Learn

- The built-in Secret types and what each one is structured for
- Why base64-encoded data is not encrypted data, and what that means for who can read a Secret
- How to scope RBAC so only the workloads and people that need a Secret can read it

## Why This Matters

A Secret object looks almost identical to a ConfigMap — same shape, same consumption patterns — which is exactly why it's dangerous to treat it as "ConfigMap but private." A Secret's `data` field is base64, not ciphertext, and by default anyone with `get` on `secrets` in that namespace can read every value in plaintext. Secrets are a convention and an API shape for sensitive data, not a security boundary by themselves — the security boundary is RBAC plus (ideally) encryption at rest and an external secret store layered on top.

## Mental Model

> A Secret is a ConfigMap with two differences: its values are base64-encoded rather than plaintext in the YAML, and `kubectl get`/`describe` redact its values by default. Neither of those is encryption — both are just friction against accidental shoulder-surfing, not a defense against anyone who can query the API.

| Secret type | `type:` value | Structure |
|---|---|---|
| Generic / arbitrary | `Opaque` | Free-form key-value pairs — the default and most common |
| Docker registry credentials | `kubernetes.io/dockerconfigjson` | A `.dockerconfigjson` key holding registry auth, referenced via `imagePullSecrets` |
| TLS certificate + key | `kubernetes.io/tls` | Exactly `tls.crt` and `tls.key` keys |
| Service account token | `kubernetes.io/service-account-token` | Auto-created/mounted for pod-to-API-server auth (or requested on demand via the TokenRequest API since 1.22+) |

## How It Works

### Opaque: the general-purpose type

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
  namespace: production
type: Opaque
data:
  username: YWRtaW4=          # echo -n 'admin' | base64
  password: c3VwZXJzZWNyZXQ=  # echo -n 'supersecret' | base64
```

`stringData` is often more convenient for authoring — write plaintext, and the API server base64-encodes it for you on write:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
stringData:
  username: admin
  password: supersecret
```

### dockerconfigjson: pulling from a private registry

```bash
kubectl create secret docker-registry regcred \
  --docker-server=registry.example.com \
  --docker-username=deploy \
  --docker-password="$REGISTRY_TOKEN" \
  --docker-email=deploy@example.com
```

```yaml
spec:
  imagePullSecrets:
    - name: regcred
  containers:
    - name: app
      image: registry.example.com/app:2.3.1
```

### kubernetes.io/tls: serving certificates

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-tls
type: kubernetes.io/tls
data:
  tls.crt: <base64 cert>
  tls.key: <base64 key>
```

Consumed as a volume mount by an Ingress controller or the application itself — this is the exact Secret shape `cert-manager` produces automatically when issuing certificates.

### Service account tokens

Every pod is automatically issued a projected, time-bound service account token (since 1.22+, via `serviceAccountToken` in a projected volume, not a long-lived Secret) unless `automountServiceAccountToken: false` is set. This token authenticates the pod to the API server as its service account and is the backbone of in-cluster RBAC:

```yaml
spec:
  serviceAccountName: app-reader
  automountServiceAccountToken: true
```

### Consumption patterns

Env var and volume mount both work exactly as they do for ConfigMaps, with one meaningful difference: `secret` volumes are backed by tmpfs, never written to the node's disk — which is a real reason to prefer volume mounts for Secrets over env vars even beyond the general env-var-leakage concerns from the [volumes](../storage/01-volumes.md) page.

```yaml
      env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
      volumeMounts:
        - name: db-creds
          mountPath: /etc/secrets/db
          readOnly: true
  volumes:
    - name: db-creds
      secret:
        secretName: db-credentials
```

### Base64 is encoding, not encryption

```bash
echo -n 'supersecret' | base64      # c3VwZXJzZWNyZXQ=
echo -n 'c3VwZXJzZWNyZXQ=' | base64 -d   # supersecret — trivially reversible
```

Anyone who can `kubectl get secret db-credentials -o jsonpath='{.data.password}'` and pipe it through `base64 -d` has the plaintext. There is no key, no passphrase, nothing cryptographic about it — it's the same transformation that makes binary data safe to embed in YAML/JSON, applied here to sensitive values for no security reason at all. By default, Secret data is also stored **unencrypted in etcd** — anyone with etcd access (or an etcd backup) has the same plaintext. Turning that off requires enabling encryption at rest explicitly. See [Secrets and Encryption at Rest](../security/06-secrets-and-encryption-at-rest.md) for how to actually close that gap.

### RBAC scoping

The real access control on a Secret is whatever RBAC rules grant `get`/`list`/`watch` on the `secrets` resource. Scope tightly, per namespace, per Secret name where possible:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: production
  name: db-secret-reader
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    resourceNames: ["db-credentials"]
    verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: app-reads-db-secret
  namespace: production
subjects:
  - kind: ServiceAccount
    name: app-sa
    namespace: production
roleRef:
  kind: Role
  name: db-secret-reader
  apiGroup: rbac.authorization.k8s.io
```

Avoid granting blanket `get`/`list` on `secrets` across an entire namespace — `list` in particular returns every Secret's full content in one call, which is a common way overly broad RBAC turns a single compromised service account into a namespace-wide credential leak.

## Common Mistakes

- Treating a Secret as encrypted because `kubectl get secret` doesn't print the value by default — it's redaction in the CLI output, not encryption of the underlying data.
- Committing a Secret manifest (even base64-encoded) to a plain Git repo — this is the same as committing plaintext credentials.
- Granting `list` on `secrets` cluster-wide or namespace-wide to a service account that only needs one specific Secret.
- Forgetting that etcd itself needs encryption at rest configured — Secrets are plaintext in the datastore by default.

## Interview Questions

- Why is "Secrets are base64-encoded" not a security answer, and what would actually make a Secret's data confidential at rest?
- What's the practical difference between mounting a Secret as an environment variable versus a volume?
- How would you scope RBAC so a service account can read one specific Secret but not enumerate every Secret in the namespace?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Injecting Config: Env and Volumes](03-injecting-config-env-and-volumes.md) to see ConfigMaps and Secrets combined into a real application's configuration.
