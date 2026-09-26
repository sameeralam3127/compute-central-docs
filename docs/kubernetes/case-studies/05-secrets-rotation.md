---
title: "Kubernetes Zero-Downtime Secrets Rotation Case Study"
icon: lucide/key-round
description: Rotating a database credential Secret used by a running Deployment with no downtime and no pod ever holding the stale credential simultaneously.
tags:
  - Kubernetes
  - Case Studies
---

# Case Study: Secrets Rotation

## Scenario

`orders-api` connects to a PostgreSQL database using credentials stored in a Kubernetes `Secret` and injected as environment variables. Security policy requires the database password to be rotated every 90 days. The team's first attempt at this — edit the `Secret` in place, do nothing else — didn't work: pods kept running with the old password in their environment (env vars are only read once at container start), so nothing actually rotated until pods happened to restart on their own, at which point some pods had the new password and some still had the old one, simultaneously, for an indeterminate window.

## Requirements

- The running Deployment must end up using the new credential, not just have a new `Secret` object sitting unused
- At no point should some pods hold the new credential while others hold the old one for longer than a single, brief, controlled rollout window
- The old credential must be revoked in the database only after every pod has confirmed rollout to the new one — revoking too early breaks any pod still using the old value
- Zero downtime — no window where `orders-api` can't reach the database at all

## Solution Walkthrough

### Why editing the Secret alone doesn't work

```bash
kubectl get secret orders-db-credentials -o yaml
```

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: orders-db-credentials
type: Opaque
data:
  DB_PASSWORD: b2xkLXBhc3N3b3JkLTEyMw== # base64 of the current password
```

Environment variables sourced from a Secret via `envFrom`/`secretKeyRef` are resolved **once**, when the container starts. Updating the `Secret` object with `kubectl apply` or `kubectl edit` changes what a *newly created* pod will read, but every pod that's already running keeps its original environment for its entire lifetime. This is the root cause of the team's first failed attempt — nothing forces existing pods to pick up the change.

!!! note "Volume-mounted Secrets behave differently, but not enough to solve this alone"
    A Secret mounted as a volume *does* update on the pod's filesystem automatically (via kubelet's periodic sync, usually within about a minute), unlike an env var. But that only helps if the application itself watches the file and reloads its DB connection pool — most apps, `orders-api` included, read the credential once at startup regardless of how it's delivered. The fix here is a controlled rollout either way.

### Step 1: Make the new credential valid *alongside* the old one

A zero-downtime rotation needs a window in which **both** the old and new credentials work, so pods on either side of the rollout can connect. Changing the password in place can't give you that: PostgreSQL's `ALTER USER ... PASSWORD` replaces the old password instantly, and every pod still on it starts failing at its next new connection.

The standard pattern is **two database users that take turns**. Both have identical privileges through a shared role; each rotation switches the application to the idle one:

```sql
-- One-time setup: privileges live on a role, not on the login users
CREATE ROLE orders_rw;
GRANT orders_rw TO orders_app_a, orders_app_b;

-- This rotation: the app currently uses orders_app_a, so refresh the idle user
ALTER USER orders_app_b WITH PASSWORD 'new-generated-password-456';
```

`orders_app_a` keeps working untouched while the Kubernetes side rolls over to `orders_app_b`. Managed services support the same idea: AWS Secrets Manager's "alternating users" rotation and Vault's database secrets engine do exactly this for you.

### Step 2: Update the Secret

```bash
kubectl create secret generic orders-db-credentials \
  --from-literal=DB_USER='orders_app_b' \
  --from-literal=DB_PASSWORD='new-generated-password-456' \
  --dry-run=client -o yaml | kubectl apply -f -
```

(Type the password into a prompt or pipe it from your secret manager rather than putting it on the command line, where it lands in shell history.)

This alone changes nothing for already-running pods, per the explanation above — it only sets up what the *next* rollout will use.

### Step 3: Force a rollout, tied to the Secret's actual content

The reliable way to force every pod to restart and pick up a changed Secret is to change something in the **pod template** itself, so the Deployment controller sees a real spec diff and performs a normal `RollingUpdate` — not `kubectl rollout restart`, which works but doesn't tie the restart to the Secret's actual content, making it easy to forget or to trigger a restart that doesn't actually pick up a genuinely new value.

The standard pattern is a checksum annotation computed from the Secret's content, injected into the pod template:

```bash
SECRET_HASH=$(kubectl get secret orders-db-credentials -o jsonpath='{.data.DB_PASSWORD}' | sha256sum | cut -d' ' -f1)

