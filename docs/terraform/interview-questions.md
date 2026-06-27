---
description: Prepare practical Terraform interview answers covering state, providers, modules, plans, variables, workspaces, drift, remote backends, and infrastructure workflows.
---

# Terraform Interview Questions for Infrastructure as Code

This page helps you prepare clear, practical answers for Terraform interviews.

## How to Answer Well

Use this structure:

1. Define the concept in one line.
2. Explain why it matters in real infrastructure work.
3. Give one example or one caution.

## Core Questions

### What is Terraform?

Terraform is an infrastructure as code tool that lets you define and manage infrastructure using declarative files. Teams use it to create repeatable environments and review changes before applying them.

### What is a provider?

A provider is the plugin Terraform uses to communicate with a platform such as AWS, Azure, or GCP. Without a provider, Terraform does not know how to create or update resources on that platform.

### What is Terraform state?

State is the file Terraform uses to track what it manages. It maps the configuration to real infrastructure so Terraform can compare the desired state with the current state.

Good follow-up point:
State should be protected carefully because it can contain sensitive details.

### Why is `terraform plan` important?

`terraform plan` shows the changes Terraform wants to make before anything is applied. It reduces risk by letting teams review additions, updates, and deletions ahead of time.

### What is the difference between `plan` and `apply`?

- `plan` previews changes
- `apply` performs the changes

### Why use remote state?

Remote state makes team collaboration safer. It improves consistency, helps avoid local drift, and usually supports locking so two people do not update the same infrastructure at the same time.

### What are modules?

Modules are reusable Terraform building blocks. They help standardize common infrastructure patterns such as VPCs, IAM roles, or Kubernetes clusters.

### How do you manage secrets in Terraform?

The practical answer is to avoid hardcoding secrets in `.tf` files. Use secret managers, environment variables, CI/CD injection, or platform-native identity systems where possible.

### When would you use Terraform with Ansible?

Terraform is better for provisioning infrastructure. Ansible is better for configuring systems and running tasks on those systems after they exist. Many teams use Terraform first and Ansible second.

## Quick Revision Topics

- Providers
- Resources
- Variables
- Outputs
- Modules
- State
- Remote backends
- Workspaces
- Plan and apply flow
