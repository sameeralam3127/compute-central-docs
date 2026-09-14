---
title: "Container and IaC Scanning: Trivy, Checkov, Hadolint, Conftest"
icon: lucide/scan-search
description: "Scan images, Dockerfiles, Terraform, and Kubernetes manifests with Trivy, Checkov, Hadolint, and Conftest, with CI integration and triage."
tags:
  - Security
  - Scanning
  - Policy as Code
---

# Container and IaC Scanning

## What You'll Learn

- What container image and infrastructure-as-code scanners find, and their limits
- How to scan images, filesystems, Dockerfiles, Terraform, and Kubernetes manifests with Trivy, Checkov, and Hadolint
- How to write custom policies with Conftest and Rego
- How to run scanners in CI without drowning teams in findings, and how to triage what they report

## What Scanners Find

| Scanner type | Finds | Example tools |
|---|---|---|
| **Image vulnerability scanning** | Known CVEs in OS packages and language dependencies inside an image | Trivy, Grype, Amazon Inspector, Docker Scout |
| **Secret scanning** | Keys, tokens, and passwords in files and image layers | Trivy, Gitleaks |
| **Dockerfile linting** | Insecure or fragile build instructions | Hadolint, Trivy config |
| **IaC misconfiguration** | Public buckets, open security groups, unencrypted storage, missing logging | Checkov, Trivy config |
| **Kubernetes manifest checks** | Privileged containers, missing limits, host mounts | Trivy config, Checkov, kube-linter, Conftest |
| **Custom policy** | Your organization's own rules | Conftest (OPA/Rego), Kyverno CLI |

Scanners find **known** issues and **pattern-based** misconfigurations. They don't find logic flaws, broken authorization, or zero-day vulnerabilities — which is why [threat modeling](01-devsecops-and-threat-modeling.md) and runtime controls still matter.

## Trivy

