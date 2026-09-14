---
title: "AWS Automation With boto3: Sessions, Paginators, and Cleanup"
icon: lucide/cloud-cog
description: "Automate AWS with boto3 — credentials and sessions, assumed roles, paginators, waiters, retries, error handling, and safe multi-region cleanup."
tags:
  - Python
  - AWS
  - boto3
---

# AWS Automation With boto3

## What You'll Learn

- How boto3 finds credentials, and how to use sessions, profiles, and assumed roles
- How to page through large result sets and wait for resources correctly
- How to configure retries and handle AWS errors
- How to write a safe, multi-region cleanup tool with dry-run mode and tagging checks

## Clients, Resources, and Sessions

```python
import boto3

session = boto3.Session(profile_name="platform-dev", region_name="us-east-1")
ec2 = session.client("ec2")
s3 = session.client("s3")

identity = session.client("sts").get_caller_identity()
print(identity["Account"], identity["Arn"])
```

- **Clients** map one-to-one to AWS API operations and return dictionaries. They cover every service and are the recommended interface.
- **Resources** (`session.resource("s3")`) are an older object-oriented layer. AWS isn't adding new resource interfaces, so prefer clients for new code.
- A **session** holds credentials and a region. Create clients from an explicit session in tools that work across accounts or regions, rather than relying on global defaults.

## How Credentials Are Found

boto3 checks, in order:

1. Credentials passed explicitly to the session or client (avoid)
2. Environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`
3. The shared config and credentials files, including SSO and `assume_role` profiles (`AWS_PROFILE`)
4. Container credentials (ECS task roles, EKS Pod Identity)
5. Instance metadata (EC2 instance profiles)

On your laptop, use IAM Identity Center (SSO) profiles. In AWS, use roles attached to the compute. In CI, use OIDC federation. **Long-lived access keys in code or config files should never be needed.** See [AWS IAM](../../cloud/aws/02-iam.md).

```bash
aws sso login --profile platform-dev
AWS_PROFILE=platform-dev uv run opsctl find-unused-volumes
```

### Assume a role in another account

```python
def assumed_session(role_arn: str, region: str, session_name: str = "opsctl") -> boto3.Session:
    creds = boto3.client("sts").assume_role(
        RoleArn=role_arn,
        RoleSessionName=session_name,
        DurationSeconds=3600,
    )["Credentials"]
    return boto3.Session(
        aws_access_key_id=creds["AccessKeyId"],
        aws_secret_access_key=creds["SecretAccessKey"],
        aws_session_token=creds["SessionToken"],
        region_name=region,
    )

prod = assumed_session("arn:aws:iam::123456789012:role/ReadOnlyAudit", "eu-west-1")
```

## Paginators

Most `List*` and `Describe*` calls return one page — often 50 to 1,000 items — plus a token for the next page. Code that ignores the token silently misses resources.

```python
ec2 = session.client("ec2")

paginator = ec2.get_paginator("describe_instances")
pages = paginator.paginate(
    Filters=[{"Name": "instance-state-name", "Values": ["running"]}],
    PaginationConfig={"PageSize": 200},
)

for page in pages:
    for reservation in page["Reservations"]:
        for instance in reservation["Instances"]:
            print(instance["InstanceId"], instance["InstanceType"])
```

JMESPath expressions can flatten results:

```python
instance_ids = list(pages.search("Reservations[].Instances[].InstanceId"))
```

Check whether an operation supports pagination with `ec2.can_paginate("describe_volumes")`.

## Waiters

Many operations return immediately while the resource changes state in the background. Waiters poll until it's ready:

```python
ec2.start_instances(InstanceIds=["i-0abc1234def567890"])
ec2.get_waiter("instance_running").wait(
    InstanceIds=["i-0abc1234def567890"],
    WaiterConfig={"Delay": 10, "MaxAttempts": 30},   # up to 5 minutes
)
```

Waiters exist for EC2, RDS, EKS, CloudFormation, ECS, and more. Prefer them to hand-written `sleep` loops.

## Retries and Timeouts

AWS throttles API calls. Configure retries on every client in automation that makes many calls:

```python
from botocore.config import Config

config = Config(
    retries={"max_attempts": 10, "mode": "adaptive"},  # "standard" or "adaptive" (client-side rate limiting)
    connect_timeout=5,
    read_timeout=60,
    user_agent_extra="opsctl/0.1",
)
ec2 = session.client("ec2", config=config)
```

## Handling Errors

```python
from botocore.exceptions import ClientError, NoCredentialsError

try:
    s3.head_bucket(Bucket="acme-artifacts-prod")
except ClientError as exc:
    code = exc.response["Error"]["Code"]
    if code in ("404", "NoSuchBucket"):
        print("bucket does not exist")
    elif code in ("403", "AccessDenied"):
        print("bucket exists but you can't access it")
    else:
        raise
except NoCredentialsError:
    raise SystemExit("no AWS credentials found — run 'aws sso login' or set AWS_PROFILE")
```

Many services also expose modeled exceptions, which read more clearly:

```python
try:
    ssm.get_parameter(Name="/orders/prod/db-url", WithDecryption=True)
except ssm.exceptions.ParameterNotFound:
    ...
```

## A Real Tool: Find and Clean Up Unused EBS Volumes

Unattached EBS volumes keep costing money after instances are terminated. This tool finds them across regions, respects a protection tag, and deletes only with explicit confirmation.

```python title="src/opsctl/aws_cleanup.py"
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

log = logging.getLogger(__name__)
CONFIG = Config(retries={"max_attempts": 10, "mode": "standard"})
PROTECT_TAG = "opsctl:keep"


