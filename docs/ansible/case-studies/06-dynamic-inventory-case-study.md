---
icon: lucide/refresh-cw
description: A dynamic inventory case study — sourcing hosts live from AWS EC2 by tag, grouped automatically, with cached results.
tags:
  - Ansible
  - Case Studies
  - Inventory
---

# Case Study: Dynamic Inventory

!!! info "Section status: outline"
    This case study is scoped but not yet written in full prose. The sections below define what it will cover.

## Problem

An autoscaling web tier means a static inventory file is stale within hours — inventory needs to be sourced live from AWS, grouped by tag, every run.

## What It Will Cover

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
cache_timeout: 300
```

- Reading this config field by field: `filters` scoping which instances are included, `keyed_groups` auto-creating groups like `role_web` from an EC2 tag, `compose` deriving `ansible_host`
- `ansible-inventory -i aws_ec2.yml --graph` to confirm what the plugin actually resolved
- Least-privilege IAM policy for the credentials the plugin uses — read-only `ec2:Describe*`, nothing else
- Caching (`cache: true`) to avoid an API round trip on every single run

## Interview Questions

- How does `keyed_groups` turn an EC2 tag into an Ansible inventory group automatically?
- What IAM permissions does a dynamic inventory plugin actually need, and why should they be read-only?

## Next

Continue to [API Automation with URI](07-api-automation-with-uri.md).
