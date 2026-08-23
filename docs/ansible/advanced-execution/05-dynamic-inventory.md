---
icon: lucide/refresh-cw
description: Dynamic inventory plugins for Ansible — sourcing hosts live from AWS, Azure, and Kubernetes instead of maintaining a static file, with a full worked AWS EC2 example.
tags:
  - Ansible
  - Advanced Execution
  - Inventory
---

# Dynamic Inventory

## What You'll Learn

- Why a static inventory file can't keep up with real infrastructure
- Inventory plugins vs. legacy inventory scripts
- A complete, working AWS EC2 dynamic inventory configuration

## Why This Exists

A hand-maintained inventory file can't keep up with autoscaling infrastructure — instances come and go, IPs change, and a static `inventory.ini` is stale within hours. Dynamic inventory **plugins** query a live source of truth (a cloud API, a Kubernetes API) at run time instead, so the inventory literally cannot drift from what's actually running. This is the same problem [Inventory](../core-concepts/01-inventory.md) introduces and defers here.

## Plugins, Not Scripts

Modern Ansible sources dynamic inventory through YAML-configured **inventory plugins** (`amazon.aws.aws_ec2`, `azure.azcollection.azure_rm`, `kubernetes.core.k8s`) — the legacy alternative, inventory **scripts** (arbitrary executables that print JSON), still works but is largely superseded; plugins are declarative, don't require writing and maintaining a custom script, and integrate with Ansible's caching and `compose`/`keyed_groups` machinery natively.

## A Complete AWS EC2 Example

```yaml title="inventories/production/aws_ec2.yml"
plugin: amazon.aws.aws_ec2
regions:
  - us-east-1
filters:
  tag:Environment: production
  instance-state-name: running
keyed_groups:
  - key: tags.Role
    prefix: role
compose:
  ansible_host: public_ip_address
cache: true
cache_plugin: jsonfile
cache_connection: /tmp/ansible_inventory_cache
cache_timeout: 300
```

Reading it field by field:

- `plugin: amazon.aws.aws_ec2` — selects the plugin; the filename must end in `aws_ec2.yml`/`aws_ec2.yaml` for Ansible to recognize it as this plugin's config.
- `filters` — scopes which EC2 instances are included at all; here, only running instances tagged `Environment: production`.
- `keyed_groups` — auto-creates inventory groups from an EC2 tag. An instance tagged `Role: web` automatically lands in a group called `role_web` — no manual group maintenance.
- `compose` — derives a variable from an existing attribute; here, `ansible_host` is set to the instance's public IP so Ansible knows how to connect without a separate lookup.
- `cache` — caches the resolved inventory (distinct from [fact caching](02-fact-caching.md)) so every single run doesn't cost a fresh API round trip.

## Inspecting What It Resolved

```bash
ansible-inventory -i inventories/production/aws_ec2.yml --graph
```

```text
@all:
  |--@role_web:
  |  |--i-0abc123def456
  |  |--i-0def456abc789
  |--@role_db:
  |  |--i-0123456789abc
```

Run this before trusting a dynamic source against a real playbook — the fastest way to confirm the plugin resolved what you expect, including that `keyed_groups` actually produced the groups you intended.

## Least-Privilege Credentials

The IAM policy (or Azure/GCP equivalent) behind a dynamic inventory plugin only ever needs to **list and describe** resources — never write access:

```json title="Minimal IAM policy for aws_ec2 inventory"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ec2:DescribeInstances", "ec2:DescribeTags"],
      "Resource": "*"
    }
  ]
}
```

Granting broader access "to be safe" is a common and unnecessary mistake — the plugin never modifies anything.

## Common Mistakes

- Granting the inventory plugin's cloud credentials broad write access when it only ever needs to **list** resources.
- Not enabling `cache`, adding real latency (an API round trip) to the start of every single run against a large fleet.
- Filtering too loosely (or not at all), pulling in every instance in an account instead of scoping to the environment/tag actually being managed.
- Forgetting the filename convention (`*_aws_ec2.yml`) — Ansible identifies which plugin to use partly from the filename suffix.

## Interview Questions

- How would you source inventory automatically from AWS EC2 instead of maintaining a static file?
- How does `keyed_groups` turn a cloud tag into an Ansible inventory group automatically?
- What credentials does a dynamic inventory plugin need, and how should they be scoped?

## Full worked example

See [Case Study: Dynamic Inventory](../case-studies/06-dynamic-inventory-case-study.md) for the same plugin used end-to-end in a real playbook run.

## Next

Continue to [Production Engineering](../production-engineering/index.md).
