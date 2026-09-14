---
title: "AWS S3 and Storage: Bucket Security, Lifecycle, EBS, and EFS"
icon: lucide/archive
description: "Use Amazon S3 safely — Block Public Access, bucket policies, encryption, versioning, Object Lock, lifecycle rules, and when to use EBS or EFS."
tags:
  - AWS
  - S3
  - Storage
---

# S3 and Storage

## What You'll Learn

- How S3 buckets and objects work, and the security defaults that matter
- How to write bucket policies that enforce TLS, encryption, and private access
- How versioning, Object Lock, and replication protect data
- How lifecycle rules and storage classes control cost
- When to use S3, EBS, or EFS

## S3 Basics

S3 stores **objects** (files plus metadata) in **buckets**. There are no real directories — `logs/2026/09/14/app.log` is one key, and "folders" are just shared prefixes.

- Bucket names are globally unique and part of DNS: `https://acme-order-exports.s3.eu-west-1.amazonaws.com/daily/2026-09-14.csv`.
- Objects can be up to 5 TB; use multipart upload above about 100 MB (the CLI does this automatically).
- S3 provides strong read-after-write consistency for all operations.

```bash
aws s3 mb s3://acme-order-exports-111111111111 --region eu-west-1
aws s3 cp report.csv s3://acme-order-exports-111111111111/daily/
aws s3 sync ./build s3://acme-static-site-111111111111/ --delete
aws s3 ls s3://acme-order-exports-111111111111/daily/ --human-readable --summarize
```

## Security Defaults

New buckets have:

- **Block Public Access** enabled
- **ACLs disabled** (Object Ownership: bucket owner enforced)
- **Server-side encryption with S3-managed keys (SSE-S3)** applied to every new object

Keep all three. Enable **account-level** Block Public Access too, so nobody can accidentally make a bucket public:

