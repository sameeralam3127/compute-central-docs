---
title: "Kubernetes Troubleshooting Cheat Sheet: Symptom to Fix"
icon: lucide/search
description: A fast lookup table mapping Kubernetes symptoms to the first diagnostic command and likely fix, linking to the full troubleshooting guide.
tags:
  - Kubernetes
  - Quick Reference
  - Troubleshooting
---

# Troubleshooting Cheat Sheet

A fast first-command lookup. For the full diagnosis, causes, and fix per symptom, see [Troubleshooting](../troubleshooting/index.md).

## Pods

| Symptom | First command | Likely fix |
|---|---|---|
| `Pending` | `kubectl describe pod <name>` | Lower requests, add capacity, fix taint/toleration or nodeSelector — [details](../troubleshooting/01-pod-scheduling-and-startup-problems.md#pod-stuck-in-pending) |
| `ImagePullBackOff` / `ErrImagePull` | `kubectl describe pod <name>` | Fix image tag, add `imagePullSecrets` — [details](../troubleshooting/01-pod-scheduling-and-startup-problems.md#imagepullbackoff-errimagepull) |
| `CrashLoopBackOff` | `kubectl logs <name> --previous` | Fix app config, tune/add `startupProbe` — [details](../troubleshooting/01-pod-scheduling-and-startup-problems.md#crashloopbackoff) |
| `OOMKilled` | `kubectl top pod <name>` | Raise `resources.limits.memory` or fix the leak — [details](../troubleshooting/01-pod-scheduling-and-startup-problems.md#oomkilled) |
| `Init:CrashLoopBackOff` | `kubectl logs <name> -c <init-container>` | Fix the init container's command/dependency wait — [details](../troubleshooting/01-pod-scheduling-and-startup-problems.md#init-container-failures-blocking-the-main-container) |

## Networking

| Symptom | First command | Likely fix |
|---|---|---|
| Service unreachable | `kubectl get endpoints <svc>` | Fix selector/label mismatch or readiness probe — [details](../troubleshooting/02-networking-and-service-problems.md#service-has-no-endpoints) |
| DNS lookup fails in pod | `kubectl get pods -n kube-system -l k8s-app=kube-dns` | Restart CoreDNS, use FQDN across namespaces — [details](../troubleshooting/02-networking-and-service-problems.md#dns-resolution-failures-inside-pods) |
| Ingress `404` | `kubectl describe ingress <name>` | Set `ingressClassName`, fix host/path rule — [details](../troubleshooting/02-networking-and-service-problems.md#ingress-returning-404-502-or-503) |
| Ingress `502`/`503` | `kubectl get endpoints <backend-svc>` | Confirm backend has ready endpoints — [details](../troubleshooting/02-networking-and-service-problems.md#ingress-returning-404-502-or-503) |
| Connection times out, no error | `kubectl get networkpolicy -n <ns>` | Add matching `allow` rule — [details](../troubleshooting/02-networking-and-service-problems.md#traffic-silently-dropped-by-a-networkpolicy) |

## Storage

| Symptom | First command | Likely fix |
|---|---|---|
| PVC `Pending` | `kubectl describe pvc <name>` | Set/fix `storageClassName`, check provisioner — [details](../troubleshooting/03-storage-problems.md#pvc-stuck-in-pending) |
| `FailedMount` | `kubectl describe pod <name>` | Delete stale pod holding a `ReadWriteOnce` volume — [details](../troubleshooting/03-storage-problems.md#volume-mount-failures) |
| `EACCES` inside container | `kubectl exec <name> -- id` | Set `fsGroup`/`runAsUser` to match volume ownership — [details](../troubleshooting/03-storage-problems.md#permission-denied-inside-the-container) |

## Cluster and Nodes

| Symptom | First command | Likely fix |
|---|---|---|
| Node `NotReady` | `kubectl describe node <name>` | Restart kubelet, check CNI pod on that node — [details](../troubleshooting/04-cluster-and-node-problems.md#node-notready) |
| Pods `Evicted` | `kubectl get events -A --field-selector reason=Evicted` | Reclaim disk, set resource requests cluster-wide — [details](../troubleshooting/04-cluster-and-node-problems.md#diskpressure-and-memorypressure-evictions) |
| `kubectl` slow/timing out cluster-wide | `kubectl get --raw /healthz` | Check etcd/apiserver health — [details](../troubleshooting/04-cluster-and-node-problems.md#control-plane-component-failures) |

## Rollouts

| Symptom | First command | Likely fix |
|---|---|---|
| Rollout hanging | `kubectl rollout status deployment/<name>` | Check new pod's readiness probe, or `kubectl rollout undo` |
| Need to revert | `kubectl rollout history deployment/<name>` | `kubectl rollout undo deployment/<name> --to-revision=<n>` |

## Related

[Full Troubleshooting Guide](../troubleshooting/index.md) · [kubectl Cheat Sheet](01-kubectl-cheat-sheet.md)
