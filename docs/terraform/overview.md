---
description: Learn Terraform infrastructure as code concepts, providers, workflow commands, AWS CLI setup, LocalStack practice, and safe local provisioning patterns.
---

# Terraform Infrastructure as Code Overview

Terraform is an infrastructure as code tool used to define and manage cloud and platform resources with declarative configuration files.

## What Terraform Is Good For

- Creating cloud infrastructure
- Managing repeatable environments
- Tracking changes before applying them
- Keeping infrastructure definitions in version control

## Core Terraform Concepts

- **Provider**: Plugin that connects Terraform to a platform such as AWS, Azure, or GCP
- **Resource**: Infrastructure object Terraform manages
- **State**: Record of what Terraform created and currently tracks
- **Plan**: Preview of proposed changes
- **Apply**: Step that creates or updates resources

## Simple Example

```hcl
resource "aws_instance" "example" {
  ami           = "ami-0abcd1234"
  instance_type = "t2.micro"
}
```

## How Terraform Works

1. Initialize the working directory with `terraform init`.
2. Review the execution plan with `terraform plan`.
3. Apply changes with `terraform apply`.
4. Store and protect state carefully.

## How Terraform Talks to Cloud Providers

Terraform uses provider plugins, and those providers call the platform APIs on your behalf.

Examples:

- `hashicorp/aws` for AWS
- `hashicorp/azurerm` for Azure
- `hashicorp/google` for GCP

Example provider block:

```hcl
provider "aws" {
  region = "us-east-1"
}
```

## Typical Workflow

```bash
terraform init
terraform plan
terraform apply
terraform show
```

## AWS CLI Setup

Terraform often works alongside the AWS CLI, especially during setup and testing.

Install on macOS:

```bash
brew install awscli
aws --version
```

Install on Windows:

```bash
choco install awscli
aws --version
```

Configure credentials:

```bash
aws configure
```

Test access:

```bash
aws s3 ls
```

## LocalStack for Safe Local Practice

LocalStack lets you test Terraform and AWS-style workflows locally without using a real AWS account.

### Why Use It

- Avoid cloud cost during practice
- Test quickly in a local environment
- Learn Terraform flow more safely

### Install LocalStack

```bash
pip install localstack awscli-local
localstack --version
```

### Start It

```bash
localstack start
```

Runs on `http://localhost:4566`.

### Dashboard Example

These screenshots show the LocalStack interface during a local Terraform practice setup.

![LocalStack dashboard](<Screenshot 2025-10-05 at 8.22.20 PM.png>)
![LocalStack resources view](<Screenshot 2025-10-05 at 8.23.33 PM.png>)

### Quick Test

```bash
awslocal s3 ls
awslocal s3 mb s3://demo-bucket
```

### Docker Compose Example

```yaml
version: "3.8"
services:
  localstack:
    image: localstack/localstack
    ports:
      - "4566:4566"
    environment:
      - SERVICES=s3,ec2,lambda
      - DEBUG=1
    volumes:
      - "./localstack:/var/lib/localstack"
```

Start it with:

```bash
docker compose up
```

## Terraform with LocalStack

Example project structure:

```text
terraform-localstack-demo/
├── main.tf
├── provider.tf
├── outputs.tf
└── hello.txt
```

Example provider:

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.5.0"
}

provider "aws" {
  region                      = "us-east-1"
  access_key                  = "test"
  secret_key                  = "test"
  s3_force_path_style         = true
  skip_credentials_validation = true
  skip_metadata_api_check     = true
}
```

## Practical Advice

- Do not hardcode real credentials in configuration files
- Use remote state for team environments
- Review `plan` output before every apply
- Separate learning labs from production workspaces

## FAQ

### What is Terraform used for?

Terraform is used to define and manage infrastructure with code. It is commonly used for cloud networks, compute, storage, IAM, Kubernetes platform dependencies, and repeatable environment setup.

### What is the difference between Terraform and Ansible?

Terraform is strongest for provisioning infrastructure resources. [Ansible](../ansible/index.md) is strongest for configuring systems and running operational tasks on existing hosts. Many teams use both together.

### What is Terraform state?

Terraform state records what Terraform believes it manages. Treat state as important operational data, store team state remotely, and protect it from accidental edits or exposure.

### How can I practice Terraform safely?

Use local labs such as LocalStack, isolated cloud sandboxes, small examples, and `terraform plan` reviews before applying changes.

## Related Learning

- [Terraform interview questions](interview-questions.md)
- [Ansible book series](../ansible/index.md)
- [Multi-environment deployment design](../system-design/multi-environment.md)
- [Backup and disaster recovery design](../system-design/backup-disaster-recovery.md)

## Next Steps

- Review [Terraform interview questions](interview-questions.md)
- Pair Terraform with [Ansible](../ansible/index.md) when you need both provisioning and configuration
