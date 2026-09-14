---
title: "AWS Cost Optimization: Visibility, Rightsizing, Savings Plans"
icon: lucide/piggy-bank
description: "Control AWS costs — cost allocation tags, Cost Explorer, rightsizing, Savings Plans, Spot, Graviton, data transfer, and common hidden waste."
tags:
  - AWS
  - Cost
  - FinOps
---

# Cost Optimization

## What You'll Learn

- How to see where money goes and who owns it
- The biggest levers: rightsizing, commitment discounts, Spot, and Graviton
- The hidden costs that surprise most teams: data transfer, NAT, logs, and idle resources
- How to make cost part of normal engineering work instead of a quarterly scramble

## Visibility First

You can't optimize what you can't attribute.

### Cost allocation tags

Define a small, enforced tag set and activate the tags in **Billing → Cost allocation tags**:

| Tag | Example | Answers |
|---|---|---|
| `Owner` or `Team` | `payments` | Who do we ask about this spend? |
| `Service` | `orders-api` | What does this cost to run? |
| `Environment` | `prod`, `staging` | How much does non-production cost? |
| `CostCenter` | `cc-4410` | Which budget pays? |

Enforce tags with Terraform `default_tags`, tag policies in AWS Organizations, and Config rules. Remember that some costs — data transfer, shared NAT gateways, support — can't be tagged and need allocation rules.

```hcl
provider "aws" {
  region = "eu-west-1"
  default_tags {
    tags = {
      Team        = "orders"
      Service     = "orders-api"
      Environment = "prod"
      ManagedBy   = "terraform"
    }
  }
}
```

### Tools

| Tool | Use for |
|---|---|
| **Cost Explorer** | Spend by service, account, tag, and usage type over time; forecasts |
| **Budgets** | Alerts on actual or forecasted spend per account, team, or service |
| **Cost Anomaly Detection** | Machine-learned alerts on unusual spend |
| **Cost and Usage Report (CUR 2.0 / Data Exports)** | Line-item detail for analysis in Athena or a FinOps tool |
| **Compute Optimizer** | Rightsizing recommendations for EC2, EBS, Lambda, ECS on Fargate, and RDS |
| **Cost Optimization Hub** | One place for recommendations across accounts, with estimated savings |

In Cost Explorer, **group by usage type**, not just service. "EC2 – Other" hides NAT gateway hours, data transfer, EBS volumes, and snapshots.

## The Big Levers

### 1. Turn off and delete what isn't needed

The fastest savings come from resources nobody uses:

```bash
# Unattached EBS volumes
aws ec2 describe-volumes --filters Name=status,Values=available \
  --query 'Volumes[].[VolumeId, Size, CreateTime]' --output table

# Elastic IPs not associated with anything
aws ec2 describe-addresses --query 'Addresses[?AssociationId==null].[PublicIp, AllocationId]' --output table

# Load balancers with no registered targets — check target group health
aws elbv2 describe-target-groups --query 'TargetGroups[].[TargetGroupName, LoadBalancerArns[0]]' --output table

# Old snapshots
aws ec2 describe-snapshots --owner-ids self \
  --query 'Snapshots[?StartTime<=`2025-09-01`].[SnapshotId, VolumeSize, StartTime]' --output table
```

