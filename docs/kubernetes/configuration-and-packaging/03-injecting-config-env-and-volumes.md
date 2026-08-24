---
title: "Injecting Kubernetes Config: 12-Factor Patterns for Real Apps"
icon: lucide/plug
description: Practical 12-factor configuration for a real application — combining ConfigMaps, Secrets, env vars, and projected volumes, plus env var precedence and reload patterns.
tags:
  - Kubernetes
  - Configuration & Packaging
---

# Injecting Config: Env and Volumes

## What You'll Learn

- How to combine ConfigMaps, Secrets, plain env vars, and projected volumes for one realistic application
- The exact precedence order when multiple sources define the same environment variable
- Restart-to-pick-up-changes versus live-reload, and how to choose deliberately instead of by accident

## Why This Matters

The [12-factor app](https://12factor.net/config) principle is simple: config varies between deploys, code doesn't, so config belongs in the environment, not in the image. Kubernetes gives you four different mechanisms to satisfy that (`env`, `envFrom`, ConfigMap volumes, Secret volumes) and none of them enforce discipline on their own — a real application's config is usually a deliberate mix, and getting the mix wrong is a common source of "works on my cluster" surprises.

## Mental Model

> Treat config sources like layers: **non-sensitive, rarely-changing values** as env vars for simplicity; **sensitive values** as Secret volumes for the tmpfs and no-crash-dump-leak properties; **anything the app should hot-reload without a restart** as a plain ConfigMap volume; and **per-replica identity** (pod name, namespace, IP) via the downward API, merged in with a projected volume when convenient.

## How It Works

### A realistic combined example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orders-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: orders-api
  template:
    metadata:
      labels:
        app: orders-api
      annotations:
        checksum/config: "a1b2c3d4"   # bumped by CI/CD whenever app-config changes
    spec:
      serviceAccountName: orders-api
      containers:
        - name: orders-api
          image: registry.example.com/orders-api:2.4.0
          env:
            - name: APP_ENV
              value: "production"
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: DB_HOST
              valueFrom:
                configMapKeyRef:
                  name: orders-config
                  key: db_host
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: orders-db-credentials
                  key: password
          envFrom:
            - configMapRef:
                name: orders-feature-flags
          volumeMounts:
            - name: app-config
              mountPath: /etc/orders-api/config
              readOnly: true
            - name: tls-certs
              mountPath: /etc/orders-api/tls
              readOnly: true
      volumes:
        - name: app-config
          configMap:
            name: orders-config
        - name: tls-certs
          projected:
            sources:
              - secret:
                  name: orders-tls
              - serviceAccountToken:
                  path: token
                  expirationSeconds: 3600
```

This one manifest deliberately uses every mechanism for a reason: `APP_ENV` is a static literal, `POD_NAME` comes from the downward API for per-replica logging context, `DB_HOST` is a rarely-changing ConfigMap value read once at startup, `DB_PASSWORD` is a Secret env var (acceptable here because the app reads it once at boot and never logs environment dumps), feature flags come in bulk via `envFrom` so new flags don't require manifest edits, and TLS material plus a scoped service account token are merged into one directory via a projected volume.

### Environment variable precedence

When multiple sources could define the same name, Kubernetes resolves conflicts in a fixed order:

1. `env` entries are applied in the order they're listed — later entries with the same name **do not** override earlier ones; the **first** definition of a given name in `env` wins.
2. `envFrom` entries are applied in list order, each one merging in that source's keys; a naming collision between two `envFrom` sources resolves to the **last** one listed.
3. `env` always wins over `envFrom` regardless of list order — explicit `env` entries take priority over anything coming from a bulk `envFrom` import.

```yaml
      env:
        - name: LOG_LEVEL
          value: "debug"          # this wins over anything from envFrom below
      envFrom:
        - configMapRef:
            name: shared-defaults   # even if shared-defaults also defines LOG_LEVEL
        - configMapRef:
            name: team-overrides    # if both configmaps define the same key, this one wins between the two
```

This ordering is easy to get backwards from memory — always verify with `kubectl exec <pod> -- env` rather than assuming.

### Restart-to-pick-up vs. live-reload

| Approach | How it works | Trade-off |
|---|---|---|
| **Restart-to-pick-up** | Config baked in at container start (env vars); a config change requires a new pod (manual `kubectl rollout restart` or an automated checksum annotation bump) | Simple, predictable, guarantees the whole fleet runs one consistent config version at a time |
| **Live-reload** | App watches a mounted ConfigMap/Secret file (via `inotify`, polling, or a sidecar like `configmap-reload`) and reapplies config without restarting | No downtime for config changes, but the app must implement watching correctly, and a fleet can transiently run mixed config versions during propagation |

Most teams default to restart-to-pick-up for anything correctness-sensitive (database connection strings, feature flags that affect business logic) and reserve live-reload for genuinely hot-swappable things like log levels or a reverse proxy's upstream list.

```bash
# Restart-to-pick-up, triggered explicitly
kubectl rollout restart deployment/orders-api
kubectl rollout status deployment/orders-api
```

## Common Mistakes

- Assuming `env` list order determines a "last one wins" precedence — it's actually first-one-wins within `env`, which is the opposite of most people's intuition.
- Relying on live-reload for a value the application only reads once at process start, then wondering why nothing changes even though the mounted file updated correctly.
- Mixing static, rarely-changing config with per-deploy secrets in a single ConfigMap/Secret, making it impossible to rotate one without touching the other.
- Not bumping a config-checksum annotation (or otherwise forcing a rollout) after a ConfigMap/Secret change, then assuming a "config-only, no-code-change" deploy happened when in fact zero running pods picked it up.

## Interview Questions

- If both `env` and `envFrom` define the same variable name on a container, which one wins, and why is that easy to get backwards?
- Design the config strategy for a service that needs a hot-reloadable log level but a restart-required database connection string. What mechanism would you use for each?
- What's the risk of relying purely on live-reload for a fleet of 50 replicas during a config change?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Helm Fundamentals and Writing Charts](04-helm-fundamentals-and-writing-charts.md) to package this kind of manifest for reuse across environments.
