---
title: "Kubernetes Security and RBAC Interview Questions"
icon: lucide/shield
description: Kubernetes interview questions on RBAC design, service accounts, Pod Security Admission, and secrets handling, with detailed model answers.
tags:
  - Kubernetes
  - Interview Preparation
  - Security
---

# Interview Prep: Security & RBAC

## How would you design RBAC for a multi-team cluster from scratch?

**Short answer:** Namespace-scoped `Role`/`RoleBinding` pairs per team, granting only the verbs and resources that team actually needs in its own namespace, with `ClusterRole`/`ClusterRoleBinding` reserved for genuinely cluster-wide concerns like platform-team admin access.

**Detailed:** Start from "deny by default" — a new namespace grants nothing until a `RoleBinding` says otherwise — and grant the narrowest role that lets a team do its job: `get`/`list`/`watch` on `pods`, `deployments`, and `services` in their own namespace for regular engineers, with `create`/`update`/`delete` reserved for a smaller CI/CD or team-lead role. Aggregate cluster-wide read access (viewing all namespaces for an SRE team) through a `ClusterRole` bound with a `ClusterRoleBinding`, but keep write access namespace-scoped even for platform teams wherever possible.

**Common misconception:** That `ClusterRole` always means cluster-wide. A `ClusterRole` can be bound with a namespace-scoped `RoleBinding`, which is actually the recommended way to reuse one role definition (like `edit` or `view`) across many namespaces without redefining it each time.

**Senior follow-up:** "How do you audit whether your RBAC is actually least-privilege, months after it was set up?" — `kubectl auth can-i --list --as=system:serviceaccount:ns:name` per identity, cross-referenced against what that identity's workload actually calls in practice; tools like `rbac-lookup` or `kubectl-who-can` help scale this across many bindings.

## What is a ServiceAccount, and how is it different from a user identity?

**Short answer:** A ServiceAccount is an identity for a workload running *inside* the cluster (a Pod authenticating to the API server); a "user" in Kubernetes RBAC terms is an external identity — typically federated from your cloud IAM or an OIDC provider — that Kubernetes itself doesn't store or manage directly.

**Detailed:** Every Pod runs as some ServiceAccount (`default` if none is specified), and that identity is what's checked against RBAC when the Pod's own process calls the Kubernetes API — for example, a controller that lists Pods, or a CI job that applies manifests from inside the cluster. Kubernetes has no built-in user database at all; `User` and `Group` in RBAC are just strings that the configured authentication method (client certs, OIDC, a cloud provider's IAM integration) asserts about the caller.

**Common misconception:** That the `default` ServiceAccount in a namespace is harmless because "nobody explicitly granted it anything." If any `RoleBinding` in that namespace targets `default` — directly or via a broad `system:serviceaccounts` group binding — every Pod that doesn't specify its own ServiceAccount inherits that access silently.

**Senior follow-up:** "A Pod's ServiceAccount token was leaked from a log — what's actually exposed, and how do you limit the blast radius ahead of time?" — whatever that ServiceAccount is bound to via RBAC, for as long as the token is valid; bounded, audience-scoped, auto-expiring tokens (the default since the `TokenRequest` API/projected volumes became standard) plus `automountServiceAccountToken: false` on Pods that don't call the API at all are the two concrete mitigations.

## What does Pod Security Admission actually enforce, and how is it different from the old PodSecurityPolicy?

**Short answer:** Pod Security Admission (PSA) is a built-in admission controller that enforces one of three predefined policy levels — `privileged`, `baseline`, or `restricted` — via a namespace label, replacing the removed PodSecurityPolicy (PSP) API.

**Detailed:** PSP was retired because it was notoriously difficult to reason about — bindings were indirect (via RBAC on the policy resource itself) and predicting which policy applied to a given Pod required tracing through multiple objects. PSA fixes this by making enforcement a simple namespace-level label: `pod-security.kubernetes.io/enforce: restricted`, evaluated directly against the Pod spec with no separate binding object at all.

**Common misconception:** That PSA is as flexible as PSP was. It deliberately isn't — the three levels are fixed and not customizable; if you need finer-grained or custom policy (specific allowed registries, custom capability rules), you pair PSA's baseline enforcement with an external policy engine like Kyverno or OPA Gatekeeper for anything beyond the three standard levels.

**Senior follow-up:** "You want to enforce `restricted` cluster-wide without breaking every existing workload overnight — how do you roll it out?" — set the `warn` and `audit` modes first (which surface violations without blocking anything), review the audit log/warnings across all namespaces, fix or grant explicit `privileged` exceptions to what needs it, and only then flip `enforce` on.

## How do you actually secure secrets in Kubernetes, beyond "use a Secret object"?

**Short answer:** Enable encryption at rest for `etcd`, keep secret values out of Git entirely, and for anything sensitive in production, sync from an external secrets manager rather than storing the value as a native Kubernetes Secret's source of truth.

**Detailed:** A native `Secret` is base64, not encrypted, and by default stored in plaintext inside `etcd` — encryption at rest (an `EncryptionConfiguration` on the API server) is the first fix, and it's not on by default in every distribution. On top of that, tools like External Secrets Operator or the Vault CSI provider let the actual credential live in Vault/AWS Secrets Manager/etc., with Kubernetes only ever holding a synced, rotatable copy — so the Git repo that defines the `ExternalSecret` object never contains a real value at all.

**Common misconception:** That "sealed secrets" (encrypting a Secret so it's safe to commit to Git) and "external secrets" (never storing the value in Kubernetes-adjacent config at all) solve the same problem equally well. Sealed Secrets solves the GitOps-storage problem specifically; it still puts the live credential inside the cluster's `etcd` once decrypted. An external secrets manager additionally centralizes rotation, audit, and revocation outside the cluster entirely.

**Senior follow-up:** "A contractor's laptop with cluster access is compromised — how fast can you rotate every secret they could have read, and what does that reveal about your setup?" — if secrets live natively in Kubernetes, rotation means updating every `Secret` object and restarting every consumer; if they're centralized in an external manager, rotation happens in one place and propagates. The speed difference is usually the real argument for external secrets management in any team past a certain size.

## Next

Continue to [Senior & Architect Questions](05-senior-and-architect-questions.md).
