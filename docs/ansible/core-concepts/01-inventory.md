---
title: "Ansible Inventory Explained: Static and Dynamic"
icon: lucide/list-tree
description: "An Ansible inventory is the list of hosts you manage, in INI or YAML, organized into groups so a playbook can target exactly the machines you mean."
tags:
  - Ansible
  - Core Concepts
  - Inventory
---

# Inventory

An inventory is the list of hosts Ansible manages, written in INI or YAML and organized into groups, so a play can target `webservers` instead of naming machines one by one.

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

`hosts: web` now targets both web servers. `[production:children]` groups groups — `hosts: production` targets all three hosts, because it contains both the `web` and `db` groups. `[web:vars]` sets a variable for every host in the group.

A real inventory usually groups each host **two ways at once**: by what it does (`web`, `db`) and by where it lives (`production`, `eu_west`). Plays target the role, `--limit` narrows by location, and `group_vars/` can hold values for either axis:

```ini title="inventories/production/hosts.ini"
[web]
web-euw-01 ansible_host=10.20.1.11
web-use-01 ansible_host=10.30.1.11

[eu_west]
web-euw-01

[us_east]
web-use-01
```

```bash
ansible-playbook -i inventories/production site.yml --limit 'web:&eu_west'   # web hosts in eu_west only
```

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
