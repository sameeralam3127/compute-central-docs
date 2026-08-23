---
icon: lucide/hammer
description: Extending Ansible — writing a real custom module with AnsibleModule, and packaging modules, roles, and plugins into a distributable collection.
tags:
  - Ansible
  - Build Your Own
---

# Build Your Own

Everything before this section is about *using* Ansible. This section is about *extending* it — writing a module when no built-in one fits, and packaging your own modules, roles, and plugins into something distributable.

## Read in this order

1. [Build a Custom Module](01-build-a-custom-module.md) — a real, non-trivial module using `AnsibleModule`, with check mode, diff mode, and idempotency
2. [ArgumentSpec, Check Mode, Idempotency, and Diff](02-argumentspec-checkmode-idempotency-diff.md) — each piece of the module contract in depth
3. [Build a Collection From Zero](03-build-a-collection-from-zero.md) — namespace, `galaxy.yml`, packaging the module above with a role, building, installing, and publishing

## Next

Continue to [Production Engineering](../production-engineering/index.md).
