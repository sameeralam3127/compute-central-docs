---
title: "AWS EC2 and Auto Scaling: Launch Templates, IMDSv2, and Spot"
icon: lucide/server
description: "Run EC2 the modern way — instance types, AMIs, launch templates, IMDSv2, Session Manager, gp3 volumes, Auto Scaling groups, and Spot."
tags:
  - AWS
  - EC2
  - Auto Scaling
---

# EC2 and Auto Scaling

## What You'll Learn

- How to choose instance types, AMIs, and EBS volumes
- How to launch instances from launch templates with user data and IMDSv2
- How to reach instances with Session Manager instead of SSH and bastion hosts
- How Auto Scaling groups keep capacity healthy, roll out changes, and mix Spot capacity

## Choosing an Instance Type

Instance names encode their purpose: `m7g.large` is family `m` (general purpose), generation `7`, `g` for Graviton (ARM), size `large`.

| Family | Optimized for | Examples |
|---|---|---|
| `t` | Burstable, low baseline CPU | Small dev servers, bastions |
| `m` | General purpose, balanced | Web apps, most services |
| `c` | Compute | CPU-heavy APIs, batch, CI runners |
| `r`, `x` | Memory | Caches, in-memory databases, JVM-heavy apps |
| `i`, `d` | Local NVMe storage | Databases and search needing fast local disk |
| `g`, `p` | GPUs | ML training and inference |

Suffixes to know: `g` = Graviton (ARM), `a` = AMD, `i` = Intel, `d` = local NVMe, `n` = enhanced networking.

**Graviton** instances typically cost less than comparable x86 instances for the same performance. Most interpreted languages and containers built for `arm64` run unchanged.

!!! warning "Burstable `t` instances"
    `t` instances earn CPU credits while idle and spend them under load. With `unlimited` mode off, a busy instance drops to its baseline CPU when credits run out — showing up as high CPU **steal** time and sudden slowness. Watch `CPUCreditBalance`.

## AMIs

An Amazon Machine Image is the root disk template for an instance.

- Use current, vendor-maintained images: Amazon Linux 2023, Ubuntu LTS, or Bottlerocket for containers.
- Look up the latest AMI through a public SSM parameter instead of hard-coding IDs, which differ per region:

```bash
aws ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 \
  --query Parameter.Value --output text
```

- For fleets, build your own **golden AMI** with Packer or EC2 Image Builder: patched, hardened, with agents preinstalled. Replace instances with a new AMI instead of patching them in place.

## Launch Templates

A launch template captures everything needed to launch an instance, and it's versioned.

```hcl title="Terraform"
data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

resource "aws_launch_template" "orders" {
  name_prefix   = "orders-api-"
  image_id      = data.aws_ssm_parameter.al2023.value
  instance_type = "m7g.large"

  iam_instance_profile {
    name = aws_iam_instance_profile.orders.name
  }

  vpc_security_group_ids = [aws_security_group.app.id]

  metadata_options {
    http_tokens                 = "required"   # IMDSv2 only
    http_put_response_hop_limit = 1            # containers on the host can't reach metadata through an extra hop
  }

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_type           = "gp3"
      volume_size           = 30
      encrypted             = true
      delete_on_termination = true
    }
  }

  user_data = base64encode(templatefile("${path.module}/user-data.sh", {
    app_version = var.app_version
  }))

  tag_specifications {
    resource_type = "instance"
    tags = { Service = "orders-api", Environment = "prod" }
  }
}
```

### User data

User data runs once, as root, at first boot:

```bash title="user-data.sh"
#!/bin/bash
set -euo pipefail
dnf install -y amazon-cloudwatch-agent
aws s3 cp "s3://acme-artifacts/orders-api/${app_version}/orders-api.tar.gz" /tmp/
mkdir -p /opt/orders-api && tar xzf /tmp/orders-api.tar.gz -C /opt/orders-api
systemctl enable --now orders-api
```

Keep user data short: bake dependencies into the AMI, and pull only the application version at boot. Debug it with `/var/log/cloud-init-output.log`.

## IMDSv2

The instance metadata service at `169.254.169.254` hands out the instance role's credentials. IMDSv1 answers any `GET` request, so a server-side request forgery bug in an application could leak credentials. **IMDSv2** requires a session token obtained with a `PUT`, which SSRF attacks generally can't perform.

```bash
TOKEN=$(curl -sX PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 300")
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id
```

Require IMDSv2 on every launch template, and set it as the account default:

```bash
aws ec2 modify-instance-metadata-defaults --region eu-west-1 --http-tokens required --http-put-response-hop-limit 1
```

## Access Without SSH: Session Manager

**AWS Systems Manager Session Manager** gives shell access through the SSM agent (preinstalled on Amazon Linux and recent Ubuntu AMIs) using IAM — no open inbound ports, no SSH keys, no bastion hosts, and every session is logged.

