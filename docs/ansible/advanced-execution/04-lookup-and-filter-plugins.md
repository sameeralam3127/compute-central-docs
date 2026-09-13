---
title: "Ansible Lookup and Filter Plugins Explained"
icon: lucide/search
description: Ansible lookup and filter plugins — pulling data from outside the play (files, environment variables, external secret managers) and transforming it inline.
tags:
  - Ansible
  - Advanced Execution
---

# Lookup and Filter Plugins

## What You'll Learn

- The difference between a lookup (data **in**) and a filter (data **transformed**)
- The built-in lookups you'll use constantly, and `lookup()` vs. `query()`
- How to pull secrets from HashiCorp Vault or AWS Secrets Manager at run time
- When lookups run, and why that matters for performance and random values
- How to write a custom lookup plugin

## Why This Exists

A `loop:` needs data from somewhere before it can iterate — lookup plugins pull data in (a file, an environment variable, an external secret manager); filter plugins (covered day-to-day in [Filters and Tests](../jinja2-and-templates/02-filters-and-tests.md)) transform data already in hand.

## Mental Model

> **Lookups run on the control node.** A `lookup('file', 'x')` reads `x` from *your* machine or CI runner, never from the managed host. **Facts come from the managed node.** If you need a file's content from a remote host, that's `slurp` or `fetch`, not a lookup.

| Question | Tool | Runs on |
|---|---|---|
| "What's in this file in my repo?" | `lookup('ansible.builtin.file', ...)` | Control node |
| "What's in this file on the server?" | `ansible.builtin.slurp` module | Managed node |
| "What OS is the server running?" | Facts | Managed node |
| "Reshape this list I already have" | Filter | Control node |

## Built-In Lookups

```yaml
vars:
  # Read a file from the playbook/role (files/ search path)
  ssh_banner: "{{ lookup('ansible.builtin.file', 'files/banner.txt') }}"

  # Read an environment variable on the control node
  ci_commit: "{{ lookup('ansible.builtin.env', 'CI_COMMIT_SHA', default='local') }}"

  # Run a command on the control node and use its output
  git_tag: "{{ lookup('ansible.builtin.pipe', 'git describe --tags --abbrev=0') }}"

  # Render a Jinja2 template to a string (not to a file)
  motd: "{{ lookup('ansible.builtin.template', 'templates/motd.j2') }}"

  # Generate a password once and store it locally for reuse
  grafana_admin_password: "{{ lookup('ansible.builtin.password', 'credentials/grafana_admin length=32 chars=ascii_letters,digits') }}"
```

Loop over files matching a pattern:

```yaml
- name: Install every public key in files/keys
  ansible.posix.authorized_key:
    user: deploy
    key: "{{ lookup('ansible.builtin.file', item) }}"
  loop: "{{ query('ansible.builtin.fileglob', 'files/keys/*.pub') }}"
```

### lookup() vs. query()

`lookup()` returns a comma-joined string by default; `query()` (or `q()`) always returns a list. Use `query` inside `loop:` so a single result doesn't turn into a string of characters to iterate over.

```yaml
loop: "{{ query('ansible.builtin.inventory_hostnames', 'web:&production') }}"
```

## Pulling Secrets at Run Time

Encrypting secrets with [Ansible Vault](../production-engineering/03-secrets-and-vault.md) still commits ciphertext to Git. A lookup against an external secret manager keeps the value out of the repository entirely.

### HashiCorp Vault

```bash
ansible-galaxy collection install community.hashi_vault
pip install hvac
```

```yaml
- name: Configure the database client
  ansible.builtin.template:
    src: db.env.j2
    dest: /etc/checkout/db.env
    mode: "0600"
  vars:
    db_secret: >-
      {{ lookup('community.hashi_vault.vault_kv2_get', 'checkout/database',
                engine_mount_point='secret',
                url='https://vault.internal.example.com:8200',
                auth_method='approle',
                role_id=vault_role_id,
                secret_id=vault_secret_id) }}
    db_password: "{{ db_secret.secret.password }}"
  no_log: true
```

