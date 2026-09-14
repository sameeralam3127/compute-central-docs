---
title: "Terraform State, Remote Backends, Locking, Drift, and Import"
icon: lucide/database
description: "Terraform state explained — S3 backends with native locking and encryption, drift, stuck locks, and refactoring with import, moved, and removed."
tags:
  - Terraform
  - State
---

# State and Remote Backends

## What You'll Learn

- What state contains, why Terraform needs it, and why it's sensitive
- How to move state to an S3 backend with encryption and native locking
- How locking works, and what to do when a lock gets stuck
- How to detect and handle drift
- How to import existing resources and refactor without destroying anything

## Why State Exists

Terraform needs to know which real objects belong to which resource blocks. An `aws_instance.web` block doesn't contain the instance ID `i-0abc123` — the **state** does. State maps configuration addresses to real IDs, stores attribute values, and records dependencies, so Terraform can calculate a plan without guessing.

```json title="terraform.tfstate (excerpt)"
{
  "version": 4,
  "terraform_version": "1.14.0",
  "serial": 42,
  "lineage": "7c1d3f0e-...",
  "resources": [
    {
      "mode": "managed",
      "type": "aws_db_instance",
      "name": "main",
      "instances": [
        {
          "attributes": {
            "id": "shop-prod",
            "address": "shop-prod.abc123.us-east-1.rds.amazonaws.com",
            "password": "S3cure-and-long"
          }
        }
      ]
    }
  ]
}
```

Note the plain-text `password`. **State contains secrets.**

## Why Local State Fails Teams

| Problem with `terraform.tfstate` on a laptop | Consequence |
|---|---|
| Only one person has it | Nobody else can safely run Terraform |
| Two people apply at once | Corrupted or lost state |
| Committed to Git | Secrets in history; merge conflicts on every change |
| Laptop lost or disk wiped | Terraform no longer knows what it manages |

A **remote backend** stores state centrally, with locking and access control.

## An S3 Backend With Native Locking

Terraform 1.11 and later can lock state using S3 itself (`use_lockfile`), with no DynamoDB table.

### 1. Bootstrap the state bucket

The bucket that holds state can't be created by the configuration that stores its state there. Create it once with a small separate configuration (with local state), or with the console under a documented process:

```hcl title="bootstrap/main.tf"
resource "aws_s3_bucket" "tfstate" {
  bucket = "acme-tfstate-prod-us-east-1"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.tfstate.arn
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_kms_key" "tfstate" {
  description         = "Terraform state encryption"
  enable_key_rotation = true
}
```

Versioning is your undo button: a bad state write can be rolled back to a previous object version.

### 2. Configure the backend

```hcl title="backend.tf"
terraform {
  backend "s3" {
    bucket       = "acme-tfstate-prod-us-east-1"
    key          = "shop/network/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
```

### 3. Migrate existing local state

```bash
terraform init -migrate-state
terraform state list          # same resources, now read from S3
rm terraform.tfstate terraform.tfstate.backup   # only after confirming the migration
```

### Least-privilege access for the backend

The identity running Terraform needs, for its state key and lock file:

```json
{
  "Effect": "Allow",
  "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
  "Resource": [
    "arn:aws:s3:::acme-tfstate-prod-us-east-1/shop/network/terraform.tfstate",
    "arn:aws:s3:::acme-tfstate-prod-us-east-1/shop/network/terraform.tfstate.tflock"
  ]
}
```

plus `s3:ListBucket` on the bucket, and `kms:Encrypt`/`kms:Decrypt`/`kms:GenerateDataKey` on the key.

!!! note "Migrating from DynamoDB locking"
    Older configurations use `dynamodb_table` for locking, which is now deprecated. Add `use_lockfile = true` alongside `dynamodb_table` for a transition period (both locks are acquired), then remove `dynamodb_table` once every user and pipeline runs a Terraform version that supports S3 locking.

Other backends work the same way: `azurerm` (blob lease locking), `gcs` (built-in locking), and HCP Terraform or other TACOS platforms, which add a UI, run history, and policy checks.

## Locking

Every operation that could write state acquires a lock first. A second concurrent `apply` waits or fails:

```text
Error: Error acquiring the state lock

Lock Info:
  ID:        3f1c9c9e-5e2a-4b8e-9c70-0f1d7e0c2b41
  Path:      acme-tfstate-prod-us-east-1/shop/network/terraform.tfstate
  Operation: OperationTypeApply
  Who:       ci-runner@runner-7
  Created:   2026-09-13 09:41:07 UTC
```

**Don't** immediately force-unlock. First check `Who` and `Created`: is that CI job still running? If the process genuinely died (a cancelled pipeline, a crashed laptop):

```bash
terraform force-unlock 3f1c9c9e-5e2a-4b8e-9c70-0f1d7e0c2b41
```

Force-unlocking a lock held by a running apply is how state gets corrupted.

## Protecting State

- Restrict who can read the state bucket — reading state can mean reading database passwords.
- Encrypt with KMS and turn on bucket versioning.
- Split state by blast radius (network, data, applications) so a mistake in one can't touch the others, and so permissions can differ.
- Prefer write-only arguments and ephemeral resources for secrets where providers support them, so they never reach state.
- OpenTofu adds client-side state encryption if you need state encrypted before it reaches the backend.

## Drift

Drift is when real infrastructure no longer matches state — usually someone changed something in the console.

```bash
terraform plan -refresh-only
```

```text
Note: Objects have changed outside of Terraform

  # aws_security_group.web has changed
  ~ resource "aws_security_group" "web" {
      ~ ingress = [
          + {
              + cidr_blocks = ["0.0.0.0/0"]
              + from_port   = 22
              ...
```

Two choices:

- **Revert the drift:** run a normal `terraform apply`; Terraform changes reality back to the configuration.
- **Accept the drift:** update the configuration to match, then apply so state records it (`terraform apply -refresh-only` updates state without changing infrastructure).

Detect drift on a schedule — see [Testing and CI/CD](testing-and-ci.md#scheduled-drift-detection).

## Importing Existing Resources

Resources created by hand can be brought under Terraform with an `import` block (Terraform 1.5+):

```hcl title="imports.tf"
import {
  to = aws_s3_bucket.legacy_assets
  id = "acme-legacy-assets"
}
```

```bash
terraform plan -generate-config-out=generated.tf
```

Terraform writes a starting resource block into `generated.tf`. Clean it up (remove computed and default arguments), move it to the right file, and plan until it shows **no changes** — that proves the configuration matches reality. Then apply to record the import, and delete the `import` block.

## Refactoring Without Destroying: moved and removed

Renaming a resource or moving it into a module changes its address. Without help, Terraform plans to destroy the old address and create a new one.

```hcl
moved {
  from = aws_s3_bucket.logs
  to   = module.logging.aws_s3_bucket.this
}
```

The plan now shows the resource **moved**, with no replacement. Keep `moved` blocks for a while so every environment and branch picks up the move, then remove them.

To stop managing a resource **without destroying it**:

```hcl
removed {
  from = aws_s3_bucket.legacy_assets

  lifecycle {
    destroy = false
  }
}
```

Prefer `moved` and `removed` blocks over `terraform state mv` and `terraform state rm`: blocks go through code review and plan, while state commands change state immediately and invisibly.

## Sharing Outputs Between Configurations

When the application configuration needs the network configuration's subnet IDs:

| Option | Trade-off |
|---|---|
| `terraform_remote_state` data source | Simple, but requires read access to the **entire** other state, including its secrets |
| Publish values to SSM Parameter Store / Consul, read with a data source | Explicit contract and narrower permissions — usually better |
| Look up resources directly with data sources (by tag) | No coupling to state at all |

## Common Mistakes

- Committing state to Git.
- Giving broad read access to the state bucket without realizing state contains secrets.
- Force-unlocking a lock held by a running pipeline.
- Using one giant state for everything, so every plan is slow and every mistake is global.
- Renaming resources without `moved` blocks, triggering destroy-and-recreate of production resources.
- Running `terraform state rm` to "fix" an error and orphaning real infrastructure.

## Interview Questions

- What does Terraform state contain, and why does it need protecting?
- How does S3 native state locking work, and what replaced DynamoDB-based locking?
- A plan fails with "Error acquiring the state lock." What do you check before running `force-unlock`?
- How do you bring a manually created resource under Terraform management?
- You need to rename a resource that manages a production database. How do you do it without destroying the database?
- What's drift, and what are your two options when you find it?

## Next

Continue to [Modules](modules.md).