[Trivy](https://trivy.dev/) scans images, filesystems, repositories, SBOMs, IaC, and Kubernetes clusters with one binary.

```bash
# macOS: brew install trivy   — Linux: see the Trivy installation docs
trivy --version
```

### Images

```bash
trivy image ghcr.io/acme/orders-api:3f9c2d1

# Fail the build only for fixable high and critical issues
trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 ghcr.io/acme/orders-api:3f9c2d1

# Vulnerabilities and embedded secrets
trivy image --scanners vuln,secret ghcr.io/acme/orders-api:3f9c2d1
```

```text
ghcr.io/acme/orders-api:3f9c2d1 (debian 12.11)
Total: 2 (HIGH: 1, CRITICAL: 1)

┌──────────────┬────────────────┬──────────┬───────────────────┬───────────────┬──────────────────────────────┐
│   Library    │ Vulnerability  │ Severity │ Installed Version │ Fixed Version │            Title             │
├──────────────┼────────────────┼──────────┼───────────────────┼───────────────┼──────────────────────────────┤
│ libssl3      │ CVE-2026-XXXXX │ CRITICAL │ 3.0.16-1          │ 3.0.17-1      │ openssl: ...                 │
│ requests     │ CVE-2026-YYYYY │ HIGH     │ 2.31.0            │ 2.32.4        │ requests: ...                │
└──────────────┴────────────────┴──────────┴───────────────────┴───────────────┴──────────────────────────────┘
```

### Source, Dockerfiles, and IaC

```bash
trivy fs --scanners vuln,secret,misconfig .        # dependencies, secrets, and config in a repo
trivy config ./terraform                           # Terraform misconfigurations
trivy config ./k8s                                 # Kubernetes manifests and Helm charts
trivy config Dockerfile
```

Trivy's IaC checks absorbed the former tfsec project, so there's no need to run both.

## Checkov

[Checkov](https://www.checkov.io/) has a large policy library for Terraform, CloudFormation, Kubernetes, Helm, Dockerfiles, and CI configuration, and can scan Terraform plans for resolved values.

```bash
pipx install checkov
checkov -d terraform/ --framework terraform --compact --quiet

# Scan a plan, so module outputs and variables are resolved
terraform plan -out tfplan && terraform show -json tfplan > tfplan.json
checkov -f tfplan.json --framework terraform_plan
```

```text
Check: CKV_AWS_18: "Ensure the S3 bucket has access logging enabled"
	FAILED for resource: aws_s3_bucket.exports
	File: /storage.tf:1-4
```

Suppress a check deliberately, next to the resource, with a reason:

```hcl
resource "aws_s3_bucket" "access_logs" {
  #checkov:skip=CKV_AWS_18:This bucket receives access logs; logging it to itself would loop
  bucket = "acme-access-logs-111111111111"
}
```

Trivy and Checkov overlap heavily. Pick one as the standard for IaC, so developers see one set of rule IDs and suppressions.

## Hadolint

```bash
hadolint Dockerfile
```

```text
Dockerfile:3 DL3007 warning: Using latest is prone to errors if the image will ever update. Pin the version explicitly
Dockerfile:7 DL3008 warning: Pin versions in apt get install
Dockerfile:12 DL3002 warning: Last USER should not be root
```

```yaml title=".hadolint.yaml"
failure-threshold: warning
ignored:
  - DL3008          # apt version pinning — we rebuild weekly from a pinned base image digest instead
trustedRegistries:
  - ghcr.io
  - public.ecr.aws
```

Hadolint also runs ShellCheck on `RUN` instructions. See [Dockerfiles](../docker/17-dockerfiles.md) for secure image patterns.

## Custom Policies With Conftest

Built-in rules cover common issues. Your organization also has its own rules: required labels, allowed registries, mandatory tags, approved instance sizes. [Conftest](https://www.conftest.dev/) tests structured files against policies written in Rego.

```rego title="policy/kubernetes.rego"
package main

import rego.v1

deny contains msg if {
	input.kind == "Deployment"
	some container in input.spec.template.spec.containers
	not startswith(container.image, "ghcr.io/acme/")
	msg := sprintf("container %q uses image %q from an unapproved registry", [container.name, container.image])
}

deny contains msg if {
	input.kind == "Deployment"
	some container in input.spec.template.spec.containers
	not container.resources.limits.memory
	msg := sprintf("container %q must set a memory limit", [container.name])
}

warn contains msg if {
	input.kind == "Deployment"
	not input.metadata.labels["app.kubernetes.io/owner"]
	msg := "Deployment should have an app.kubernetes.io/owner label"
}
```

```bash
conftest test k8s/deployment.yaml
helm template charts/orders-api | conftest test -          # rendered Helm output
conftest test --policy policy/terraform tfplan.json         # Terraform plan JSON
conftest verify --policy policy/                            # run unit tests for the policies
```

```text
FAIL - k8s/deployment.yaml - main - container "app" uses image "docker.io/library/nginx:1.27" from an unapproved registry
WARN - k8s/deployment.yaml - main - Deployment should have an app.kubernetes.io/owner label

2 tests, 0 passed, 1 warning, 1 failure, 0 exceptions
```

The same Rego can be enforced at admission time with OPA Gatekeeper, so CI and the cluster apply identical rules. Kyverno users can do the same with `kyverno apply` in CI.

## Running Scanners in CI

```yaml title=".github/workflows/security.yml"
name: Security scans
on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: "0 5 * * *"       # re-scan daily: new CVEs are published against old images

permissions:
  contents: read

jobs:
  iac-and-config:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write   # upload SARIF to code scanning
    steps:
      - uses: actions/checkout@v7

      - name: Trivy config and secret scan
        uses: aquasecurity/trivy-action@v0.36.0
        with:
          scan-type: fs
          scanners: misconfig,secret
          severity: HIGH,CRITICAL
          format: sarif
          output: trivy-config.sarif

      - uses: github/codeql-action/upload-sarif@v4
        if: always()
        with:
          sarif_file: trivy-config.sarif
          category: trivy-config

      - name: Conftest policies
        run: |
          curl -sSL https://github.com/open-policy-agent/conftest/releases/download/v0.70.0/conftest_0.70.0_Linux_x86_64.tar.gz | tar xz conftest
          ./conftest test k8s/ --policy policy/

  image:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: Build
        run: docker build -t orders-api:${{ github.sha }} .
      - name: Trivy image scan
        uses: aquasecurity/trivy-action@v0.36.0
        with:
          image-ref: orders-api:${{ github.sha }}
          severity: HIGH,CRITICAL
          ignore-unfixed: true
          exit-code: "1"
```

Uploading SARIF shows findings inline on pull requests and in the repository's security tab, instead of buried in logs.

## Rolling Out Without Revolt

Turning on every scanner with blocking thresholds on an existing codebase produces thousands of findings and teams that disable the checks. Instead:

1. **Run in report-only mode** and measure the baseline.
2. **Block only new findings** of high severity in changed files or new images.
3. **Fix or suppress the existing backlog** over time, starting with internet-facing and production systems.
4. **Tighten thresholds** gradually as the backlog shrinks.
5. **Rescan what's already deployed** on a schedule — an image that was clean last month may have critical CVEs today.

## Triage: Not Every CVE Is Urgent

Severity alone is a poor priority signal. Consider:

| Factor | Question |
|---|---|
| **Exploited in the wild?** | Is it in CISA's Known Exploited Vulnerabilities catalog? |
| **Likelihood** | What's its EPSS score — the estimated probability of exploitation? |
| **Reachability** | Is the vulnerable package or function actually used at runtime, or just present in the image? |
| **Exposure** | Is the workload internet-facing, or isolated with no untrusted input? |
| **Fix available** | Is there a patched version? Can a base image rebuild pick it up? |

Document decisions not to fix with an expiry date:

```text title=".trivyignore"
# Not reachable: the vulnerable XML parser is only used by a test dependency — review by 2026-12-01
CVE-2026-ZZZZZ
```

Formal **VEX** (Vulnerability Exploitability eXchange) documents record the same kind of decision in a machine-readable format that scanners can consume.

## Common Mistakes

- Blocking every build on all findings from day one, until teams disable scanning entirely.
- Scanning images only at build time, and never rescanning what's running.
- Running both Trivy and Checkov with different rule IDs and suppression syntaxes, confusing developers.
- Blanket suppressions with no reason and no expiry.
- Prioritizing by CVSS severity alone, ignoring exploitation, reachability, and exposure.
- Treating a clean scan as proof of security — scanners don't find logic flaws or authorization bugs.

## Interview Questions

- What kinds of issues can image and IaC scanners find, and what can't they find?
- How would you introduce vulnerability scanning to a large existing codebase without blocking every team?
- How do you decide which vulnerabilities to fix first?
- Write a policy that rejects Kubernetes Deployments using images from unapproved registries.
- Why rescan images that are already deployed?

## Next

Continue to [Identity and Zero Trust](05-identity-and-zero-trust.md).