### AWS Secrets Manager

```bash
ansible-galaxy collection install amazon.aws
pip install boto3 botocore
```

```yaml
vars:
  db_password: "{{ lookup('amazon.aws.secretsmanager_secret', 'prod/checkout/db-password', region='us-east-1') }}"
```

Credentials come from the control node's normal AWS credential chain — an instance role or CI OIDC role, not keys in the playbook.

In both cases, mark consuming tasks `no_log: true` so the value never reaches logs.

## When Lookups Run

Lookups in `vars:` are **lazy**: they're evaluated each time the variable is used, not once.

- A `pipe` or secret-manager lookup referenced in ten tasks runs ten times, on every host that uses it. For expensive calls, resolve once and store it:

    ```yaml
    - name: Fetch the release manifest once
      ansible.builtin.set_fact:
        release_manifest: "{{ lookup('ansible.builtin.url', 'https://releases.example.com/checkout/latest.json') | from_json }}"
      run_once: true
      delegate_to: localhost
    ```

- A lookup that returns a **different value each time** (a random value) will differ between tasks. The `password` lookup avoids this by writing the value to a file on first use and reading it back afterwards.

## Filters Recap

Filters transform data you already have and also run on the control node:

```yaml
admin_users: "{{ users | selectattr('admin') | map(attribute='name') | list }}"
```

The everyday set is in [Filters and Tests](../jinja2-and-templates/02-filters-and-tests.md), and writing your own is in [Advanced Jinja2](../jinja2-and-templates/04-advanced-jinja2.md#custom-filter-plugins).

## Writing a Custom Lookup Plugin

When data lives in an internal system with an HTTP API, a lookup plugin is cleaner than repeated `uri` calls.

```python title="plugins/lookup/cmdb_owner.py"
DOCUMENTATION = r"""
name: cmdb_owner
short_description: Look up a service owner in the internal CMDB
options:
  _terms:
    description: Service names to look up.
    required: true
  api_url:
    description: CMDB base URL.
    default: https://cmdb.internal.example.com
    env:
      - name: CMDB_API_URL
"""

import json

from ansible.errors import AnsibleLookupError
from ansible.module_utils.urls import open_url
from ansible.plugins.lookup import LookupBase


class LookupModule(LookupBase):
    def run(self, terms, variables=None, **kwargs):
        self.set_options(var_options=variables, direct=kwargs)
        base = self.get_option("api_url")
        results = []
        for service in terms:
            try:
                resp = open_url(f"{base}/api/services/{service}", timeout=10)
                results.append(json.load(resp)["owner"])
            except Exception as exc:
                raise AnsibleLookupError(f"cmdb_owner: could not look up {service}: {exc}")
        return results
```

```yaml
- ansible.builtin.debug:
    msg: "checkout is owned by {{ lookup('acme.platform.cmdb_owner', 'checkout') }}"
```

`run()` must always return a **list**. Place the file in `lookup_plugins/` next to a playbook, or in `plugins/lookup/` of a collection (as above, called by FQCN) — see [Build a Collection From Zero](../build-your-own/03-build-a-collection-from-zero.md).

## Common Mistakes

- Confusing a lookup (control-node-side, e.g. reading a local file) with a fact (managed-node-side data) — they answer different questions about different machines.
- Using `lookup('pipe', ...)` to shell out for something a real module or filter already does.
- Using `lookup()` in a `loop:` and iterating over the characters of a comma-joined string — use `query()`.
- Putting an expensive or rate-limited lookup in `group_vars` and calling the API hundreds of times per run.
- Pulling a secret with a lookup but forgetting `no_log: true` on the task that uses it.

## Interview Questions

- What's the difference between a lookup plugin and a fact, in terms of which machine the data comes from?
- How would you pull a secret from an external vault without ever committing it to the playbook repository?
- What's the difference between `lookup()` and `query()`?
- Why can a lookup in `vars:` run many more times than you expect?

## Next

Continue to [Dynamic Inventory](05-dynamic-inventory.md).
