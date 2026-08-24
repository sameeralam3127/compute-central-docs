---
title: "Fix Kubernetes PVC Pending and Volume Mount Errors"
icon: lucide/hard-drive
description: Diagnosing PVCs stuck Pending, volume mount failures, and permission-denied errors caused by fsGroup and runAsUser mismatches.
tags:
  - Kubernetes
  - Troubleshooting
  - Storage
---

# Storage Problems

Storage failures fall into three layers: the claim never gets a volume in the first place, the volume exists but can't be attached to the node the pod landed on, or the volume mounts fine but the container can't actually write to it. Identify which layer you're in before changing YAML.

## PVC Stuck in `Pending`

```bash
kubectl get pvc myapp-pvc
# NAME        STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   AGE
# myapp-pvc   Pending                                       fast-ssd       5m
```

A `Pending` PVC has no bound `PersistentVolume` — any pod referencing it will itself be stuck `Pending` (see [Pod Scheduling and Startup Problems](01-pod-scheduling-and-startup-problems.md)).

**Likely causes:**

1. The `storageClassName` on the PVC doesn't match any `StorageClass` that actually exists in the cluster.
2. No default `StorageClass` is set, the PVC didn't specify one, and dynamic provisioning never triggers.
3. The provisioner behind the `StorageClass` is failing (cloud API quota, permissions, or a broken CSI driver pod).

**Diagnosis:**

```bash
kubectl describe pvc myapp-pvc                      # Events show the exact provisioning failure
kubectl get storageclass                             # look for (default) next to one entry
kubectl get pv                                       # any Available PVs matching the request?
kubectl get pods -n kube-system | grep -i csi        # is the provisioner pod even running?
```

**Fix:**

```bash
# No default StorageClass — set one
kubectl patch storageclass standard -p \
  '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'

# Or specify the correct class explicitly on the PVC
kubectl patch pvc myapp-pvc -p '{"spec":{"storageClassName":"fast-ssd"}}'
```

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: myapp-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: fast-ssd
```

**Prevention:** confirm the `StorageClass` name in every environment before deploying — `fast-ssd` on one cluster is not guaranteed to exist on another — and watch CSI driver pods the same way you watch application pods.

## Volume Mount Failures

```text
Warning  FailedMount  2m  kubelet  Unable to attach or mount volumes: unmounted volumes=[data]
```

**Likely causes:**

1. The PVC has `ReadWriteOnce` access mode and is already mounted, read-write, by a pod on a different node.
2. The volume is mid-detach from a pod that was just deleted, and the new pod is racing it.
3. The volume type genuinely isn't supported in the mode requested (for example, requesting `ReadWriteMany` on a block-storage-backed `StorageClass` that only supports `ReadWriteOnce`).

**Diagnosis:**

```bash
kubectl describe pod myapp-5d4b8c7f9-abc12 | grep -A5 Events

# Find every pod currently referencing the PVC
kubectl get pods -A -o json | jq -r '
  .items[] | select(.spec.volumes[]?.persistentVolumeClaim.claimName=="myapp-pvc") |
  "\(.metadata.namespace)/\(.metadata.name)"'
```

**Fix:**

```bash
# Old pod still holding a ReadWriteOnce volume — remove it before the new one can mount
kubectl delete pod old-pod-name --grace-period=30
```

**Prevention:** for anything that needs true multi-node concurrent access, provision the PVC with `ReadWriteMany` from a backend that actually supports it (NFS, EFS, Filestore) rather than assuming `ReadWriteOnce` will scale to multiple nodes.

## Permission Denied Inside the Container

```text
$ kubectl logs myapp-5d4b8c7f9-abc12
Error: EACCES: permission denied, open '/data/app.log'
```

The volume mounted successfully — this is a UID/GID mismatch between the process inside the container and the ownership of the mounted volume, not a Kubernetes-level storage failure.

**Likely causes:**

1. The container runs as a non-root UID (correctly, per security best practice) but the pod spec never sets `fsGroup`, so the mounted volume keeps its default ownership.
2. `runAsUser` and the volume's actual on-disk ownership don't agree, and the storage backend doesn't honor `fsGroup` (some CSI drivers/NFS configurations don't).

**Diagnosis:**

```bash
kubectl get pod myapp-5d4b8c7f9-abc12 -o jsonpath='{.spec.securityContext}{"\n"}'
kubectl exec myapp-5d4b8c7f9-abc12 -- id
kubectl exec myapp-5d4b8c7f9-abc12 -- ls -ln /data
```

**Fix:**

```yaml
spec:
  securityContext:
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000          # kubelet chowns/chgrps the volume to this group on mount
  containers:
    - name: myapp
      image: myapp:1.4.2
      volumeMounts:
        - name: data
          mountPath: /data
```

**Prevention:** set `fsGroup` any time a non-root container writes to a mounted volume, and confirm the storage backend actually applies it — NFS in particular sometimes requires the export itself to be configured for the expected UID/GID instead.

## Quick Reference

| Symptom | Layer | Fix starting point |
|---|---|---|
| PVC `Pending` | Provisioning | `kubectl describe pvc`, check `StorageClass` exists and has a default |
| `FailedMount` events | Attach/detach | Find and remove the old pod holding a `ReadWriteOnce` volume |
| `EACCES` inside container | UID/GID ownership | Set `fsGroup`/`runAsUser`, confirm backend honors it |

## Interview Questions

- A PVC is stuck `Pending` — what's your diagnostic order, and how do you tell "no StorageClass" apart from "provisioner is broken"?
- Why can a `ReadWriteOnce` volume cause a rollout to hang, and how would you fix it without downtime?
- The application logs `EACCES` on a path that's clearly mounted — what's actually wrong, and which field fixes it?

## Next

Continue to [Cluster and Node Problems](04-cluster-and-node-problems.md).
