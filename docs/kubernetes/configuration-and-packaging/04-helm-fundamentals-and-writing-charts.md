---
title: "Helm Fundamentals: Install Helm and Write a Chart"
icon: lucide/package
description: Installing Helm, the core repo/install/upgrade/rollback workflow, chart anatomy, and writing a minimal Helm chart from scratch with a real example.
tags:
  - Kubernetes
  - Configuration & Packaging
---

# Helm Fundamentals and Writing Charts

## What You'll Learn

- The core Helm workflow — `repo add`, `install`, `upgrade`, `rollback` — and what each actually does to the cluster
- Chart anatomy: `Chart.yaml`, `values.yaml`, `templates/`, and `_helpers.tpl`
- How to write a small, real chart from scratch instead of only consuming third-party ones

## Why This Matters

Hand-applying YAML works until you need the same application deployed to five environments with different replica counts, image tags, and resource limits — at that point you're either maintaining five near-duplicate manifest sets, or you're templating. Helm is the most widely adopted templating and release-management tool in the Kubernetes ecosystem: it turns a directory of parameterized templates into a versioned, installable, upgradable, rollback-able **release**.

## Mental Model

> A **chart** is a template plus a schema for its inputs (`values.yaml`). A **release** is one specific instance of a chart, installed into a cluster with a specific set of values, tracked by name so it can be upgraded or rolled back as a unit — Helm keeps a revision history of every release, not just its current state.

| Term | Meaning |
|---|---|
| **Chart** | A packaged, versioned collection of Kubernetes manifest templates plus default values |
| **Release** | One installed instance of a chart in a cluster, identified by a release name |
| **Repository** | A location (usually an HTTP index) that hosts one or more charts for `helm install` to pull from |
| **Values** | The input data merged into a chart's templates — from `values.yaml`, `-f`, or `--set` |

## How It Works

### Installing Helm

```bash
brew install helm                 # macOS / Linux with Homebrew
sudo snap install helm --classic  # Ubuntu
winget install Helm.Helm          # Windows
helm version
```

