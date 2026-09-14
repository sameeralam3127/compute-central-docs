---
title: "Cloud Engineering: AWS Fundamentals for DevOps and SRE"
icon: lucide/cloud
description: "Cloud engineering for DevOps and SRE — how AWS accounts, identity, networking, compute, storage, observability, security, and cost fit together."
tags:
  - Cloud
  - AWS
  - Overview
---

# Cloud Engineering

Most infrastructure now runs on a public cloud, and cloud platforms change what operations work looks like: capacity is an API call, networks are software, identity replaces the network perimeter, and cost is an engineering metric. This section teaches those foundations using **AWS**, the most widely used provider. The same concepts map closely to Azure and Google Cloud.

## What You'll Learn

- How to structure accounts and access so teams can move fast safely
- How identity, networking, compute, and storage services fit together into real architectures
- How to run containers and databases on managed services
- How to observe, secure, and control the cost of what you build

## Tracks

| Track | Covers | Start |
|---|---|---|
| **AWS** | Accounts and IAM, VPC networking, EC2 and load balancing, S3, ECS and EKS, databases, CloudWatch, KMS and secrets, and cost | [AWS](aws/index.md) |

## How the Cloud Changes Operations

| On-premises habit | Cloud practice |
|---|---|
| Firewalls define trust | Identity (IAM roles and policies) defines trust; networks are a second layer |
| Buy hardware for peak load | Scale on demand, and pay for what runs |
| Servers are long-lived and patched in place | Instances are replaced from images; infrastructure is code |
| Capacity planning happens yearly | Capacity and cost are reviewed continuously |
| Backups are a separate system | Managed services include backups, replication, and point-in-time recovery — if you turn them on |

## Provider Concepts Side by Side

| Concept | AWS | Azure | Google Cloud |
|---|---|---|---|
| Account / billing boundary | Account, in an Organization | Subscription, in a Management Group | Project, in a Folder and Organization |
| Identity and access | IAM, IAM Identity Center | Microsoft Entra ID, Azure RBAC | Cloud IAM |
| Private network | VPC | Virtual Network (VNet) | VPC |
| Virtual machines | EC2 | Virtual Machines | Compute Engine |
| Object storage | S3 | Blob Storage | Cloud Storage |
| Managed Kubernetes | EKS | AKS | GKE |
| Serverless containers | ECS on Fargate, App Runner | Container Apps | Cloud Run |
| Managed relational database | RDS, Aurora | Azure SQL, Azure Database for PostgreSQL | Cloud SQL, AlloyDB |
| Metrics and logs | CloudWatch | Azure Monitor | Cloud Monitoring and Logging |
| Key management | KMS | Key Vault | Cloud KMS |

## Related Sections

- [Terraform](../terraform/index.md) — provision everything in this section as code
- [Networking Foundations](../foundations/networking/index.md) — the protocols underneath VPCs and load balancers
- [Kubernetes](../kubernetes/index.md) — the platform many teams run on EKS
- [Security](../security/index.md) — secrets, supply chain, and DevSecOps practices

## Next

Start with [AWS](aws/index.md).
