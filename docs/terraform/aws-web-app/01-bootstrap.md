---
title: "Terraform Bootstrap on AWS: S3 State Bucket, ECR, and GitHub OIDC"
icon: lucide/key-round
description: "Step 1 of the Terraform AWS project: create an S3 state bucket with native locking, an ECR repository, and GitHub Actions OIDC roles in a bootstrap stack, then migrate its own state."
tags:
  - Terraform
  - AWS
  - Lab
---

# Step 1: Bootstrap State, Registry, and CI Access

## What You'll Learn

- Why some resources have to exist before your main Terraform stack can run
- How to create an S3 state bucket that's versioned, encrypted, private, and TLS-only
- Why the container registry lives outside the application stack
- How GitHub Actions gets AWS access with OIDC instead of stored keys

## The Chicken-and-Egg Problem

The application stack stores its state in S3. Terraform can't create the bucket that holds its own state in the same run. The image registry has a similar problem: the ECS service needs an image tag that already exists, so the registry must exist before you push to it.

The fix is a small **bootstrap stack** that you apply once, by hand, with local state:

| Resource | Why it's here, not in the app stack |
|---|---|
| S3 state bucket | Every other stack's state lives in it |
| ECR repository | Images must be pushed before the app stack deploys them. It outlives any single environment. |
| GitHub OIDC provider and roles | CI needs them before it can run Terraform at all |

## Step 1: Protect Your Account

Before creating anything:

1. **Use a sandbox account.** In an AWS Organization, create a member account just for this project, so cleanup is "close the account" if all else fails.
2. **Create a budget alert.** In the console, open **Billing and Cost Management**, **Budgets**, **Create budget**, choose a monthly cost budget of $20, and add your email for alerts at 80% and 100%.
3. **Sign in with short-lived credentials:**

```bash
aws configure sso          # IAM Identity Center; creates a named profile
export AWS_PROFILE=sandbox # the profile name you chose
aws sts get-caller-identity
```

```json
{
    "UserId": "AROA...:you@example.com",
    "Account": "123456789012",
    "Arn": "arn:aws:sts::123456789012:assumed-role/AWSAdministratorAccess_abc123/you@example.com"
}
```

Check that `Account` is the sandbox, every time you open a new terminal.

## Step 2: Write the Bootstrap Stack

```bash
mkdir -p webapp/bootstrap && cd webapp/bootstrap
```

Save this as `bootstrap/main.tf`:

```hcl title="bootstrap/main.tf"
# One-time setup: the state bucket, the image repository, and the roles GitHub Actions assumes.
# This stack keeps its own state locally, because it creates the bucket that every other stack uses.

terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = var.project
      Stack     = "bootstrap"
      ManagedBy = "terraform"
    }
  }
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "project" {
  type    = string
  default = "webapp"
}

variable "github_repository" {
  type        = string
  description = "GitHub repository allowed to plan and deploy, as owner/name. Leave empty to skip CI setup."
  default     = ""
}

data "aws_caller_identity" "current" {}

locals {
  state_bucket = "${var.project}-tfstate-${data.aws_caller_identity.current.account_id}-${var.region}"
  enable_ci    = var.github_repository != ""
}

# ---------------------------------------------------------------- state bucket

resource "aws_s3_bucket" "state" {
  bucket = local.state_bucket

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "state_tls_only" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.state.arn,
      "${aws_s3_bucket.state.arn}/*",
    ]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = data.aws_iam_policy_document.state_tls_only.json
}

# ---------------------------------------------------------------- image repository

resource "aws_ecr_repository" "app" {
  name                 = var.project
  image_tag_mutability = "IMMUTABLE" # a tag always means the same image, so rollbacks are exact
  force_delete         = true        # lets `terraform destroy` remove a repository that still has images

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the 20 most recent images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 20
      }
      action = { type = "expire" }
    }]
  })
}

# ---------------------------------------------------------------- GitHub Actions (OIDC, no stored keys)

resource "aws_iam_openid_connect_provider" "github" {
  count          = local.enable_ci ? 1 : 0
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "github_trust" {
  for_each = local.enable_ci ? {
    plan   = "repo:${var.github_repository}:pull_request"
    deploy = "repo:${var.github_repository}:environment:dev"
  } : {}

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github[0].arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [each.value]
    }
  }
}

# Pull requests can read everything and lock state, but change nothing.
resource "aws_iam_role" "github_plan" {
  count              = local.enable_ci ? 1 : 0
  name               = "${var.project}-github-plan"
  assume_role_policy = data.aws_iam_policy_document.github_trust["plan"].json
}

resource "aws_iam_role_policy_attachment" "github_plan_read" {
  count      = local.enable_ci ? 1 : 0
  role       = aws_iam_role.github_plan[0].name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

resource "aws_iam_role_policy" "github_plan_state_lock" {
  count = local.enable_ci ? 1 : 0
  name  = "terraform-state-lock"
  role  = aws_iam_role.github_plan[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject", "s3:DeleteObject"]
      Resource = "${aws_s3_bucket.state.arn}/*.tflock"
    }]
  })
}

# Only workflow jobs that run in the GitHub "dev" environment can deploy.
resource "aws_iam_role" "github_deploy" {
  count              = local.enable_ci ? 1 : 0
  name               = "${var.project}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_trust["deploy"].json
}

resource "aws_iam_role_policy_attachment" "github_deploy" {
  count = local.enable_ci ? 1 : 0
  role  = aws_iam_role.github_deploy[0].name
  # Terraform creates VPCs, IAM roles, databases, and more, so this role is powerful.
  # Use it only in a dedicated sandbox or dev account. See the CI/CD page for how to narrow it.
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

# ---------------------------------------------------------------- outputs

output "state_bucket" {
  value = aws_s3_bucket.state.bucket
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "github_plan_role_arn" {
  value = local.enable_ci ? aws_iam_role.github_plan[0].arn : null
}

output "github_deploy_role_arn" {
  value = local.enable_ci ? aws_iam_role.github_deploy[0].arn : null
}
```

