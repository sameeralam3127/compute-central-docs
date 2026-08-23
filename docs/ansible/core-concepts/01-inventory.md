---
title: "Ansible Inventory Explained: Static and Dynamic"
icon: lucide/list-tree
description: Ansible inventory — static INI and YAML formats, groups and children, host patterns, ranges, and when to move to dynamic inventory.
tags:
  - Ansible
  - Core Concepts
  - Inventory
---

# Inventory

## What You'll Learn

- Static inventory in INI and YAML form
- Groups, children, and how patterns select hosts
- When a static file stops being enough

## Why This Matters

Every run starts by resolving `hosts:` against an inventory. Get the inventory wrong and a playbook can run flawlessly — against the wrong machines, or none at all.

## Minimal Example

```ini title="inventory.ini"
web01 ansible_host=10.0.1.10
web02 ansible_host=10.0.1.11
```

## Practical Example — Groups

```ini title="inventory.ini"
[web]
web01 ansible_host=10.0.1.10
web02 ansible_host=10.0.1.11

[db]
db01 ansible_host=10.0.1.20

[production:children]
web
db

[web:vars]
http_port=80
```

`hosts: web` now targets both web servers. `[production:children]` groups groups — `hosts: production` targets all four... two, in this case (`web` + `db`). `[web:vars]` sets a variable for every host in the group.

## The Same Inventory in YAML

```yaml title="inventory.yml"
all:
  children:
    web:
      hosts:
        web01:
          ansible_host: 10.0.1.10
        web02:
          ansible_host: 10.0.1.11
      vars:
        http_port: 80
    db:
      hosts:
        db01:
          ansible_host: 10.0.1.20
```

Functionally identical to the INI version above. YAML tends to win once nested group variables get complex; INI stays more compact for small, flat inventories.

## Host Patterns

| Pattern | Meaning |
|---|---|
| `all` | Every host in inventory |
| `web` | Every host in the `web` group |
| `web:db` | Union — hosts in `web` OR `db` |
| `web:!staging` | Exclusion — `web` hosts NOT in `staging` |
| `web:&datacenter1` | Intersection — `web` hosts also in `datacenter1` |
| `web[0]` | The first host in the group, by inventory order |
| `www[01:50].example.com` | Numeric range expansion |

```bash
ansible-inventory --graph
```

is the fastest way to check your mental model of the inventory matches Ansible's — run it whenever a pattern isn't matching what you expect.

## Common Mistakes

- Assuming `web:db` intersects instead of unions — it's the *opposite* of `&`.
- Stale static inventory that no longer matches real infrastructure — the moment servers autoscale, a static file starts lying.
- Overlapping group variable definitions producing confusing precedence results — see [Variable Precedence](../variables-and-data/02-variable-precedence.md).

## Beyond Static Files: Dynamic Inventory

A hand-maintained file doesn't survive autoscaling or a team bigger than one person. **Dynamic inventory plugins** (`amazon.aws.aws_ec2`, `azure.azcollection.azure_rm`, `kubernetes.core.k8s`) query a live API at run time and build the host list automatically, so the inventory can never drift from what's actually running. Covered in full in [Dynamic Inventory](../advanced-execution/05-dynamic-inventory.md).

## Interview Questions

- What's the difference between static and dynamic inventory, and when do you reach for each?
- How does the `web:!staging` pattern work?
- How would you source inventory automatically from AWS EC2?

## Next

Continue to [Ad-Hoc Commands](02-ad-hoc-commands.md).
