---
title: "Scripting kubectl: jsonpath, jq, kubectl wait, and Idempotent Deploys"
icon: lucide/terminal
description: Write reliable Kubernetes automation scripts using kubectl -o json/jsonpath with jq, kubectl wait for real readiness gating, and idempotent apply patterns.
tags:
  - Kubernetes
  - CI/CD & GitOps
---

# Scripting and Automation with kubectl

## What You'll Learn

- How to extract exactly the data you need from `kubectl` with `-o json`/`-o jsonpath` and `jq`, instead of parsing table output
- How to use `kubectl wait` to gate a script on real readiness, not a guessed `sleep`
- How to write deploy scripts that are safely idempotent — runnable twice with the same result

## Why This Matters

Every pipeline in [CI/CD Pipelines for Kubernetes](01-cicd-pipelines-for-kubernetes.md) is only as reliable as the shell script underneath it. A script that parses `kubectl get pods` table output breaks the moment a column changes; a script that `sleep 30`s instead of actually checking readiness either wastes time or races ahead of a slow rollout. This chapter is about the difference between a script that happens to work and one that's actually safe to run unattended, repeatedly, in CI.

## Mental Model

Never parse `kubectl`'s human-readable table output in a script — it's not a stable interface and was never meant to be one. `kubectl` gives you two machine-readable escape hatches instead: `-o json` (full object, pipe to `jq` for anything complex) and `-o jsonpath` (a query language built into `kubectl` itself, faster for simple single-value lookups).

### jsonpath vs. json + jq

```bash
# jsonpath: fast, built-in, good for single scalar values
kubectl get deployment checkout-api -n production \
  -o jsonpath='{.status.readyReplicas}'

kubectl get pods -n production -l app=checkout-api \
  -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.phase}{"\n"}{end}'

# json + jq: better for filtering, joining fields, or anything with logic
kubectl get pods -n production -o json | \
  jq -r '.items[] | select(.status.phase == "Failed") | .metadata.name'

kubectl get pods --all-namespaces -o json | \
  jq -r '.items[] | select(.status.containerStatuses[]?.restartCount > 5) |
    "\(.metadata.namespace)/\(.metadata.name): \(.status.containerStatuses[0].restartCount) restarts"'
```

| | jsonpath | json + jq |
|---|---|---|
| Setup | Built into `kubectl`, nothing to install | Requires `jq` on the machine/image |
| Good at | One or two scalar fields, quick checks | Filtering, sorting, joining, arithmetic across items |
| Syntax | Terse, awkward past simple queries | Full query language, more readable for complex logic |

A practical rule: reach for `jsonpath` for a single value inline in a script; reach for `jq` the moment you need a `select()`, a loop, or to combine more than one field into readable output.

### kubectl wait: gating on real readiness

```bash
# Gate on a Deployment actually being available — not "the apply command returned"
kubectl apply -f checkout-api-deployment.yaml
kubectl wait --for=condition=Available deployment/checkout-api \
  -n production --timeout=120s

# Gate on a specific pod becoming Ready
kubectl wait --for=condition=Ready pod -l app=checkout-api \
  -n production --timeout=90s

# Gate on a Job finishing
kubectl wait --for=condition=Complete job/db-migration \
  -n production --timeout=300s

# Gate on a resource being deleted
kubectl delete pod stuck-pod -n production --wait=false
kubectl wait --for=delete pod/stuck-pod -n production --timeout=60s
```

`kubectl wait` blocks and returns a non-zero exit code on timeout — which is exactly what you want as a script's next line after `apply`, because it turns "the manifest was accepted" into "the manifest actually took effect," and it fails the script (and therefore the pipeline step) loudly if it doesn't.

!!! note "wait vs. rollout status"
    `kubectl rollout status` is purpose-built for Deployments/DaemonSets/StatefulSets and understands rollout semantics (surge, revision history) specifically. `kubectl wait --for=condition=...` is the general-purpose tool for any resource with a `status.conditions` field, including Pods, Jobs, and CRDs that define their own conditions. Use `rollout status` for rollouts; use `wait` for everything else.

### Writing an idempotent deploy script

Idempotent means: running the script twice in a row, with no changes in between, produces the same end state and doesn't error the second time.

```bash
#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-production}"
APP="${APP:-checkout-api}"
IMAGE="${IMAGE:?IMAGE must be set, e.g. registry.example.com/checkout-api:a1b2c3d}"
TIMEOUT="${TIMEOUT:-180s}"

# kubectl apply is inherently idempotent: creates if absent, patches if it
# differs, no-ops if identical. Prefer it over imperative `kubectl create`
# or `kubectl run`, which fail on the second run.
ensure_namespace() {
  kubectl get namespace "$NAMESPACE" >/dev/null 2>&1 || kubectl create namespace "$NAMESPACE"
}

apply_manifests() {
  # envsubst renders the image tag into the manifest without a templating engine
  envsubst < deploy/checkout-api.yaml.tmpl | kubectl apply -n "$NAMESPACE" -f -
}

wait_for_rollout() {
  if ! kubectl rollout status "deployment/${APP}" -n "$NAMESPACE" --timeout="$TIMEOUT"; then
    echo "Rollout failed or timed out — rolling back" >&2
    kubectl rollout undo "deployment/${APP}" -n "$NAMESPACE"
    kubectl rollout status "deployment/${APP}" -n "$NAMESPACE" --timeout="$TIMEOUT"
    exit 1
  fi
}

verify_ready_replicas() {
  local ready desired
  ready=$(kubectl get deployment "$APP" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')
  desired=$(kubectl get deployment "$APP" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
  if [[ "$ready" != "$desired" ]]; then
    echo "Only ${ready:-0}/${desired} replicas ready" >&2
    exit 1
  fi
  echo "All ${ready} replicas ready."
}

ensure_namespace
apply_manifests
wait_for_rollout
verify_ready_replicas
```

Three things make this idempotent rather than merely "worked once":

- `kubectl apply` instead of `kubectl create`/`kubectl run` — `apply` diffs against the live object and patches it, so a second run with an unchanged manifest is a safe no-op instead of an "already exists" error.
- `ensure_namespace` checks before creating, rather than assuming the namespace doesn't exist.
- `set -euo pipefail` plus explicit exit codes on failure — the script stops and signals failure clearly rather than continuing past a broken step.

## Common Mistakes

- Parsing `kubectl get pods` (table output) with `awk`/`grep` — column widths and formatting are not a stable API and will eventually break the script.
- Using `sleep 30` instead of `kubectl wait`/`rollout status` — either too short (races a slow rollout) or wastes CI minutes on a fast one.
- Using `kubectl create` in a redeploy script, which fails with `AlreadyExists` on every run after the first instead of behaving idempotently like `kubectl apply`.
- Forgetting `set -euo pipefail`, so a failed step partway through a script is silently ignored and later steps run against a broken state.
- Hardcoding namespace/image values instead of parameterizing them, making the same script unusable across dev/staging/production without editing it.

## Interview Questions

- When would you reach for `jsonpath` versus piping `-o json` into `jq`?
- What's the difference between `kubectl wait --for=condition=Ready` and `kubectl rollout status`, and when does each apply?
- Why is `kubectl apply` idempotent while `kubectl create` is not, and why does that matter for automation?
- Write a one-liner to find and delete all `Evicted` pods across every namespace.

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Progressive Delivery: Canary and Blue-Green](03-progressive-delivery-canary-and-blue-green.md) to see these same readiness-gating principles applied to automated, metric-driven rollouts.