kubectl patch deployment orders-api -p \
  "{\"spec\":{\"template\":{\"metadata\":{\"annotations\":{\"credential-checksum/db-password\":\"${SECRET_HASH}\"}}}}}"
```

```yaml title="orders-api-deployment.yaml (relevant excerpt after the patch)"
spec:
  template:
    metadata:
      annotations:
        credential-checksum/db-password: "b3f1c9..." # changes only when the Secret's value changes
    spec:
      containers:
        - name: orders-api
          envFrom:
            - secretRef:
                name: orders-db-credentials
```

Because the annotation is part of `spec.template`, changing it is a real Deployment spec change — Kubernetes creates a new ReplicaSet and rolls it out exactly like a normal image update, respecting `maxSurge`/`maxUnavailable` and readiness probes the whole way through:

```bash
kubectl rollout status deployment/orders-api
```

```text
Waiting for deployment "orders-api" rollout to finish: 2 out of 6 new replicas have been updated...
deployment "orders-api" successfully rolled out
```

### Step 4: Confirm every pod is on the new credential before revoking the old one

Compare the **checksum annotation** on every running Pod rather than printing the password itself into your terminal (the Verification section below shows the command). Then confirm from the database side that nothing still uses the old user:

```sql
SELECT usename, count(*) FROM pg_stat_activity
WHERE usename IN ('orders_app_a', 'orders_app_b') GROUP BY usename;
```

When `orders_app_a` shows zero connections for a few minutes, lock it: `ALTER USER orders_app_a WITH PASSWORD NULL;` (or `NOLOGIN`). Next quarter's rotation refreshes `orders_app_a` and switches back.

## Verification

```bash
kubectl rollout status deployment/orders-api
kubectl get pods -l app=orders-api -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.metadata.annotations.credential-checksum/db-password}{"\n"}{end}'
```

Every pod should show the same, current checksum — confirming there's no pod left over from before the rollout. Then verify the application itself is actually connecting successfully with the new credential, not just that the environment variable is set correctly:

```bash
kubectl logs deployment/orders-api --tail=50 | grep -i "database connection"
kubectl get pods -l app=orders-api    # all Ready: the readiness probe runs a real query against the database
```

(`pg_isready` isn't enough here: it only checks that the server accepts connections, not that these credentials work.)

Finally, confirm the rollout produced zero downtime the same way as the [zero-downtime rolling deployment case study](01-rolling-deployment-with-zero-downtime.md) — a continuous request loop against `orders-api` during the rollout window with a final failure count of `0`.

## What Could Go Wrong

- **Editing the Secret and stopping there** — the original failure mode. Nothing forces existing pods to reread it; the rollout step is not optional.
- **Rotating the password on the only database user** — there's no moment where both old and new work, so a zero-downtime rollout is impossible; pods on the old side fail as soon as they open a new connection. Use alternating users (above) or a secret manager that does it for you.
- **Revoking the old database credential before the rollout finishes** — any pod still mid-rollout (or a pod that fails to become Ready and gets left behind by `maxUnavailable`) is now holding a permanently invalid credential and will fail every request until manually restarted. Always gate revocation on `kubectl rollout status` succeeding *and* the per-pod checksum check above, not on a timer.
- **Using `kubectl rollout restart` without an annotation tied to the Secret's content** — this does force a restart, but it's disconnected from whether the Secret actually changed. It's easy to run it against the wrong Deployment, forget to run it at all after a Secret update, or run it redundantly when nothing changed — the checksum-annotation pattern makes the pod template's own diff the source of truth instead of a human remembering a manual step.
- **Rotating the Secret's *name* instead of its content** — some teams create a new Secret object (`orders-db-credentials-v2`) and repoint the Deployment at it. This works, but leaves the old Secret object behind indefinitely unless someone remembers to clean it up, and doubles the RBAC surface (anyone with read access to Secrets in the namespace can now read both the old and new credential).
- **Assuming a volume-mounted Secret "just updates" safely** — the file on disk does update automatically, but if the application doesn't watch for file changes and reconnect, it's functionally identical to the env var problem — just with a longer, less predictable delay before anyone notices pods are still using the stale in-memory value.

## Next

See [Debugging a CrashLoopBackOff Incident](06-debugging-a-crashloopbackoff-incident.md) for what happens when a rollout like this one goes wrong instead of right.
