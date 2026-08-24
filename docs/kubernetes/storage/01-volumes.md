---
title: "Kubernetes Volumes: emptyDir, hostPath, and Projected Volumes"
icon: lucide/hard-drive
description: The ephemeral Kubernetes volume types attached directly to a pod spec, why hostPath is dangerous, and why none of them survive a pod being rescheduled.
tags:
  - Kubernetes
  - Storage
---

# Volumes

## What You'll Learn

- The ephemeral volume types Kubernetes attaches directly to a pod (`emptyDir`, `hostPath`, `configMap`, `secret`, `projected`) and what each one is actually for
- Why `hostPath` is one of the most dangerous things you can put in a manifest
- Why a pod's `volumes:` block, on its own, never gives you durable storage — which is exactly the gap PersistentVolumes fill

## Why This Matters

Every container filesystem is ephemeral by default: kill the container, lose everything written inside it. A `volumes:` block lets containers in the same pod share a filesystem, survive a container restart, or read configuration and secrets as files — but it does **not**, by itself, protect data from pod rescheduling. Confusing "this pod has a volume" with "this data is safe" is one of the most common storage mistakes on real clusters.

## Mental Model

> A volume is storage with a lifecycle tied to something specific — a pod, a node, or an external system. Ephemeral volumes are tied to the **pod**: when the pod is deleted, the volume (and usually its data) goes with it, no matter which node it lands on next.

| Volume type | Lifecycle | Backed by | Typical use |
|---|---|---|---|
| `emptyDir` | Pod | kubelet-managed directory on the node (or tmpfs in RAM) | Scratch space, cache, sharing files between containers in one pod |
| `hostPath` | Node | A path on the *node's* filesystem | Node-level agents, log collectors — rarely application data |
| `configMap` | Pod (read-only) | The ConfigMap object | Mounting config files into a container |
| `secret` | Pod (read-only), tmpfs-backed | The Secret object | Mounting credentials, TLS material, tokens |
| `projected` | Pod (read-only) | Multiple sources combined into one directory | Merging ConfigMap + Secret + downward API + service account token in one mount |

## How It Works

### `emptyDir`: pod-scoped scratch space

`emptyDir` is created empty when the pod is scheduled and deleted permanently when the pod is removed from the node — including when the pod is evicted or crashes past its restart budget. It's the correct choice for anything you're comfortable losing: a build cache, a temporary sort buffer, a Unix socket shared between an app container and its sidecar.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: cache-demo
spec:
  containers:
    - name: app
      image: myapp:1.8.2
      volumeMounts:
        - name: scratch
          mountPath: /tmp/cache
    - name: sidecar
      image: myapp-sidecar:1.8.2
      volumeMounts:
        - name: scratch
          mountPath: /var/cache/shared
  volumes:
    - name: scratch
      emptyDir:
        sizeLimit: 1Gi
```

Setting `sizeLimit` matters: an unbounded `emptyDir` can fill node disk and trigger evictions for every pod on that node, not just the offender. For latency-sensitive scratch data, `emptyDir.medium: Memory` backs the volume with tmpfs — fast, but it counts against the pod's memory limit and disappears immediately on container restart.

### `hostPath`: powerful and dangerous

`hostPath` mounts a path from the **node's own filesystem** into the pod. That means:

- Data survives pod restarts on the *same node*, but a reschedule to a different node sees a completely different (usually empty) directory at that path.
- Two pods on the same node using the same `hostPath` share the same underlying files — with no coordination, locking, or Kubernetes-level isolation.
- A pod with write access to sensitive `hostPath` locations (`/etc`, `/var/run/docker.sock`, the kubelet's own directories) can affect or compromise the node itself. This is a standard container-escape vector and is blocked by the Restricted Pod Security Standard.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: node-exporter-demo
spec:
  containers:
    - name: node-exporter
      image: prom/node-exporter:v1.8.2
      volumeMounts:
        - name: proc
          mountPath: /host/proc
          readOnly: true
  volumes:
    - name: proc
      hostPath:
        path: /proc
        type: Directory
```

Legitimate `hostPath` use is almost always a node-level agent (a monitoring exporter, a log shipper, a CNI or CSI driver component) reading node state read-only — not application data storage. If you find yourself reaching for `hostPath` to persist database files, that's the signal to move to a PersistentVolumeClaim instead.

### ConfigMap, Secret, and projected volumes

Mounting a ConfigMap or Secret as a volume turns each key into a file in the mount directory, rather than an environment variable:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: configured-app
spec:
  containers:
    - name: app
      image: myapp:1.8.2
      volumeMounts:
        - name: app-config
          mountPath: /etc/app/config
          readOnly: true
        - name: tls-certs
          mountPath: /etc/app/tls
          readOnly: true
  volumes:
    - name: app-config
      configMap:
        name: app-config
    - name: tls-certs
      secret:
        secretName: app-tls
```

`secret` volumes are backed by tmpfs (RAM-backed, never written to disk on the node), which is why Secrets should generally be consumed as volumes rather than environment variables when the workload can support it.

A `projected` volume merges several sources into a single mount point — commonly a ConfigMap, a Secret, the downward API, and a service account token together:

```yaml
volumes:
  - name: all-in-one
    projected:
      sources:
        - configMap:
            name: app-config
        - secret:
            name: app-tls
        - downwardAPI:
            items:
              - path: "pod-labels"
                fieldRef:
                  fieldPath: metadata.labels
        - serviceAccountToken:
            path: token
            expirationSeconds: 3600
```

### Why none of this survives a reschedule

Every volume type on this page is tied to the pod (or, for `hostPath`, to one specific node). If a node dies, or the scheduler evicts and reschedules the pod elsewhere, the pod comes back with a **brand-new**, empty ephemeral volume. There is no Kubernetes mechanism here that migrates or preserves the data — that guarantee only exists once storage is backed by a PersistentVolume, which is decoupled from any single pod's lifecycle. That's the subject of the next page.

## Common Mistakes

- Using `hostPath` for application data (databases, uploaded files) instead of a PersistentVolumeClaim — data silently disappears on reschedule, and it's a security liability in the meantime.
- Not setting `sizeLimit` on `emptyDir`, letting one runaway pod exhaust node disk and cause cascading evictions.
- Mounting a Secret as an environment variable when a volume mount was available — env vars are more likely to leak into logs, crash dumps, and `/proc/<pid>/environ`.
- Assuming a `configMap` or `secret` volume update takes effect immediately in every consumption path — kubelet does propagate volume-mounted updates (with a short sync delay), but only for the volume mount, not for values already injected as environment variables at pod start.

## Interview Questions

- What's the difference between `emptyDir` and `hostPath`, and when is `hostPath` actually appropriate?
- Why is a Secret usually mounted as a volume instead of injected as an environment variable?
- If a pod with an `emptyDir` volume is rescheduled to a different node, what happens to its data?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [PersistentVolumes and PersistentVolumeClaims](02-persistentvolumes-and-claims.md) to see how Kubernetes decouples storage from any single pod's lifecycle.
