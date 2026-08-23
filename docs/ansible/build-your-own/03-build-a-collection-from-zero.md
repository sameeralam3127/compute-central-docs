---
title: "How to Build an Ansible Collection From Scratch"
icon: lucide/package-plus
description: A complete, start-to-finish tutorial building an Ansible collection — namespace, galaxy.yml, packaging a custom module and a role together, building, installing, and publishing.
tags:
  - Ansible
  - Build Your Own
  - Collections
---

# Build a Collection From Zero

A complete tutorial, not a reference page — by the end, the `json_kv` module from [Build a Custom Module](01-build-a-custom-module.md) is packaged as `yourname.utils.json_kv`, installable and usable from any project.

## What You'll Learn

- The complete collection directory structure and what each part is for
- Scaffolding a collection with `ansible-galaxy collection init`
- Moving a `library/` module into a real collection namespace
- Building, installing locally, and (optionally) publishing

## Step 1 — Choose a Namespace and Scaffold

```bash
ansible-galaxy collection init yourname.utils
```

!!! tip "An alternative scaffolder"
    `ansible-creator init collection yourname.utils` (part of [ansible-dev-tools](../production-engineering/08-ansible-dev-tools.md)) does the same job with a more actively maintained, current template — either works for this tutorial. Once the collection exists, `ade install -e .[test] --venv .venv` (also from ansible-dev-tools) gives you an editable local install so changes to the module below take effect immediately, without repeating steps 6–7 on every edit.

```text
yourname/
└── utils/
    ├── galaxy.yml
    ├── README.md
    ├── plugins/
    │   └── modules/
    ├── roles/
    ├── playbooks/
    ├── docs/
    └── tests/
        └── integration/
```

`ansible-galaxy collection init` creates all of this for you — the manual layout is worth knowing, but you should always scaffold with the CLI rather than hand-creating every directory.

## Step 2 — Fill In `galaxy.yml`

```yaml title="yourname/utils/galaxy.yml"
namespace: yourname
name: utils
version: 1.0.0
readme: README.md
authors:
  - Your Name <you@example.com>
description: Internal utility modules and roles
license:
  - MIT
tags:
  - utilities
dependencies: {}
repository: https://github.com/yourname/ansible-collection-utils
```

`namespace` + `name` together form the FQCN prefix every module/role/plugin in this collection will use: `yourname.utils.*`.

## Step 3 — Move the Module In

```bash
cp library/json_kv.py yourname/utils/plugins/modules/json_kv.py
```

Nothing about the module's code changes — `DOCUMENTATION`, `argument_spec`, `AnsibleModule` usage are all identical to the standalone version. Only its *location* changes, which is what gives it a real FQCN:

```yaml
- name: Set feature_new_dashboard
  yourname.utils.json_kv:
    path: /etc/app/config.json
    key: feature_new_dashboard
    value: true
```

## Step 4 — Add a Role to the Same Collection

```bash
ansible-galaxy role init --init-path yourname/utils/roles configure_app
```

```text
yourname/utils/roles/configure_app/
├── tasks/main.yml
├── defaults/main.yml
├── handlers/main.yml
└── meta/main.yml
```

Roles inside a collection use the exact same internal structure as a standalone role (see [Role Structure](../roles/01-role-structure.md)) — only their *location and how they're referenced* changes:

```yaml
- hosts: app
  roles:
    - yourname.utils.configure_app
```

## Step 5 — Document and Test

```text
yourname/utils/
├── README.md              # collection-level overview
└── tests/
    └── integration/
        └── targets/
            └── json_kv/
                └── tasks/main.yml   # a playbook that exercises json_kv for real
```

At minimum, run `ansible-test sanity` against the collection before treating it as shippable — full CI integration is covered in [CI/CD and Linting](../production-engineering/06-cicd-and-linting.md).

## Step 6 — Build

```bash
cd yourname/utils
ansible-galaxy collection build
```

```text
yourname-utils-1.0.0.tar.gz
```

## Step 7 — Install It Locally and Use It

```bash
ansible-galaxy collection install yourname-utils-1.0.0.tar.gz -p ./collections
```

```ini title="ansible.cfg"
[defaults]
collections_path = ./collections
```

```bash
ansible-doc yourname.utils.json_kv
```

confirms the module installed correctly and its `DOCUMENTATION` renders properly — the same command you'd run against any built-in module.

## Step 8 — Version and Publish

```bash
# Bump version in galaxy.yml first (semantic versioning)
ansible-galaxy collection build
ansible-galaxy collection publish yourname-utils-1.0.1.tar.gz
```

`ansible-galaxy collection publish` targets public Galaxy by default; point it at a private Automation Hub or Nexus/Artifactory-hosted index with `--server` for internal-only collections. See [Publishing Collections](../collections/03-publishing-collections.md) for the versioning discipline that matters once other teams depend on it.

## Common Mistakes

- Changing a module's argument behavior and publishing it as a patch version bump — breaks every consumer without warning; that's a major version bump.
- Forgetting `collections_path` in `ansible.cfg`, so a locally-built collection is never actually found by playbooks that reference its FQCN.
- Skipping `ansible-test sanity` before publishing, letting a documentation/argspec mismatch ship.

## Interview Questions

- Walk through what changes — and what doesn't — when a standalone `library/` module gets moved into a collection.
- What's the purpose of `galaxy.yml`, and what does it have in common with a role's `meta/main.yml`?
- How would you distribute an internal-only collection without publishing it to public Galaxy?

## Next

You now have the full arc — [Getting Started](../getting-started/index.md) through building and publishing your own collection. Continue to [Production Engineering](../production-engineering/index.md) for how this all runs safely at scale, or jump to [Case Studies](../case-studies/index.md) for full worked examples.