The decisions that matter:

- **The bucket name includes the account ID and region.** S3 bucket names are global across all AWS customers, so `webapp-tfstate` is almost certainly taken.
- **`prevent_destroy`** makes Terraform refuse any plan that would delete the state bucket. Losing state means Terraform forgets every resource it manages.
- **Versioning** lets you recover an older state file after a bad apply or a corrupted write.
- **The bucket policy denies non-TLS requests.** State files can hold sensitive values, such as database endpoints.
- **`image_tag_mutability = "IMMUTABLE"`** means a tag can never be overwritten. When you roll back to tag `a1b2c3d`, you get exactly the image you tested.
- **Two CI roles, two trust conditions.** Pull requests get read-only access. Only jobs running in the GitHub `dev` environment can assume the deploy role. Page 7 explains both.

## Step 3: Apply It

Leave `github_repository` empty for now. You'll add CI on page 7.

```bash
terraform init
terraform plan
```

```text
Plan: 7 to add, 0 to change, 0 to destroy.
```

Read the plan: one bucket with versioning, encryption, a public access block, and a policy; one ECR repository with a lifecycle policy. Then apply:

```bash
terraform apply
```

```text
Apply complete! Resources: 7 added, 0 changed, 0 destroyed.

Outputs:

ecr_repository_url = "123456789012.dkr.ecr.us-east-1.amazonaws.com/webapp"
github_deploy_role_arn = null
github_plan_role_arn = null
state_bucket = "webapp-tfstate-123456789012-us-east-1"
```

## Step 4: Move the Bootstrap State Into the Bucket

The bootstrap state is still a local file, `bootstrap/terraform.tfstate`. If you lose it, Terraform forgets the bucket it created. Now that the bucket exists, move the state into it. Add a backend block inside the `terraform` block of `bootstrap/main.tf`, with your bucket name:

```hcl
  backend "s3" {
    bucket       = "webapp-tfstate-123456789012-us-east-1"
    key          = "bootstrap/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
```

```bash
terraform init -migrate-state
```

Terraform asks whether to copy the existing state to the new backend. Answer `yes`, then confirm the state is there and delete the local copy:

```bash
aws s3 ls s3://webapp-tfstate-123456789012-us-east-1/bootstrap/
rm terraform.tfstate terraform.tfstate.backup
```

## Step 5: Point the App Stack at the Bucket

Create the application stack's directory and its backend settings. Every other page uses this file.

```bash
mkdir -p ../infra
```

```hcl title="infra/backend.hcl"
bucket       = "webapp-tfstate-123456789012-us-east-1" # the state_bucket output from bootstrap
key          = "dev/terraform.tfstate"
region       = "us-east-1"
encrypt      = true
use_lockfile = true # S3-native state locking (Terraform 1.10+), no DynamoDB table needed
```

Replace the bucket name with your `state_bucket` output. `use_lockfile = true` turns on S3-native state locking: Terraform writes `dev/terraform.tfstate.tflock` next to the state while a run is in progress, and a second run waits or fails instead of corrupting the state. Before Terraform 1.10 this needed a DynamoDB table. See [State and Remote Backends](../state-and-backends.md).

## What Most Engineers Miss

- **The bootstrap stack is the one you'll forget about.** It runs once and then sits for months. Keep it in the same repository as the app, with its state in the bucket, so the next person can find it.
- **`force_delete` on ECR is a lab setting.** It lets `terraform destroy` delete a repository that still holds images. In a long-lived account, remove it so a destroy can't wipe every image you've shipped.
- **Account ID in names is not a secret, but it is a fingerprint.** It's fine in bucket names. Don't rely on obscurity for anything.

!!! quiz "Bootstrap state"
    Why does the bootstrap stack start with local state?

    - [ ] Local state is more secure than S3
    - [x] It creates the bucket that remote state needs, so the bucket can't hold its state yet
    - [ ] Bootstrap resources are too small to need remote state

    Once the bucket exists, migrate the bootstrap state into it with `terraform init -migrate-state`.

!!! quiz "Immutable tags"
    The ECR repository uses `IMMUTABLE` tags. What happens if CI pushes `webapp:latest` twice?

    - [ ] The second push replaces the first image
    - [x] The second push fails, because the tag already exists
    - [ ] ECR keeps both images under the same tag

    That's why the pipeline tags images with the Git commit SHA: every build gets a new, permanent tag.

## Common Mistakes

- Creating the state bucket by hand in the console, so nothing records how it's configured.
- Storing bootstrap state only on one laptop.
- Using a mutable `latest` tag, then not knowing which image a rollback actually deployed.
- Running the project in an account that also runs production workloads.
- Skipping the budget alert because "it's only an afternoon".

## Interview Questions

- How do you create the S3 bucket for Terraform's remote state, given that Terraform needs state to create anything?
- What does `use_lockfile` do, and what did teams use before Terraform 1.10?
- Why would you make container image tags immutable?
- How should a CI system authenticate to AWS?

## Next

Continue to [Step 2: The App and Its Image](02-app-and-image.md).
