---
title: "Secrets Management With Vault: Dynamic Secrets and Workload Auth"
icon: lucide/vault
description: "Manage secrets with Vault or OpenBao — KV, policies, dynamic database credentials, Kubernetes and GitHub Actions auth, and External Secrets."
tags:
  - Security
  - Vault
  - Secrets
---

# Secrets Management With Vault

## What You'll Learn

- Why secrets sprawl is dangerous, and what a central secrets manager provides
- Vault's core concepts: auth methods, secrets engines, policies, tokens, and leases
- How to store static secrets and generate short-lived dynamic database credentials
- How Kubernetes workloads and CI pipelines authenticate to Vault without stored credentials
- How to deliver secrets to applications with Vault Agent or External Secrets Operator

## The Problem: Secrets Sprawl

Without a strategy, secrets end up everywhere: `.env` files on laptops, CI variables, Kubernetes Secrets in Git, config management, chat messages, and wikis. Each copy is a place to leak from, nobody knows who can read what, and rotating a password means hunting through every system.

A secrets manager provides:

| Capability | Why it matters |
|---|---|
| **One source of truth** | Rotate a secret once; every consumer gets the new value |
| **Access control and audit** | Every read is authorized by policy and logged |
| **Workload identity** | Applications authenticate with the identity they already have, not another secret |
| **Short-lived, dynamic credentials** | Leaked credentials expire in minutes or hours |
| **Encryption as a service** | Apps encrypt data without handling keys |

## Vault and OpenBao

**HashiCorp Vault** is the most widely used self-managed secrets manager, available as self-hosted Community and Enterprise editions or as HCP Vault Dedicated. Since 2023 it has been distributed under the Business Source License. **OpenBao** is an open-source fork under the Linux Foundation, maintaining API compatibility with most Vault features; its CLI is `bao` instead of `vault`. The concepts and most commands on this page apply to both.

Cloud-native alternatives — AWS Secrets Manager, Azure Key Vault, Google Secret Manager — are often the simplest choice for workloads on a single cloud. See [AWS Security and Secrets](../cloud/aws/10-security-and-secrets.md). Vault is valuable when you run across several clouds and on-premises, need dynamic secrets for many backends, or want one policy and audit model everywhere.

## Core Concepts

```mermaid
flowchart LR
  C["Client<br/>(app, CI job, person)"] -->|"1. authenticate with an<br/>identity it already has"| AM["Auth method<br/>Kubernetes, JWT/OIDC, AWS IAM"]
  AM -->|"2. token with policies"| C
  C -->|"3. request with token"| SE["Secrets engine<br/>KV, database, PKI, transit"]
  P["Policies"] -.->|"authorize"| SE
  SE -->|"4. secret, with a lease"| C
  SE -.-> AUD["Audit device<br/>every request logged"]
```

| Concept | Meaning |
|---|---|
| **Auth method** | How clients prove who they are: Kubernetes service account tokens, JWT/OIDC (CI systems, SSO), AWS IAM, AppRole, and more |
| **Token** | What a successful login returns; carries policies and a TTL |
| **Policy** | Paths and capabilities a token is allowed (`read`, `create`, `update`, `delete`, `list`) — deny by default |
| **Secrets engine** | A component mounted at a path that stores, generates, or encrypts data |
| **Lease** | The lifetime of a dynamic secret; Vault revokes the credential when it expires |
| **Seal / unseal** | Vault's storage is encrypted; it starts sealed and must be unsealed, usually automatically with a cloud KMS |
| **Audit device** | Logs every request and response, with secrets HMAC'd |

## Try It Locally

```bash
# Development mode: in-memory, unsealed, root token "root" — never use in production
vault server -dev -dev-root-token-id=root
```

```bash
export VAULT_ADDR=http://127.0.0.1:8200
export VAULT_TOKEN=root
vault status
```

## Static Secrets With KV v2