The [official install page](https://helm.sh/docs/intro/install/) also lists a verified install script and signed binaries. In CI, pin an exact Helm version rather than installing "latest".

!!! note "Helm 4"
    Helm 4 was released in November 2025, the first major version since Helm 3 in 2019. Existing charts (`apiVersion: v2`) keep working. The changes you'll notice: installs use Kubernetes **server-side apply**, `--wait` uses a more accurate readiness check, a new plugin system replaces the old one, and a few CLI flags were renamed. Helm 3 receives only security fixes during its wind-down, so plan the upgrade, and test CI pipelines against Helm 4 before switching.

### The core workflow

```bash
# Add a repository and refresh its index
helm repo add traefik https://traefik.github.io/charts
helm repo update

# Install a chart as a named release (pin --version to a chart version from `helm search repo traefik/traefik --versions`)
helm install my-ingress traefik/traefik \
  --namespace traefik --create-namespace

# Inspect what's installed
helm list -A
helm status my-ingress -n traefik

# Upgrade with new values (creates a new revision)
helm upgrade my-ingress traefik/traefik \
  --namespace traefik \
  --set deployment.replicas=3

# Roll back to the previous revision if the upgrade broke something
helm rollback my-ingress -n traefik

# Preview what a change would render, without applying it
helm diff upgrade my-ingress traefik/traefik -n traefik --set deployment.replicas=5   # requires the helm-diff plugin
helm template my-ingress traefik/traefik --set deployment.replicas=5
```

### Charts from OCI registries

Most charts are now published to OCI registries (the same registries that store container images), not classic `index.yaml` repositories. There's no `helm repo add`; you reference the chart directly:

```bash
helm install cert-manager oci://quay.io/jetstack/charts/cert-manager \
  --version v1.18.2 --namespace cert-manager --create-namespace --set crds.enabled=true

helm package ./orders-api                                   # -> orders-api-0.1.0.tgz
helm push orders-api-0.1.0.tgz oci://registry.example.com/charts
```

Publishing your own charts to the registry you already use for images (ECR, Artifact Registry, Harbor, GHCR) avoids running a separate chart repository.

`helm rollback` works because every `helm upgrade` is stored as a new numbered revision (visible via `helm history my-ingress -n traefik`) — rolling back re-applies a prior revision's fully rendered manifests, it doesn't try to compute a reverse diff.

### Chart anatomy

```
my-chart/
├── Chart.yaml          # chart metadata: name, version, appVersion
├── values.yaml          # default values consumed by templates
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   ├── _helpers.tpl     # reusable named template snippets (not rendered to a manifest itself)
│   └── NOTES.txt         # printed to the user after install/upgrade
└── charts/               # bundled sub-charts / dependencies
```

- **`Chart.yaml`** — identifies the chart itself: its own `version` (SemVer, bumped every time the chart changes) and `appVersion` (the version of the application it deploys — these are independent numbers).
- **`values.yaml`** — the default input data. Anything a user might want to override per environment belongs here, not hardcoded in a template.
- **`templates/`** — Go templates that render to Kubernetes manifests. Any file here that doesn't start with `_` is expected to render to one or more YAML documents.
- **`_helpers.tpl`** — holds `{{- define "name" -}}` blocks: reusable snippets (standard labels, a computed fullname) referenced from multiple templates with `{{ include "my-chart.fullname" . }}`.

### Writing a minimal chart from scratch

```yaml
# Chart.yaml
apiVersion: v2
name: orders-api
description: A minimal chart for the orders-api service
type: application
version: 0.1.0
appVersion: "2.4.0"
```

```yaml
# values.yaml
replicaCount: 2

image:
  repository: registry.example.com/orders-api
  tag: "2.4.0"

service:
  port: 80

resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

```yaml
# templates/_helpers.tpl
{{- define "orders-api.fullname" -}}
{{ .Release.Name }}-{{ .Chart.Name }}
{{- end -}}

{{- define "orders-api.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion }}
{{- end -}}
```

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "orders-api.fullname" . }}
  labels:
    {{- include "orders-api.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app.kubernetes.io/name: {{ .Chart.Name }}
      app.kubernetes.io/instance: {{ .Release.Name }}
  template:
    metadata:
      labels:
        app.kubernetes.io/name: {{ .Chart.Name }}
        app.kubernetes.io/instance: {{ .Release.Name }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          ports:
            - containerPort: 8080
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
```

```yaml
# templates/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ include "orders-api.fullname" . }}
spec:
  selector:
    app.kubernetes.io/name: {{ .Chart.Name }}
    app.kubernetes.io/instance: {{ .Release.Name }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: 8080
```

```bash
# Render locally without installing, to sanity-check the templates
helm template orders-api ./orders-api --values ./orders-api/values.yaml

# Lint for common mistakes before installing
helm lint ./orders-api

# Install for real
helm install orders-api-staging ./orders-api \
  --namespace staging --create-namespace \
  --set replicaCount=1 --set image.tag=2.4.0-rc1
```

## Common Mistakes

- Hardcoding values directly in `templates/` instead of exposing them through `values.yaml` — it defeats the point of a reusable chart.
- Confusing a chart's `version` (the chart's own release number) with `appVersion` (the application's version) — they change independently and mean different things.
- Skipping `helm template` / `helm lint` before `helm install`, and finding out about a templating typo only after it half-applies to the cluster.
- Treating `helm upgrade --install` casually in CI without pinning `--version` on third-party charts — an untagged `helm repo update` right before install can silently pull in a newer, behaviorally different chart version.
- Letting a failed `helm upgrade` in CI leave a release half-applied. Use `--wait` with a `--timeout`, plus automatic rollback on failure (`--atomic` in Helm 3, `--rollback-on-failure` in Helm 4), so a failed deploy reverts itself.
- Putting secrets in `values.yaml` or `--set`. Helm stores every revision's values in a Secret in the cluster, and they end up in CI logs. Reference an existing Secret (or use External Secrets) instead.

## Interview Questions

- What's the difference between a Helm chart, a release, and a revision?
- How does `helm rollback` actually work under the hood — is it a computed reverse diff, or something else?
- What's the difference between a chart's `version` and `appVersion` fields in `Chart.yaml`?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Kustomize](05-kustomize.md) to see the template-free alternative to Helm, and when the two are used together.
