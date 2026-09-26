---
title: "Ansible Collection Directory Structure"
icon: lucide/folder-tree
description: What's inside an Ansible collection — galaxy.yml, plugins/modules, roles/, and the namespace.collection naming convention.
tags:
  - Ansible
  - Collections
---

# Collection Structure

## What You'll Learn

- What each directory in a collection is for
- What `galaxy.yml` and `meta/runtime.yml` declare
- How the three-part `namespace.collection.name` is built and reserved
- How roles, playbooks, and plugins inside a collection are referenced

## Why This Exists

A role packages tasks. A collection packages **everything** — modules, plugins, roles, playbooks, docs, and tests — under one versioned name. Knowing the layout is what lets you read someone else's collection quickly, and build one that tooling like `ansible-galaxy`, `ansible-test`, and Automation Hub accepts.

## Generate One

```bash
ansible-galaxy collection init acme.platform
```

## The Layout

```text
acme/
└── platform/
    ├── galaxy.yml                # identity, version, dependencies
    ├── meta/
    │   └── runtime.yml           # supported ansible-core range, redirects, deprecations
    ├── README.md
    ├── CHANGELOG.md
    ├── plugins/
    │   ├── modules/              # acme.platform.<module>
    │   ├── module_utils/         # shared Python code for modules
    │   ├── filter/               # Jinja2 filters: acme.platform.<filter>
    │   ├── lookup/               # lookup plugins
    │   ├── inventory/            # dynamic inventory plugins
    │   ├── callback/             # output/notification plugins
    │   └── action/               # control-node-side logic that wraps a module
    ├── roles/
    │   └── nginx/                # acme.platform.nginx — normal role layout inside
    ├── playbooks/
    │   └── bootstrap.yml         # acme.platform.bootstrap
    ├── docs/
    └── tests/
        ├── sanity/
        ├── unit/
        └── integration/
```

Installed, it lives at `<collections path>/ansible_collections/acme/platform/`. That extra `ansible_collections/` directory is required — it's how Python imports collection code.

## galaxy.yml

```yaml title="galaxy.yml"
namespace: acme
name: platform
version: 1.4.0
readme: README.md
authors:
  - Platform Team <platform@example.com>
description: Internal modules and roles for the Acme platform
license:
  - GPL-3.0-or-later
tags:
  - infrastructure
  - linux
dependencies:
  ansible.posix: ">=1.5.0"
  community.general: ">=11.0.0,<13.0.0"
repository: https://git.example.com/platform/acme.platform
build_ignore:
  - .github
  - "*.tar.gz"
  - tests/output
```

| Field | Why it matters |
|---|---|
| `namespace` + `name` | The collection's identity; together they form the first two parts of every FQCN |
| `version` | Semantic version; a published version can never be overwritten |
| `dependencies` | Other collections installed automatically with this one, with version ranges |
| `build_ignore` | Keeps CI files and build artifacts out of the release tarball |

`galaxy.yml` is to a collection what `meta/main.yml` is to a role, but it drives **dependency resolution** at install time: `ansible-galaxy` reads it to decide which versions of which other collections to fetch.

## meta/runtime.yml

```yaml title="meta/runtime.yml"
requires_ansible: ">=2.18.0"
plugin_routing:
  modules:
    old_flag:
      redirect: acme.platform.feature_flag
      deprecation:
        removal_version: 2.0.0
        warning_text: Use acme.platform.feature_flag instead.
```

`requires_ansible` declares which `ansible-core` versions the collection supports, and Galaxy and Automation Hub require it. Raise the floor as old `ansible-core` releases reach end of life, so you're not promising support for versions you no longer test. `plugin_routing` lets you rename or move plugins without breaking existing playbooks immediately.

## The Three-Part Name

```text
acme.platform.feature_flag
└─┬┘ └──┬───┘ └────┬─────┘
namespace collection  plugin/role/playbook
```

- **Namespace** — an organization or person. On Galaxy, a namespace is created and owned by specific users; nobody else can publish into it. On Automation Hub, Red Hat and partners own their namespaces.
- **Collection** — a group of related content inside that namespace.
- **Name** — the module, plugin, role, or playbook.

This is why FQCNs remove ambiguity: `community.general.timezone` and `acme.platform.timezone` can both exist, and a playbook says exactly which one it means.

## Using Each Kind of Content

```yaml
- name: Use content from acme.platform
  hosts: web
  tasks:
    - name: A module
      acme.platform.feature_flag:
        name: new_checkout
        state: present

    - name: A role inside the collection
      ansible.builtin.include_role:
        name: acme.platform.nginx

    - name: A filter plugin
      ansible.builtin.debug:
        msg: "{{ groups['web'] | acme.platform.to_upstream_list(hostvars, 8080) }}"

- name: A playbook shipped in the collection
  ansible.builtin.import_playbook: acme.platform.bootstrap
```

```bash
ansible-playbook acme.platform.bootstrap -i inventory.ini
ansible-doc acme.platform.feature_flag
```

## Roles: Standalone vs. Inside a Collection

The internal structure is identical (`tasks/`, `defaults/`, `handlers/`, `templates/`). What changes:

| | Standalone role | Role in a collection |
|---|---|---|
| Name | `nginx` or `acme.nginx` | `acme.platform.nginx` |
| Versioning | Its own Git tag | The collection's version |
| Custom modules it needs | Separate `library/` directory | `plugins/modules/` alongside it |
| Install | `ansible-galaxy role install` | `ansible-galaxy collection install` |

Role names inside a collection can only contain lowercase letters, digits, and underscores — no dashes.

## Common Mistakes

- Creating the directory as `acme.platform/` instead of `acme/platform/`, so tooling can't find it.
- Omitting `meta/runtime.yml` or `requires_ansible`, so publishing to Galaxy or Automation Hub fails.
- Listing collection dependencies in a separate `requirements.yml` only, instead of `galaxy.yml` `dependencies`, so consumers don't get them automatically.
- Using dashes in role names inside a collection.
- Shipping `tests/output` or CI config in the release tarball because `build_ignore` is empty.

## Interview Questions

- What's the difference between a role and a collection?
- What does `galaxy.yml` declare, and why does it matter for dependency resolution?
- What is `meta/runtime.yml` used for?
- How would you rename a module in a published collection without breaking existing playbooks?

## Next

Continue to [Installing and Using Collections](02-installing-and-using-collections.md).