```bash
aws s3control put-public-access-block --account-id 111111111111 \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

To serve a public website, put **CloudFront** in front of a private bucket with Origin Access Control instead of making the bucket public.

## Bucket Policies

```json title="bucket-policy.json"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::acme-order-exports-111111111111",
        "arn:aws:s3:::acme-order-exports-111111111111/*"
      ],
      "Condition": { "Bool": { "aws:SecureTransport": "false" } }
    },
    {
      "Sid": "DenyAccessOutsideOrganization",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::acme-order-exports-111111111111",
        "arn:aws:s3:::acme-order-exports-111111111111/*"
      ],
      "Condition": {
        "StringNotEqualsIfExists": { "aws:PrincipalOrgID": "o-abc123xyz9" },
        "BoolIfExists": { "aws:PrincipalIsAWSService": "false" }
      }
    },
    {
      "Sid": "AllowAnalyticsReadOnly",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::333333333333:role/analytics-etl" },
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::acme-order-exports-111111111111",
        "arn:aws:s3:::acme-order-exports-111111111111/daily/*"
      ]
    }
  ]
}
```

Deny statements with conditions act as guardrails that no identity policy can override.

## Encryption

| Option | Keys managed by | Use when |
|---|---|---|
| **SSE-S3** | S3 | Default; fine for most data |
| **SSE-KMS** | AWS KMS, with a key you control | You need key policies, audit of every decrypt in CloudTrail, or the ability to revoke access by disabling the key |
| **DSSE-KMS** | KMS, two layers | Specific compliance requirements |
| **Client-side** | You | Data must be encrypted before it leaves your application |

With SSE-KMS, enable **S3 Bucket Keys** to cut KMS request costs substantially, and remember every reader also needs `kms:Decrypt` on the key.

## Versioning, Object Lock, and Replication

```hcl title="Terraform"
resource "aws_s3_bucket_versioning" "exports" {
  bucket = aws_s3_bucket.exports.id
  versioning_configuration { status = "Enabled" }
}
```

- **Versioning** keeps every version of every object. A delete adds a delete marker instead of destroying data, and an overwrite keeps the old version. It's the undo button for accidental deletes and ransomware.
- **Object Lock** (WORM) prevents deletion or overwrite for a retention period. In **compliance mode**, not even the root user can shorten it. Use it for backups and audit logs.
- **Replication** copies objects to another bucket — **Cross-Region Replication** for disaster recovery, or Same-Region Replication to a separate account for isolation from a compromised account.

## Lifecycle Rules and Storage Classes

| Class | Retrieval | Good for |
|---|---|---|
| S3 Standard | Immediate | Frequently accessed data |
| **S3 Intelligent-Tiering** | Immediate for frequent/infrequent tiers | Unknown or changing access patterns — moves objects automatically |
| S3 Standard-IA, One Zone-IA | Immediate, per-GB retrieval fee | Infrequently read data; One Zone is not AZ-resilient |
| S3 Glacier Instant Retrieval | Milliseconds | Archives read a few times a year |
| S3 Glacier Flexible Retrieval | Minutes to hours | Backups |
| S3 Glacier Deep Archive | Up to 12–48 hours | Long-term compliance retention |

```hcl
resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "logs-retention"
    status = "Enabled"
    filter { prefix = "alb/" }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    transition {
      days          = 90
      storage_class = "GLACIER_IR"
    }
    expiration { days = 400 }

    noncurrent_version_expiration { noncurrent_days = 30 }
  }

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload { days_after_initiation = 7 }
  }
}
```

The last two settings prevent classic hidden costs: old noncurrent versions piling up forever in versioned buckets, and incomplete multipart uploads that are billed but invisible in normal listings.

Minimum storage durations and retrieval fees apply to infrequent-access and archive classes — moving many small, short-lived objects to them can cost more, not less. **S3 Storage Lens** shows where storage and cost are going.

## Presigned URLs

Grant temporary access to one object without making anything public:

```bash
aws s3 presign s3://acme-order-exports-111111111111/daily/2026-09-14.csv --expires-in 900
```

```python
import boto3
s3 = boto3.client("s3", region_name="eu-west-1")
url = s3.generate_presigned_url(
    "get_object",
    Params={"Bucket": "acme-order-exports-111111111111", "Key": "daily/2026-09-14.csv"},
    ExpiresIn=900,
)
```

A presigned URL carries the permissions of the credentials that signed it, and it can't outlive those credentials' session.

## EBS and EFS

| | S3 | EBS | EFS |
|---|---|---|---|
| Type | Object storage over HTTP | Block device for one instance | Shared NFS file system |
| Attach to | Anything with network access and IAM | One EC2 instance (in one AZ), except io2 Multi-Attach | Many instances, containers, and Lambdas across AZs |
| Durability model | Across AZs | Within one AZ; snapshots to S3 | Across AZs (Standard) |
| Use for | Artifacts, backups, data lakes, static assets, logs | Boot disks, databases on EC2 | Shared content, home directories, legacy apps needing a POSIX file system |

For Kubernetes, EBS volumes back `ReadWriteOnce` persistent volumes, and EFS backs `ReadWriteMany`. See [StorageClasses and Dynamic Provisioning](../../kubernetes/storage/03-storageclasses-and-dynamic-provisioning.md).

## Common Mistakes

- Disabling Block Public Access to host a website, instead of CloudFront with a private bucket.
- Versioning enabled with no lifecycle rule for noncurrent versions, and storage costs growing forever.
- Storing backups in the same account and region as the data, with no Object Lock or replication.
- Using SSE-KMS without Bucket Keys on very busy buckets and paying for millions of KMS requests.
- Moving millions of tiny objects to archive classes and paying more in per-object and minimum-duration charges.
- Treating S3 like a file system: renaming "folders" means copying every object.

## Interview Questions

- How would you make sure no S3 bucket in an account can become public?
- Write a bucket policy that enforces TLS and restricts access to your organization.
- How do versioning and Object Lock protect against accidental deletion and ransomware?
- Design a lifecycle policy for application logs that must be kept for one year.
- When would you use EFS instead of EBS or S3?

## Next

Continue to [Containers: ECS and EKS](07-containers-ecs-and-eks.md).
