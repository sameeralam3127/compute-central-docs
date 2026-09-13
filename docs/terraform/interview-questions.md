---
title: "Terraform Interview Questions and Answers"
icon: lucide/messages-square
description: Prepare practical Terraform interview answers covering state, providers, modules, plans, variables, workspaces, drift, remote backends, import, refactoring, CI/CD, and senior-level scenario questions.
tags:
  - Terraform
  - Interview Preparation
---

# Terraform Interview Questions

## How to Answer Well

Use a three-part structure:

1. **Define** the concept in one sentence.
2. **Explain why** it matters in real infrastructure work.
3. **Give one example or one caution** from experience.

Each answer links to the page that covers it in depth.

## Core Questions

### What is Terraform, and how is it different from a script?

Terraform is a declarative infrastructure-as-code tool: you describe the end state and it computes the changes needed. A script lists steps and isn't idempotent — run it twice and you may create everything twice. Terraform compares configuration, state, and reality, and shows a plan before changing anything. See [Fundamentals](overview.md).

### What is a provider?

A plugin that translates Terraform resources into API calls for one platform (AWS, Azure, Kubernetes, GitHub). Providers are versioned independently; pin them with `required_providers` and commit `.terraform.lock.hcl` so every run uses the same version.

### What is Terraform state, and why does it need protecting?

State maps resource addresses in configuration to real object IDs and stores their attributes. Terraform can't plan without it. It often contains secrets in plain text (database passwords, private keys), so it belongs in an encrypted, access-controlled remote backend, never in Git. See [State and Remote Backends](state-and-backends.md).

### What's the difference between `plan` and `apply`?

`plan` computes and shows proposed changes without making them. `apply` makes changes. In automation, save the reviewed plan with `plan -out=tfplan` and run `apply tfplan`, so exactly what was reviewed is applied.

### Why use remote state?

So a team shares one source of truth, with **locking** to prevent concurrent writes, encryption, versioning for recovery, and access control. On S3, Terraform 1.11+ supports native locking with `use_lockfile = true`, replacing DynamoDB tables.

### What are modules?

Reusable, versioned groups of resources with inputs (variables) and outputs. They standardize patterns like a VPC or a service, so teams don't copy-paste resource blocks. See [Modules](modules.md).

### What's the difference between a variable, a local, and an output?

Variables are inputs set by the caller; locals are values computed inside the configuration; outputs are values returned to the caller or to other tools. See [Variables, Outputs, and Locals](variables-outputs-and-locals.md).

### `count` or `for_each`?

`count` creates N copies addressed by index; `for_each` creates one per map key or set element, addressed by key. Prefer `for_each` for anything with identity: removing an item from the middle of a `count` list shifts indexes and can destroy and recreate unrelated resources.

### How do you manage secrets in Terraform?

Never hardcode them in `.tf` or committed `.tfvars` files. Read them at run time from a secret manager (data sources or `TF_VAR_` environment variables in CI), mark variables and outputs `sensitive`, and remember `sensitive` doesn't keep values out of state — protect the state, and use write-only arguments or ephemeral resources where providers support them.

### When would you use Terraform with Ansible?

Terraform provisions infrastructure (networks, instances, managed services); Ansible configures operating systems and software on hosts that exist. A common flow: Terraform creates instances with tags, and Ansible's [dynamic inventory](../ansible/case-studies/06-dynamic-inventory-case-study.md) finds and configures them.

## Intermediate Questions

### What is drift, and how do you handle it?

Drift is a difference between real infrastructure and state, usually from manual changes. Detect it with `terraform plan -refresh-only` or scheduled plans with `-detailed-exitcode`. Then either revert it (apply the configuration) or accept it (update configuration to match, then apply).

### How do you bring an existing resource under Terraform management?

Add an `import` block with the target address and the real ID, run `terraform plan -generate-config-out=generated.tf`, clean up the generated configuration until the plan shows no changes, apply, and delete the `import` block.

### How do you rename a resource without destroying it?

Add a `moved` block from the old address to the new one. The plan shows a move instead of destroy-and-create. Prefer this over `terraform state mv`, because it's reviewed in a pull request and applied consistently across environments.