```bash
vault secrets enable -path=kv kv-v2

vault kv put kv/orders/prod/payment-provider api_key=sk_live_example webhook_secret=whsec_example
vault kv get kv/orders/prod/payment-provider
vault kv get -field=api_key kv/orders/prod/payment-provider

# KV v2 keeps versions
vault kv put kv/orders/prod/payment-provider api_key=sk_live_rotated webhook_secret=whsec_example
vault kv get -version=1 kv/orders/prod/payment-provider
vault kv rollback -version=1 kv/orders/prod/payment-provider
```

Organize paths so policies are simple: `kv/<team-or-service>/<environment>/<secret>`.

## Policies

```hcl title="orders-api-prod.hcl"
# Read the service's own static secrets
path "kv/data/orders/prod/*" {
  capabilities = ["read"]
}

# Generate dynamic database credentials
path "database/creds/orders-api" {
  capabilities = ["read"]
}

# Encrypt and decrypt with a transit key, without ever seeing the key
path "transit/encrypt/orders-pii" {
  capabilities = ["update"]
}
path "transit/decrypt/orders-pii" {
  capabilities = ["update"]
}
```

```bash
vault policy write orders-api-prod orders-api-prod.hcl
```

KV v2 API paths include `data/` (for values) and `metadata/` (for versions and deletion), even though the CLI hides it — a frequent source of "permission denied".

## Dynamic Database Credentials

Instead of one shared, long-lived database password, Vault creates a **unique user per application instance**, with a short TTL, and drops it when the lease expires.

```bash
vault secrets enable database

vault write database/config/orders-db \
  plugin_name=postgresql-database-plugin \
  connection_url="postgresql://{{username}}:{{password}}@orders-db.internal:5432/orders?sslmode=require" \
  allowed_roles="orders-api" \
  username="vault_admin" \
  password="initial-admin-password"

# Rotate the admin password so only Vault knows it
vault write -f database/rotate-root/orders-db

vault write database/roles/orders-api \
  db_name=orders-db \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
  default_ttl=1h \
  max_ttl=24h
```

```bash
$ vault read database/creds/orders-api
Key                Value
---                -----
lease_id           database/creds/orders-api/2Vq8t3...
lease_duration     1h
lease_renewable    true
password           A1b-2cD3eF4gH5iJ6kL7
username           v-kubernet-orders-a-9QZ3kLmN4pRsT
```

Benefits:

- A leaked credential works for at most an hour.
- Every credential maps to one lease, so audit logs show exactly which workload did what.
- Revoking access is one command: `vault lease revoke -prefix database/creds/orders-api`.

The application must handle credential renewal or reconnection when a lease rotates — Vault Agent or a connection pool that reloads credentials takes care of this.

## Kubernetes Authentication

Pods authenticate with their **service account token**; no Vault token is ever stored in the cluster.

```bash
vault auth enable kubernetes

# When Vault runs inside the cluster it can discover the API server itself
vault write auth/kubernetes/config \
  kubernetes_host="https://kubernetes.default.svc:443"

vault write auth/kubernetes/role/orders-api \
  bound_service_account_names=orders-api \
  bound_service_account_namespaces=orders \
  audience=vault \
  token_policies=orders-api-prod \
  token_ttl=1h
```

Only pods running as the `orders-api` service account in the `orders` namespace receive the `orders-api-prod` policy.

## CI Authentication With OIDC (GitHub Actions)

```bash
vault auth enable jwt

vault write auth/jwt/config \
  oidc_discovery_url="https://token.actions.githubusercontent.com" \
  bound_issuer="https://token.actions.githubusercontent.com"

vault write auth/jwt/role/orders-deploy - <<'EOF'
{
  "role_type": "jwt",
  "user_claim": "actor",
  "bound_audiences": ["https://github.com/acme"],
  "bound_claims": {
    "repository": "acme/orders-api",
    "environment": "production"
  },
  "token_policies": ["orders-deploy"],
  "token_ttl": "10m"
}
EOF
```