Automate cleanup carefully, with dry runs and protection tags — see the [boto3 cleanup tool](../../foundations/python/04-aws-automation-with-boto3.md#a-real-tool-find-and-clean-up-unused-ebs-volumes). **Schedule non-production environments** to scale to zero outside working hours.

### 2. Rightsize

Most instances are provisioned for peak load that never arrives.

- Use **Compute Optimizer** recommendations, based on at least two weeks of CloudWatch metrics (enable memory metrics through the CloudWatch agent for accurate recommendations).
- Rightsize **before** buying commitments — otherwise you commit to paying for waste.
- For Kubernetes, set requests from real usage; see [Kubernetes Cost Optimization](../../kubernetes/production-engineering/02-cost-optimization.md).

### 3. Commitment discounts

| Option | Commitment | Flexibility | Applies to |
|---|---|---|---|
| **Compute Savings Plans** | A dollar amount per hour for 1 or 3 years | Any instance family, size, region, OS; also Fargate and Lambda | Most flexible — the usual default |
| **EC2 Instance Savings Plans** | Per hour, one instance family in one region | Any size and OS within the family | Higher discount, less flexible |
| **Reserved Instances** | Specific capacity | Limited | Still the model for RDS, ElastiCache, OpenSearch, Redshift |

Commit only to your **steady baseline** — the usage that runs 24/7 even at the quietest time — and cover peaks with On-Demand and Spot. Review coverage and utilization monthly.

### 4. Spot

For fault-tolerant workloads — stateless services behind load balancers, CI runners, batch jobs, and Kubernetes worker nodes with Karpenter — Spot offers the deepest discounts. Diversify instance types and AZs, and handle two-minute interruption notices. See [Spot Instances](04-ec2-and-auto-scaling.md#spot-instances).

### 5. Graviton

ARM-based Graviton instances usually cost less than comparable x86 instances for the same workload, and often perform better. Build multi-architecture container images (`docker buildx --platform linux/amd64,linux/arm64`) and migrate stateless services first. Managed services such as RDS, ElastiCache, OpenSearch, and Lambda offer Graviton options too.

## The Hidden Costs

### Data transfer

| Traffic | Relative cost |
|---|---|
| Into AWS from the internet | Free |
| Within one AZ, over private IPs | Free |
| Between AZs in the same region | Charged in **both** directions |
| Between regions | Charged, more than cross-AZ |
| Out to the internet | Charged, tiered by volume |
| Through a NAT gateway | NAT processing charge **plus** normal transfer |

Reduce it:

- Add **S3 and DynamoDB gateway endpoints** — free, and they remove NAT processing charges for that traffic.
- Pull container images through **ECR interface endpoints** or a pull-through cache instead of through NAT.
- Serve static assets and downloads through **CloudFront**.
- Keep chatty service pairs in the same AZ where availability requirements allow (topology-aware routing in Kubernetes).

### Public IPv4 addresses

AWS charges hourly for every public IPv4 address, whether attached or idle. Put instances in private subnets behind load balancers, release unused Elastic IPs, and consider IPv6 where clients support it.

### Logs and metrics

- Set **retention on every CloudWatch log group**.
- Don't log at `DEBUG` in production by default.
- Watch custom metric counts — high-cardinality dimensions like per-customer or per-request IDs multiply metric costs.
- Archive long-term logs to S3 with lifecycle rules.

### Storage

- Migrate **gp2 to gp3** volumes.
- Delete snapshots and AMIs from old deployments, and expire noncurrent S3 versions.
- Use **S3 Intelligent-Tiering** for data with unknown access patterns.

### Idle managed resources

NAT gateways, load balancers, EKS control planes, RDS instances, OpenSearch domains, and interface endpoints bill hourly with zero traffic. Consolidate low-traffic environments, share NAT gateways in non-production, and delete lab stacks promptly.

## Make Cost an Engineering Practice

- **Show teams their own costs** in a weekly or monthly report by tag.
- **Estimate cost in pull requests** for infrastructure changes with tools such as Infracost, so a `db.r7g.8xlarge` gets questioned before it's merged.
- **Track unit costs** — cost per order, per active user, per GB processed. Total spend should grow slower than the business metric.
- **Review anomalies within a day**, while the change that caused them is still fresh.
- Treat cost like performance: a non-functional requirement, reviewed continuously, owned by the teams that create it.

## Common Mistakes

- Buying Savings Plans before rightsizing, and locking in waste for three years.
- No tags, so every cost conversation starts with "who owns this?"
- Large S3, ECR, or API traffic through NAT gateways instead of VPC endpoints.
- Non-production environments running 24/7 at production size.
- Log groups with infinite retention and debug logging in production.
- Treating Cost Explorer's "EC2 – Other" as unexplainable instead of breaking it down by usage type.
- Optimizing tiny line items while ignoring the top three services that make up most of the bill.

## Interview Questions

- How would you find out why an AWS bill increased 40% last month?
- When would you choose Compute Savings Plans over EC2 Instance Savings Plans or Reserved Instances?
- What are the most common sources of unexpected AWS data transfer costs, and how do you reduce them?
- How would you make engineering teams accountable for the cost of their services?
- What should you do before committing to a Savings Plan?

## Next

You've finished the AWS track. Continue to [SRE Practices](../../sre/index.md) to run these systems reliably, or to [Security](../../security/index.md).
