---
icon: lucide/folder-tree
description: What's inside an Ansible collection — galaxy.yml, plugins/modules, roles/, and the namespace.collection naming convention.
tags:
  - Ansible
  - Collections
---

# Collection Structure

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## What It Will Cover

```text
my_namespace/
└── my_collection/
    ├── galaxy.yml           # collection metadata and version
    ├── README.md
    ├── plugins/
    │   ├── modules/          # custom modules, FQCN: my_namespace.my_collection.mymodule
    │   ├── filter/            # custom Jinja2 filters
    │   ├── lookup/             # custom lookup plugins
    │   └── inventory/          # custom dynamic inventory plugins
    ├── roles/                  # roles distributed as part of this collection
    ├── playbooks/                # example/shared playbooks
    ├── docs/
    └── tests/
        ├── sanity/
        ├── unit/
        └── integration/
```

- `galaxy.yml` — the collection's own metadata (namespace, name, version, dependencies), the collection-level equivalent of a role's `meta/main.yml`
- Why `namespace.collection.module` is a three-part name, and how the namespace is reserved on Galaxy/Automation Hub
- How a collection's `roles/` differ from a standalone role directory — same internal structure, just nested under the collection

## Interview Questions

- What's the difference between a role and a collection?
- What does `galaxy.yml` declare, and why does it matter for dependency resolution?

## Next

Continue to [Installing and Using Collections](02-installing-and-using-collections.md).