### What are workspaces, and should you use them for production?

CLI workspaces are multiple state instances for one configuration directory. They suit short-lived identical copies (per-branch test stacks). For production isolation, use separate directories with separate backends and credentials, ideally separate cloud accounts — shared credentials and an easy-to-miss selected workspace make CLI workspaces risky. See [Environments and Workspaces](environments-and-workspaces.md).

### What do `prevent_destroy`, `create_before_destroy`, and `ignore_changes` do?

`prevent_destroy` makes any plan that would destroy the resource fail — use it for databases and state buckets. `create_before_destroy` builds the replacement before removing the original, avoiding downtime. `ignore_changes` stops Terraform reverting attributes legitimately managed elsewhere, like an autoscaler's desired capacity.

### Why is `-target` dangerous as a habit?

It applies part of the graph, leaving the rest of the configuration unapplied and state out of step with code. It's an emergency tool for breaking a dependency deadlock, not a workflow.

## Scenario Questions

### A plan fails with "Error acquiring the state lock." What do you do?

Read the lock info: who holds it and since when. Check whether that pipeline or person is still running an operation. Only if the holder has definitely died, run `terraform force-unlock <ID>`. Force-unlocking a live apply risks corrupting state.

### Someone ran `terraform state rm` on a production database by mistake. What now?

The database still exists; Terraform just forgot it, and the next plan wants to create a new one. Don't apply. Re-import it with an `import` block (or `terraform import`), plan until there are no changes, then apply. If the state file itself is damaged, restore a previous version from the versioned state bucket.

### The plan wants to replace a production database because of a small change. What do you check?

Look for `# forces replacement` in the plan to find the attribute. Common causes: changing an immutable attribute (engine, identifier, subnet group), a renamed resource without a `moved` block, or a data source (like a "most recent" snapshot or AMI) returning a new value. Fix the cause; add `prevent_destroy` so it can't happen silently.

### A module update is about to change 400 resources across 20 environments. How do you roll it out?

Release the module as a new version; update and plan one low-risk environment first; inspect a representative plan in detail; apply and verify; then promote environment by environment through pull requests, using the plan output as the review artifact. Stop at the first unexpected change.

## Senior Questions

### How would you structure Terraform for an organization with 30 teams?

Split state by ownership and blast radius (organization/accounts, shared networking, per-team application stacks). Publish shared modules with semantic versions from a platform team. Isolate environments by cloud account. Run all applies through pipelines with OIDC, separate plan and apply roles, and approval for production. Enforce policies (tagging, encryption, public access) with policy as code. Document the contract for sharing outputs, typically through parameter stores rather than cross-reading state.

### Terraform or OpenTofu?

Both share the language, providers, and workflow. Terraform is HashiCorp-maintained under the Business Source License with HCP Terraform integration; OpenTofu is an open-source Linux Foundation fork with features such as client-side state encryption. Decide on licensing requirements, needed features, and platform integrations, then standardize on one and pin versions — mixing them against the same state invites incompatibilities.

### How do you keep a Terraform codebase healthy over years?

Pin Terraform, providers, and modules and update them deliberately with automated pull requests. Keep state small and focused. Test modules with `terraform test`. Run drift detection. Refactor with `moved` and `removed` blocks, never by hand-editing state. Remove unused code and outputs. Treat plans as code review artifacts.

## Quick Revision Topics

- Providers and the dependency lock file
- Resources, data sources, and the dependency graph
- Variables (types, validation, precedence), locals, outputs
- `count`, `for_each`, dynamic blocks, lifecycle rules
- State, remote backends, locking, encryption
- Drift, `import`, `moved`, `removed`
- Modules: sources, versioning, provider passing
- Environments: directories, workspaces, account isolation
- Testing: `fmt`, `validate`, TFLint, security scanners, `terraform test`
- CI/CD: plan on PR, apply on merge, OIDC, drift detection, policy as code

## Next

Return to the [Terraform section overview](index.md), or pair it with [Ansible](../ansible/index.md) for host configuration.
