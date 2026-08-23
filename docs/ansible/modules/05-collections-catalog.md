---
title: "Ansible Collections Catalog by Domain"
icon: lucide/library
description: Beyond ansible.builtin — a map of the major Ansible collections by domain (cloud, network, containers, databases, Windows), and where to find the authoritative module index.
tags:
  - Ansible
  - Modules
  - Collections
---

# Collections Catalog

## Why This Exists

`ansible.builtin` (installed with `ansible-core` itself) covers files, packages, services, users, and the other modules referenced throughout [Modules](index.md) — but it deliberately doesn't include cloud provider APIs, network vendor integrations, or most database-specific modules. Those live in separate, independently versioned **collections** (see [Collections](../collections/index.md)) that you install on top of `ansible-core` for exactly the domain you need.

## The Authoritative Source

The single source of truth for "does a module exist for X" is Ansible's own collections index:

[docs.ansible.com — Collections Index by Module](https://docs.ansible.com/projects/ansible/latest/collections/index_module.html)

Check it before writing a `shell`/`command` workaround (see [Command vs. Shell](01-command-vs-shell-vs-raw-vs-script.md)) or a [custom module](../build-your-own/01-build-a-custom-module.md) — a purpose-built module for the exact API or tool you're targeting exists more often than expected.

## Major Collections by Domain

| Domain | Collection | Covers |
|---|---|---|
| Core (bundled with `ansible-core`) | `ansible.builtin` | Files, packages, services, users, command execution, `uri`, `debug` |
| POSIX systems | `ansible.posix` | `mount`, `firewalld`, `selinux`, `sysctl`, `synchronize` |
| General community | `community.general` | A large grab-bag: `timezone`, `homebrew`, `htpasswd`, `ini_file`, and hundreds more |
| Windows | `ansible.windows` / `community.windows` | `win_*` modules — services, registry, IIS, PowerShell execution |
| AWS | `amazon.aws` / `community.aws` | EC2, S3, IAM, VPC, and the `aws_ec2` dynamic inventory plugin |
| Azure | `azure.azcollection` | Azure resource management, and the `azure_rm` dynamic inventory plugin |
| Google Cloud | `google.cloud` | GCP resource management |
| Kubernetes | `kubernetes.core` | `k8s`, `helm`, and the `k8s` dynamic inventory plugin |
| Docker | `community.docker` | Containers, images, networks, `docker_compose_v2` |
| Databases | `community.mysql`, `community.postgresql`, `community.mongodb` | Users, databases, replication, backups |
| Network devices | `ansible.netcommon`, `cisco.ios`, `arista.eos`, `juniper.junos` | Vendor-specific network device configuration and facts |
| HashiCorp | `community.hashi_vault` | Vault-backed lookups for secrets — see [Lookup and Filter Plugins](../advanced-execution/04-lookup-and-filter-plugins.md) |

## How to Use This Table

1. Identify the domain (cloud provider, database, network vendor, container runtime).
2. Install the matching collection, pinned in `requirements.yml` — see [Installing and Using Collections](../collections/02-installing-and-using-collections.md).
3. Reference modules by their full FQCN (`amazon.aws.ec2_instance`, not `ec2_instance`) — see [why FQCNs matter](../core-concepts/04-modules.md#why-fqcns-not-short-names).
4. Confirm exact parameters with `ansible-doc <fqcn>` before writing the task — collection module parameters change across versions more often than `ansible.builtin`'s stable core.

## Common Mistakes

- Reaching for `shell`/`uri` to call a cloud provider's API directly when a purpose-built collection module already exists and handles auth, pagination, and idempotency correctly.
- Installing an entire large collection (e.g., `community.general`) when only one or two of its modules are actually used, without pinning a version — see [Installing and Using Collections](../collections/02-installing-and-using-collections.md) for why that matters.
- Assuming a module exists under `ansible.builtin` when it's actually shipped in a separate collection that needs installing first.

## Interview Questions

- Where would you look to check whether a module already exists for a specific cloud API before writing a custom one?
- Why are cloud-provider modules shipped as separate collections instead of bundled into `ansible.builtin`?

## Next

Continue to [Playbook Engineering](../playbook-engineering/index.md).