Requirements: the instance role includes `AmazonSSMManagedInstanceCore`, and the instance can reach the SSM endpoints (through NAT or interface endpoints).

```bash
aws ssm start-session --target i-0abc1234def567890

# Port forwarding to a private database through an instance
aws ssm start-session --target i-0abc1234def567890 \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["orders.cluster-abc.eu-west-1.rds.amazonaws.com"],"portNumber":["5432"],"localPortNumber":["5432"]}'
```

## EBS Volumes

| Type | Use | Notes |
|---|---|---|
| **gp3** | Default for almost everything | 3,000 IOPS and 125 MB/s baseline regardless of size; raise IOPS and throughput independently |
| gp2 | Legacy | IOPS tied to size — migrate to gp3, usually cheaper for the same performance |
| io2 Block Express | Latency-sensitive databases | Provisioned IOPS, highest durability |
| st1, sc1 | Large sequential throughput, cold data | HDD, not for boot volumes |

- Enable **EBS encryption by default** per region: `aws ec2 enable-ebs-encryption-by-default`.
- Snapshots are incremental and stored in S3. Automate them with **Data Lifecycle Manager** or **AWS Backup**.
- Growing a volume is online — see [Grow a Cloud Disk Without Downtime](../../foundations/linux/04-storage-disks-and-lvm.md#grow-a-cloud-disk-without-downtime).

## Auto Scaling Groups

An Auto Scaling group (ASG) keeps a fleet at the desired size across AZs, replaces unhealthy instances, and scales on demand.

```hcl
resource "aws_autoscaling_group" "orders" {
  name_prefix         = "orders-api-"
  vpc_zone_identifier = aws_subnet.app[*].id          # spread across AZs
  min_size            = 3
  max_size            = 12
  desired_capacity    = 3

  target_group_arns         = [aws_lb_target_group.orders.arn]
  health_check_type         = "ELB"                   # replace instances that fail load balancer health checks
  health_check_grace_period = 120

  launch_template {
    id      = aws_launch_template.orders.id
    version = aws_launch_template.orders.latest_version
  }

  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 90
      instance_warmup        = 120
      auto_rollback          = true
    }
  }
}

resource "aws_autoscaling_policy" "cpu" {
  name                   = "target-cpu-50"
  autoscaling_group_name = aws_autoscaling_group.orders.name
  policy_type            = "TargetTrackingScaling"
  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 50
  }
}
```

Key points:

- **`health_check_type = "ELB"`** — the default `EC2` check only notices dead hardware, not a crashed application.
- **Target tracking** keeps a metric near a target, like a thermostat. Prefer it to step scaling. For request-driven services, `ALBRequestCountPerTarget` often tracks load better than CPU.
- **Instance refresh** rolls a new launch template version through the fleet with health checks and automatic rollback — a safe deployment mechanism for instance-based services.
- **Lifecycle hooks** pause launch or termination so you can register, drain, or ship logs.

## Spot Instances

Spot capacity costs far less than On-Demand, but AWS can reclaim it with a **two-minute warning**.

Good for stateless services behind load balancers, CI runners, batch jobs, and Kubernetes worker nodes. Not for single instances holding state.

```hcl
  mixed_instances_policy {
    instances_distribution {
      on_demand_base_capacity                  = 2      # always keep 2 On-Demand
      on_demand_percentage_above_base_capacity = 25     # then 25% On-Demand, 75% Spot
      spot_allocation_strategy                 = "price-capacity-optimized"
    }
    launch_template {
      launch_template_specification {
        launch_template_id = aws_launch_template.orders.id
        version            = "$Latest"
      }
      override { instance_type = "m7g.large" }
      override { instance_type = "m6g.large" }
      override { instance_type = "c7g.xlarge" }
    }
  }
```

Diversify across several instance types and all AZs so a shortage in one pool doesn't take out your capacity. Handle the interruption notice by draining work — ASG **capacity rebalancing** launches replacements proactively when AWS signals elevated interruption risk.

## Common Mistakes

- Hard-coded AMI IDs that differ by region and go stale with unpatched images.
- IMDSv1 still allowed, leaving instance credentials exposed to SSRF bugs.
- Port 22 open to the internet with shared SSH keys instead of Session Manager.
- ASGs using the default `EC2` health check, so crashed apps keep receiving traffic.
- gp2 volumes sized up just to get more IOPS, instead of gp3.
- Spot fleets using a single instance type in a single AZ.
- Burstable instances in production that silently throttle when CPU credits run out.

## Interview Questions

- How do you choose between `m`, `c`, and `r` instance families? What does the `g` suffix mean?
- Why require IMDSv2?
- How would you give engineers shell access to private instances without SSH or a bastion?
- How does an Auto Scaling group decide to replace an instance? Why use ELB health checks?
- How would you roll out a new AMI to a fleet with zero downtime?
- When are Spot instances a good fit, and how do you design for interruptions?

## Next

Continue to [Load Balancing and Route 53](05-load-balancing-and-route53.md).
