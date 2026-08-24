---
title: "Kubernetes Resource Units, Ports, and Pod Lifecycle Cheat Sheet"
icon: lucide/ruler
description: CPU and memory unit reference, well-known Kubernetes and common service ports, and the pod lifecycle phases table.
tags:
  - Kubernetes
  - Quick Reference
---

# Resource Units, Ports, and Pod Lifecycle Cheat Sheet

## CPU Units

| Notation | Value |
|---|---|
| `1` | 1 vCPU / core |
| `1000m` | 1 vCPU / core (millicores) |
| `500m` | 0.5 CPU |
| `250m` | 0.25 CPU |
| `100m` | 0.1 CPU |

## Memory Units

| Suffix | Base | Example |
|---|---|---|
| `Ki` | 1024 bytes | `256Ki` |
| `Mi` | 1024 Ki | `512Mi` |
| `Gi` | 1024 Mi | `2Gi` |
| `K` | 1000 bytes | `256K` |
| `M` | 1000 K | `512M` |
| `G` | 1000 M | `2G` |

`Mi`/`Gi` (binary, 1024-based) are the conventional choice for Kubernetes manifests; `M`/`G` (decimal, 1000-based) appear but mean a slightly smaller amount for the same number.

## Well-Known Kubernetes Ports

| Port | Component |
|---|---|
| `6443` | kube-apiserver |
| `2379-2380` | etcd client/peer |
| `10250` | kubelet API |
| `10257` | kube-controller-manager |
| `10259` | kube-scheduler |
| `10256` | kube-proxy health check |
| `30000-32767` | NodePort range |

## Common Application Ports

| Port | Service |
|---|---|
| `80` | HTTP |
| `443` | HTTPS |
| `5432` | PostgreSQL |
| `3306` | MySQL/MariaDB |
| `6379` | Redis |
| `27017` | MongoDB |
| `9090` | Prometheus |
| `3000` | Grafana (default) |

## Pod Lifecycle Phases

| Phase | Meaning |
|---|---|
| `Pending` | Accepted by the API server, not yet scheduled or still pulling images |
| `Running` | Bound to a node, at least one container running |
| `Succeeded` | All containers terminated with exit code `0` |
| `Failed` | All containers terminated, at least one with a non-zero exit code |
| `Unknown` | State can't be determined, usually a lost connection to the node |

## Container States

| State | Meaning |
|---|---|
| `Waiting` | Not running yet — pulling image, waiting on init containers |
| `Running` | Executing normally |
| `Terminated` | Finished (success or failure) — check `reason` and `exitCode` |

## Common Exit Codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | General application error |
| `126` | Command found but not executable |
| `127` | Command not found |
| `137` | `SIGKILL` — often OOM (128 + 9) |
| `143` | `SIGTERM` — graceful shutdown signal received (128 + 15) |

## Storage Access Modes

| Mode | Meaning |
|---|---|
| `ReadWriteOnce` (RWO) | One node, read-write |
| `ReadOnlyMany` (ROX) | Many nodes, read-only |
| `ReadWriteMany` (RWX) | Many nodes, read-write |
| `ReadWriteOncePod` (RWOP) | One *pod*, read-write (v1.29+ stable) |

## Related

[YAML Cheat Sheet](02-yaml-cheat-sheet.md) · [Troubleshooting Cheat Sheet](04-troubleshooting-cheat-sheet.md)

---

Return to [Quick Reference](index.md). You've reached the end of the Kubernetes guide — jump back to the [Kubernetes overview](../index.md).