@dataclass(frozen=True)
class Volume:
    region: str
    volume_id: str
    size_gib: int
    created: datetime
    name: str


def enabled_regions(session: boto3.Session) -> list[str]:
    ec2 = session.client("ec2", region_name="us-east-1", config=CONFIG)
    resp = ec2.describe_regions(
        Filters=[{"Name": "opt-in-status", "Values": ["opt-in-not-required", "opted-in"]}]
    )
    return sorted(r["RegionName"] for r in resp["Regions"])


def find_unattached_volumes(session: boto3.Session, region: str, min_age_days: int) -> list[Volume]:
    ec2 = session.client("ec2", region_name=region, config=CONFIG)
    cutoff = datetime.now(UTC) - timedelta(days=min_age_days)
    found: list[Volume] = []

    pages = ec2.get_paginator("describe_volumes").paginate(
        Filters=[{"Name": "status", "Values": ["available"]}]  # "available" means not attached
    )
    for page in pages:
        for v in page["Volumes"]:
            tags = {t["Key"]: t["Value"] for t in v.get("Tags", [])}
            if PROTECT_TAG in tags or v["CreateTime"] > cutoff:
                continue
            found.append(
                Volume(region, v["VolumeId"], v["Size"], v["CreateTime"], tags.get("Name", ""))
            )
    return found


def delete_volume(session: boto3.Session, vol: Volume, dry_run: bool) -> bool:
    ec2 = session.client("ec2", region_name=vol.region, config=CONFIG)
    try:
        ec2.delete_volume(VolumeId=vol.volume_id, DryRun=dry_run)
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        if code == "DryRunOperation":  # permissions are fine; nothing was deleted
            log.info("dry-run: would delete %s in %s", vol.volume_id, vol.region)
            return True
        if code == "VolumeInUse":  # attached since we listed it
            log.warning("%s is now in use, skipping", vol.volume_id)
            return False
        raise
    log.info("deleted %s (%d GiB) in %s", vol.volume_id, vol.size_gib, vol.region)
    return True
```

```python title="src/opsctl/cli.py (excerpt)"
@app.command("unused-volumes")
def unused_volumes(
    min_age_days: int = 14,
    delete: Annotated[bool, typer.Option("--delete", help="Actually delete the volumes.")] = False,
    region: Annotated[list[str] | None, typer.Option(help="Limit to these regions.")] = None,
) -> None:
    """List unattached EBS volumes older than MIN_AGE_DAYS; delete with --delete."""
    session = boto3.Session()
    regions = region or aws_cleanup.enabled_regions(session)
    volumes = [v for r in regions for v in aws_cleanup.find_unattached_volumes(session, r, min_age_days)]

    total = sum(v.size_gib for v in volumes)
    for v in volumes:
        typer.echo(f"{v.region:15} {v.volume_id:22} {v.size_gib:>6} GiB  {v.created:%Y-%m-%d}  {v.name}")
    typer.echo(f"{len(volumes)} volumes, {total} GiB")

    if delete and volumes:
        typer.confirm(f"Delete {len(volumes)} volumes?", abort=True)
        for v in volumes:
            aws_cleanup.delete_volume(session, v, dry_run=False)
    elif volumes:
        for v in volumes:
            aws_cleanup.delete_volume(session, v, dry_run=True)   # verifies delete permission
```

```bash
AWS_PROFILE=platform-dev uv run opsctl unused-volumes --min-age-days 30
AWS_PROFILE=platform-dev uv run opsctl unused-volumes --region eu-west-1 --delete
```

What makes this safe:

- **Read-only by default.** Deleting needs `--delete` and an interactive confirmation.
- **EC2 `DryRun`** proves the role has permission without changing anything.
- **An age threshold** avoids deleting a volume that was detached a minute ago during maintenance.
- **A protection tag** gives owners an opt-out.
- **Handles races**: a volume attached between listing and deleting is skipped, not an error.

## Least-Privilege Permissions for the Tool

```json title="opsctl-volume-cleanup-policy.json"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadVolumes",
      "Effect": "Allow",
      "Action": ["ec2:DescribeVolumes", "ec2:DescribeRegions"],
      "Resource": "*"
    },
    {
      "Sid": "DeleteUnprotectedVolumes",
      "Effect": "Allow",
      "Action": "ec2:DeleteVolume",
      "Resource": "arn:aws:ec2:*:123456789012:volume/*",
      "Condition": { "Null": { "aws:ResourceTag/opsctl:keep": "true" } }
    }
  ]
}
```

The condition means IAM itself refuses to delete a volume carrying the protection tag, even if the code has a bug.

## Common Mistakes

- Hard-coding access keys in scripts, or committing a credentials file.
- Ignoring pagination and acting on only the first page of results.
- `time.sleep` loops instead of waiters, with no maximum wait.
- No retry configuration, so bulk jobs fail on the first throttling error.
- Scanning only the default region and missing resources everywhere else.
- Destructive scripts with no dry-run, no age threshold, and no protection tag.
- Granting the automation `AdministratorAccess` because the exact permissions were never worked out.

## Interview Questions

- How does boto3 find credentials? How should credentials be provided on EC2, in EKS, and in CI?
- Why do paginators matter? Give an example of a bug caused by ignoring them.
- What does EC2's `DryRun` parameter do, and how would you use it in automation?
- How would you write a script that safely deletes unused resources across all regions and accounts?
- How do you handle AWS API throttling in a script that makes thousands of calls?

## Next

Continue to [Files, Config, and Templates](05-files-config-and-templates.md).