```yaml title=".github/workflows/deploy.yml (excerpt)"
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: hashicorp/vault-action@v4
        with:
          url: https://vault.acme.internal
          method: jwt
          role: orders-deploy
          jwtGithubAudience: https://github.com/acme
          secrets: |
            kv/data/orders/prod/payment-provider api_key | PAYMENT_API_KEY
```

The role is bound to one repository and one environment, so a workflow in any other repository — or on an unprotected branch — can't obtain the token.

## Delivering Secrets to Applications

| Pattern | How it works | Good for |
|---|---|---|
| **Direct API calls** | The app uses a Vault SDK | Apps that need dynamic secrets or encryption as a service, and can take the dependency |
| **Vault Agent** | A sidecar or daemon authenticates, renews leases, and renders secrets to files | Apps that read config files; no code changes |
| **External Secrets Operator** | Syncs secrets from Vault (and cloud managers) into Kubernetes Secrets | Kubernetes apps expecting normal Secrets and env vars |
| **Secrets Store CSI Driver** | Mounts secrets as files directly into pods | Avoiding Kubernetes Secret objects entirely |

### External Secrets Operator

```yaml title="secretstore.yaml"
apiVersion: external-secrets.io/v1
kind: SecretStore
metadata:
  name: vault
  namespace: orders
spec:
  provider:
    vault:
      server: https://vault.acme.internal
      path: kv
      version: v2
      auth:
        kubernetes:
          mountPath: kubernetes
          role: orders-api
          serviceAccountRef:
            name: orders-api
```

```yaml title="externalsecret.yaml"
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: payment-provider
  namespace: orders
spec:
  refreshInterval: 15m
  secretStoreRef:
    kind: SecretStore
    name: vault
  target:
    name: payment-provider       # the Kubernetes Secret to create
  data:
    - secretKey: API_KEY
      remoteRef:
        key: orders/prod/payment-provider
        property: api_key
```

The trade-off: synced values become Kubernetes Secrets, so protect them with RBAC and encryption at rest. See [External Secrets and Secret Stores](../kubernetes/configuration-and-packaging/06-external-secrets-and-secret-stores.md).

## Running Vault in Production

- **High availability** with integrated storage (Raft) across at least three nodes in different zones, or use a managed service.
- **Auto-unseal** with a cloud KMS or HSM, so restarts don't need humans holding unseal keys.
- **Audit devices** enabled and shipped to your log platform — Vault can be configured to refuse requests if it can't write audit logs.
- **No root tokens** in daily use: generate one for break-glass tasks, then revoke it.
- **Backups**: automated Raft snapshots stored in another account or region, restores tested.
- **TLS everywhere**, and network access limited to clients that need it.
- **Monitor** seal status, leader changes, request latency, lease counts, and certificate expiry.

## Common Mistakes

- Using `vault server -dev` settings, or the root token, beyond local experiments.
- One broad policy (`path "kv/*"`) shared by every application.
- Writing KV v2 policies without the `data/` segment, then granting wider access to "fix" the denial.
- Storing a Vault token as a Kubernetes Secret or CI variable instead of using Kubernetes or OIDC authentication.
- JWT roles for CI without repository and branch or environment claims bound.
- Dynamic credentials that the application reads once at startup and never renews.
- No audit device, so there's no record of who read which secret.

## Interview Questions

- What problems does a central secrets manager solve compared with CI variables and Kubernetes Secrets?
- Explain Vault auth methods, secrets engines, and policies.
- What are dynamic secrets, and why are they safer than static passwords?
- How does a pod authenticate to Vault without any stored credential?
- How would you let a GitHub Actions workflow read a production secret, and only from the right repository and environment?

## Next

Continue to [Software Supply Chain Security](03-software-supply-chain-security.md).
