---
title: "Kubernetes Init:CrashLoopBackOff and Stuck Init Containers"
icon: lucide/list-start
description: "Fix Kubernetes pods stuck in Init:0/1, Init:Error, or Init:CrashLoopBackOff — read init container logs, fix dependency waits, migrations, and permissions."
tags:
  - Kubernetes
  - Troubleshooting
  - Init Containers
---

# Kubernetes Init:CrashLoopBackOff and Stuck Init Containers

## Problem

A pod never gets past its init containers. The application container doesn't start because Kubernetes runs init containers first, one at a time, and each must finish successfully before the next begins.

```text
NAME                        READY   STATUS                  RESTARTS      AGE
orders-api-7c9d8b6f5-k2x4p  0/1     Init:CrashLoopBackOff   5 (90s ago)   8m
orders-api-7c9d8b6f5-m8q2z  0/1     Init:0/2                0             15m
```

## Symptoms

| Status | Meaning |
|---|---|
| `Init:0/2` for a long time | The first of two init containers is still running — usually waiting forever |
| `Init:Error` | An init container exited non-zero |
| `Init:CrashLoopBackOff` | An init container keeps failing and the kubelet is backing off |
| `Init:ImagePullBackOff` | An init container's image can't be pulled — see [ImagePullBackOff](imagepullbackoff.md) |
| `PodInitializing` | Init containers finished; app containers are starting |

`kubectl logs <pod>` for the main container returns nothing useful — it hasn't started. The clues are in the init container's logs.

## Likely Causes

1. **A wait-for-dependency loop with no timeout.** The init container polls a database or service that isn't reachable (wrong hostname, wrong namespace, network policy, dependency down).
2. **A database migration fails.** The migration errors out, or conflicts with another replica running the same migration at the same time.
3. **A setup step lacks permissions.** `chown` or writes to a volume fail under a non-root security context.
4. **Missing configuration.** The init container needs a Secret or ConfigMap key that doesn't exist.
5. **Wrong image or command** for the init container itself.

## Diagnostic Commands

```bash
# 1. Which init container is running or failing, and its state
kubectl get pod orders-api-7c9d8b6f5-k2x4p \
  -o jsonpath='{range .status.initContainerStatuses[*]}{.name}{"\t"}{.ready}{"\t"}{.restartCount}{"\t"}{.state}{"\n"}{end}'

# 2. Logs from the init container (use --previous if it's restarting)
kubectl logs orders-api-7c9d8b6f5-k2x4p -c wait-for-db
kubectl logs orders-api-7c9d8b6f5-k2x4p -c migrate --previous

# 3. Init container spec, events, and mounts
kubectl describe pod orders-api-7c9d8b6f5-k2x4p
kubectl get pod orders-api-7c9d8b6f5-k2x4p -o jsonpath='{range .spec.initContainers[*]}{.name}{"\t"}{.image}{"\t"}{.command}{"\n"}{end}'
```

To test the dependency the init container is waiting for, run a throwaway pod in the same namespace:

```bash
kubectl run nettest -n orders --rm -it --image=busybox:1.37 -- sh
# inside
nslookup orders-db.orders.svc.cluster.local
nc -zv -w 3 orders-db.orders.svc.cluster.local 5432
```

## Step-by-Step Debugging

1. **Identify the init container that's blocking.** Init containers run in order, so the first one that isn't `ready: true` is the culprit.
2. **Read its logs,** including `--previous` for restarting init containers.
3. **If it's waiting,** check the exact host and port it's polling, and test them from the same namespace. A Service in another namespace needs its full name: `orders-db.database.svc.cluster.local`.
4. **Check network policies** in both namespaces if DNS resolves but connections time out — see [Networking and Service Problems](02-networking-and-service-problems.md).
5. **If it's a migration,** read the migration tool's error and check whether several replicas started migrating at the same moment.
6. **If it's a permission error,** compare the init container's `securityContext` with the ownership of the volume it writes.

## Solutions

### Bound every wait

A wait that never gives up hangs rollouts silently. Fail after a reasonable time so the pod reports an error you can see:

```yaml
initContainers:
  - name: wait-for-db
    image: busybox:1.37
    command:
      - sh
      - -c
      - |
        for i in $(seq 1 60); do
          nc -z -w 2 orders-db.database.svc.cluster.local 5432 && exit 0
          echo "waiting for database ($i/60)"; sleep 5
        done
        echo "database not reachable after 5 minutes" >&2
        exit 1
```

Better still, make the application retry its connections on startup, and drop the wait container entirely. Readiness probes then keep traffic away until it connects.

### Run migrations once, not per replica

Running migrations in an init container means every replica — and every restart — tries to migrate. Move them to a dedicated Job that runs before the rollout, for example a Helm `pre-upgrade` hook or a pipeline step:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: orders-migrate-2-14-0
spec:
  backoffLimit: 2
  activeDeadlineSeconds: 600
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: registry.example.com/orders-api:2.14.0
          command: ["./manage", "migrate"]
          envFrom:
            - secretRef:
                name: orders-db
```

If migrations must stay in an init container, use a tool that takes a database lock so concurrent runs wait instead of colliding.

### Permissions on volumes

Prefer `fsGroup` over a root `chown` init container:

```yaml
securityContext:
  runAsUser: 10001
  runAsGroup: 10001
  fsGroup: 10001
  fsGroupChangePolicy: OnRootMismatch   # skip recursive changes when ownership is already correct
```

### Native sidecars are different

Init containers with `restartPolicy: Always` are **sidecar containers**. They start in order like init containers but keep running alongside the app instead of blocking it. If a log shipper or proxy was accidentally defined as a regular init container, the pod waits forever for it to exit — add `restartPolicy: Always` to make it a sidecar.

## Prevention

- Give every init container a single responsibility and a clear failure message.
- Put timeouts on waits, and prefer application-level retries.
- Run schema migrations as Jobs tied to the release, not per pod.
- Keep init container images small and pinned, and pull them from the same trusted registry as the app.

## Production Considerations

- **Init failures block scale-ups too.** During a traffic spike, new replicas stuck in `Init` add no capacity. Alert on pods in `Init` states for more than a few minutes.
- **A dependency outage becomes a deploy outage.** If every new pod waits for a downstream service, you can't roll out a fix while that service is down. Application retries avoid this coupling.
- **Restarting the pod re-runs all init containers,** including one-time setup steps. Make them idempotent.

## Related Problems

- [CrashLoopBackOff](crashloopbackoff.md) — the same back-off, for app containers
- [ImagePullBackOff](imagepullbackoff.md) — `Init:ImagePullBackOff`
- [Service and DNS problems](02-networking-and-service-problems.md)
- [Pods: init containers and lifecycle](../core-concepts/01-pods.md)
- [All pod startup errors](01-pod-scheduling-and-startup-problems.md)
