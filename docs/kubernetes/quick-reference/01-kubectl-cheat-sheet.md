---
title: "kubectl Cheat Sheet: Commands, Flags, and Contexts"
icon: lucide/terminal
description: A pure kubectl command reference — cluster info, resource CRUD, debugging, rollout management, and context/namespace switching.
tags:
  - Kubernetes
  - Quick Reference
---

# kubectl Cheat Sheet

## Cluster Info

```bash
kubectl cluster-info
kubectl version
kubectl get nodes
kubectl get nodes -o wide
kubectl describe node <node-name>
kubectl top nodes
kubectl get --raw /healthz
kubectl get --raw /readyz
```

## Working with Resources

```bash
# Get
kubectl get pods                          # current namespace
kubectl get pods -A                       # all namespaces
kubectl get pods -n <namespace>
kubectl get pods -o wide                  # + node, IP
kubectl get pods --show-labels
kubectl get pods -l app=nginx
kubectl get all -n <namespace>

# Describe
kubectl describe pod <name>
kubectl describe deployment <name>
kubectl describe svc <name>

# Apply / create
kubectl apply -f manifest.yaml
kubectl apply -f directory/
kubectl create deployment nginx --image=nginx:1.27.1 --replicas=3
kubectl create namespace <name>

# Edit / scale
kubectl edit deployment <name>
kubectl scale deployment <name> --replicas=5
kubectl set image deployment/<name> <container>=<image>:<tag>
kubectl set resources deployment <name> --requests=cpu=250m,memory=256Mi --limits=cpu=500m,memory=512Mi

# Delete
kubectl delete pod <name>
kubectl delete -f manifest.yaml
kubectl delete deployment <name>
kubectl delete pods -l app=nginx
```

| Flag | Purpose |
|---|---|
| `--dry-run=client` | Validate/render locally without sending to the API server |
| `--dry-run=server` | Validate against the live API server without persisting |
| `-o yaml` / `-o json` | Full object output |
| `-o wide` | Extra columns (node, IP) |
| `-o jsonpath='{...}'` | Extract specific fields |
| `--field-selector` | Filter by a field, e.g. `status.phase!=Running` |
| `-w` | Watch for changes |

## Debugging

```bash
# Logs
kubectl logs <pod>
kubectl logs <pod> -f                     # follow
kubectl logs <pod> --previous             # last crashed container
kubectl logs <pod> -c <container>
kubectl logs -l app=nginx --tail=100

# Exec
kubectl exec <pod> -- <command>
kubectl exec -it <pod> -- /bin/bash
kubectl exec <pod> -c <container> -- env

# Port-forward
kubectl port-forward pod/<pod> 8080:80
kubectl port-forward service/<service> 8080:80

# Copy files
kubectl cp <pod>:/path/to/file ./local-file
kubectl cp ./local-file <pod>:/path/to/file

# Ephemeral debug container (v1.25+ stable)
kubectl debug <pod> -it --image=busybox:1.36.1
kubectl run debug --rm -it --image=nicolaka/netshoot:v0.13 -- bash

# Events
kubectl get events --sort-by=.metadata.creationTimestamp
kubectl get events -A --sort-by=.metadata.creationTimestamp
kubectl get events -w
```

## Rollout Management

```bash
kubectl rollout status deployment/<name>
kubectl rollout history deployment/<name>
kubectl rollout undo deployment/<name>
kubectl rollout undo deployment/<name> --to-revision=2
kubectl rollout restart deployment/<name>
kubectl rollout pause deployment/<name>
kubectl rollout resume deployment/<name>
```

## Contexts and Namespaces

```bash
kubectl config get-contexts
kubectl config current-context
kubectl config use-context <context-name>
kubectl config set-context --current --namespace=<namespace>
kubectl config view --minify
```

## Resource Usage and Autoscaling

```bash
kubectl top pods
kubectl top pods -n <namespace> --sort-by=memory
kubectl top pods --all-namespaces --sort-by=cpu
kubectl autoscale deployment <name> --min=2 --max=10 --cpu-percent=70
kubectl get hpa
```

## Useful One-Liners

```bash
# Pods sorted by restart count
kubectl get pods --sort-by='.status.containerStatuses[0].restartCount'

# Pods not Running
kubectl get pods --field-selector=status.phase!=Running -A

# Delete all evicted pods
kubectl get pods -A -o json | jq -r '.items[] | select(.status.reason=="Evicted") | "kubectl delete pod \(.metadata.name) -n \(.metadata.namespace)"' | sh

# Every image running in the cluster
kubectl get pods -A -o jsonpath="{.items[*].spec.containers[*].image}" | tr -s '[[:space:]]' '\n' | sort -u

# Custom columns
kubectl get pods -o custom-columns=NAME:.metadata.name,STATUS:.status.phase,NODE:.spec.nodeName
```

## Related

[Troubleshooting Cheat Sheet](04-troubleshooting-cheat-sheet.md) · [YAML Cheat Sheet](02-yaml-cheat-sheet.md)
