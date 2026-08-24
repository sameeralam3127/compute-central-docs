---
title: "Kubernetes Volumes Basics: emptyDir, hostPath, and Pod Ephemerality"
icon: lucide/hard-drive
description: Intro-level Kubernetes storage — why Pods are ephemeral by design, and the two simplest volume types, emptyDir and hostPath.
tags:
  - Kubernetes
  - Core Concepts
---

# Volumes and Storage Basics

## What You'll Learn

- Why a Pod's local filesystem disappears when the Pod does, and why that's deliberate
- What `emptyDir` and `hostPath` actually do, and the narrow cases each is appropriate for
- Where real persistent storage (PV, PVC, StorageClass) is actually covered

## Why This Matters

The single most common storage mistake for anyone new to Kubernetes is assuming a Pod's filesystem behaves like a regular server's disk. It doesn't — and understanding exactly why, in terms of the container filesystem lifecycle, prevents a very believable-looking data-loss bug later.

## Why Pods Are Ephemeral

A container's writable filesystem layer exists only as long as that specific container instance does. When a Pod is deleted, rescheduled to another node, or even just restarted after a crash, Kubernetes doesn't try to preserve that writable layer — a brand-new container starts from the image's contents, every time.

```mermaid
flowchart LR
    A["Pod running,\nwrites to /data"] -->|crash / delete / reschedule| B["Container filesystem discarded"]
    B --> C["New Pod created\nfrom the same image"]
    C -->|"/data is back to\nthe image's original contents"| D["Anything written\nis gone, unless\nit lived on a volume"]
```

This is deliberate: it's what makes Pods safe to kill and recreate at will, which is the entire foundation of self-healing and rolling updates. A **volume** is how you opt specific directories out of that discard-on-restart behavior.

## emptyDir: Scratch Space That Outlives a Container Restart, Not the Pod

An `emptyDir` volume is created empty when the Pod is assigned to a node, and every container in that Pod can read and write to it — including across a container restart within the same Pod. It's deleted permanently when the **Pod** itself is removed.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: cache-demo
spec:
  containers:
    - name: app
      image: myapp:1.4.2
      volumeMounts:
        - name: scratch
          mountPath: /tmp/cache
  volumes:
    - name: scratch
      emptyDir: {}
```

Good fits: a shared scratch directory between a main container and a sidecar (as in [Pods](01-pods.md)'s log-shipper example), a local cache that's fine to lose, or temporary space for a data-processing step. `emptyDir` can optionally be backed by node memory (`emptyDir: {medium: Memory}`) for very fast, small, disposable data.

## hostPath: Mounting a Path from the Node Itself

A `hostPath` volume mounts a file or directory that already exists on the **node's own filesystem** into the Pod.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: node-log-reader
spec:
  containers:
    - name: reader
      image: busybox:1.36
      command: ["sh", "-c", "tail -F /host-logs/syslog"]
      volumeMounts:
        - name: host-logs
          mountPath: /host-logs
          readOnly: true
  volumes:
    - name: host-logs
      hostPath:
        path: /var/log
        type: Directory
```

`hostPath` ties a Pod to whatever happens to be on that specific node — data written there doesn't move with the Pod if it's rescheduled elsewhere, and two Pods on different nodes see two entirely different directories despite an identical manifest. It's appropriate for node-level agents (log collectors, monitoring daemons run via a DaemonSet) that are *meant* to read that specific node's files — not as a general-purpose way to persist application data.

## Why Neither of These Is "Real" Persistent Storage

| | emptyDir | hostPath | What you actually want for a database |
|---|---|---|---|
| Survives container restart | Yes | Yes | Yes |
| Survives Pod deletion/reschedule | No | No (data stays on the old node, not with the Pod) | Yes |
| Portable across nodes | N/A (per-Pod) | No — tied to one specific node | Yes |
| Backed by real block/network storage | No | No (just a node directory) | Yes |

For anything that must outlive the Pod and follow it across nodes — a database's data directory, user uploads, anything you can't afford to lose on a reschedule — you need a **PersistentVolume** and **PersistentVolumeClaim**, provisioned dynamically via a **StorageClass**. That's covered in full in [Storage](../storage/index.md), including access modes, reclaim policies, and CSI drivers.

## Common Mistakes

- Using `hostPath` for application data and being surprised it "disappears" after a reschedule — it didn't disappear, it stayed on the original node while the Pod moved to a different one.
- Assuming `emptyDir` survives a Pod being deleted and recreated (even with the exact same name) — it doesn't; a new Pod object always gets a fresh `emptyDir`.
- Reaching for `hostPath` as a shortcut to persistent storage in production instead of a proper PVC — it also has security implications, since it gives a Pod access to the underlying node's filesystem.

## Interview Questions

- Why are Kubernetes Pods ephemeral by design, and what does that force you to think about for stateful applications?
- What's the practical difference between `emptyDir` and `hostPath`?
- Why isn't `hostPath` an acceptable persistence strategy for a production database?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Jobs and CronJobs](08-jobs-and-cronjobs.md) for run-to-completion and scheduled workloads, or jump ahead to [Storage](../storage/index.md) for PersistentVolumes, PersistentVolumeClaims, and StorageClasses.
