---
title: "Ansible Module argument_spec and Check Mode"
icon: lucide/list-checks
description: Ansible module internals in depth — argument_spec validation features, check mode internals, idempotency patterns, diff mode, and no_log/module_utils.
tags:
  - Ansible
  - Build Your Own
  - Modules
---

# ArgumentSpec, Check Mode, Idempotency, and Diff

[Build a Custom Module](01-build-a-custom-module.md) already demonstrates each of these in a working module. This page goes one level deeper on each piece, using one realistic module as the running example.

## What You'll Learn

- The `argument_spec` features that remove hand-written validation code
- How `no_log` protects secret parameters, and what exactly it redacts
- How to support check mode correctly — branching, not pretending
- Idempotency patterns beyond "compare two strings"
- How to return diffs that `--diff` can display
- How to share code across modules with `module_utils`, and document return values

## The Running Example

A module that manages a key in an internal feature-flag service:

```yaml
- name: Enable the new checkout flow for 10% of traffic
  acme.platform.feature_flag:
    name: new_checkout
    state: present
    rollout_percent: 10
    environments: [staging, production]
    api:
      url: https://flags.internal.example.com
      token: "{{ vault_flags_token }}"
```

## argument_spec in Depth

```python
argument_spec = dict(
    name=dict(type="str", required=True, aliases=["flag"]),
    state=dict(type="str", default="present", choices=["present", "absent"]),
    rollout_percent=dict(type="int", default=100),
    environments=dict(type="list", elements="str", default=["production"]),
    owner=dict(type="str"),
    api=dict(
        type="dict",
        required=True,
        options=dict(
            url=dict(type="str", required=True),
            token=dict(type="str", required=True, no_log=True),
            timeout=dict(type="int", default=10),
        ),
    ),
)

module = AnsibleModule(
    argument_spec=argument_spec,
    supports_check_mode=True,
    required_if=[("state", "present", ["rollout_percent"])],
    mutually_exclusive=[],
)
```

| Feature | What it gives you for free |
|---|---|
| `type` | Conversion and validation (`"10"` → `10`; `"ten"` fails with a clear message) |
| `required` / `default` | Missing-argument errors and defaults, with no `if` statements |
| `choices` | Rejects values outside a fixed set |
| `aliases` | Alternative parameter names for compatibility |
| `elements` | Type of each item in a `list` |
| `options` | A nested spec for `dict` parameters, validated recursively |
| `no_log` | Marks a value as secret (see below) |
| `mutually_exclusive` | Parameters that can't be set together |
| `required_together` | Parameters that must be set together |
| `required_one_of` | At least one of a group must be set |
| `required_if` | `(param, value, [required params])` — conditional requirements |
| `required_by` | `{"a": ["b"]}` — if `a` is set, `b` must be too |

Validation happens inside `AnsibleModule(...)`, before your code runs. If it fails, the module exits with a failure message automatically.

Value-level rules that the spec can't express still go in code:

```python
if not 0 <= module.params["rollout_percent"] <= 100:
    module.fail_json(msg="rollout_percent must be between 0 and 100")
```

## no_log: What It Redacts

Setting `no_log=True` on a parameter does two things:

1. In the task's reported `invocation`, the parameter's value is replaced with `VALUE_SPECIFIED_IN_NO_LOG_PARAMETER`.
2. Ansible masks occurrences of that exact value if it appears in other returned strings, such as an error message that echoes the request.

It does **not** stop your module from writing the secret to a file, a remote log, or an exception you build by hand. And it's separate from the **task-level** `no_log: true`, which hides the whole task result. For a secret parameter in a custom module, put `no_log=True` in the `argument_spec` so every caller is protected, even the ones who forget the task keyword. `ansible-test sanity` warns about parameters whose names look secret (`token`, `password`) without `no_log`.

## Check Mode Internals

`supports_check_mode=True` is a **promise**, not a feature. Ansible doesn't simulate anything; it sets `module.check_mode = True` and trusts you to not change the system.

```python
def main():
    module = AnsibleModule(argument_spec=argument_spec, supports_check_mode=True)
    client = FlagClient(module.params["api"])

    current = client.get(module.params["name"])          # read: always safe
    desired = build_desired(module.params)

    changed = needs_change(current, desired, module.params["state"])
    result = dict(changed=changed, flag=desired if module.params["state"] == "present" else None)

    if module._diff:
        result["diff"] = dict(before=current or {}, after=desired if module.params["state"] == "present" else {})

    if changed and not module.check_mode:                 # write: only for real
        if module.params["state"] == "present":
            client.put(desired)
        else:
            client.delete(module.params["name"])

    module.exit_json(**result)
```

The pattern is always the same: **read, compute, report, and write only if not in check mode.** The `changed` value must be identical in both modes — that's what makes `--check` a trustworthy preview.

If a module genuinely can't predict the outcome without acting, set `supports_check_mode=False`. Ansible then skips it in check mode and reports it as skipped, which is honest.

## Idempotency Patterns

### Normalize before comparing

APIs return extra fields, different key orders, and defaults you didn't send. Compare only what the user controls:

```python
MANAGED_KEYS = ("rollout_percent", "environments", "owner")

def needs_change(current, desired, state):
    if state == "absent":
        return current is not None
    if current is None:
        return True
    return any(
        normalize(current.get(k)) != normalize(desired.get(k))
        for k in MANAGED_KEYS
        if desired.get(k) is not None       # unset parameters mean "don't manage"
    )

def normalize(value):
    return sorted(value) if isinstance(value, list) else value
```

Sorting the list means `[production, staging]` and `[staging, production]` don't flap between runs.

### Hash large content

For large files or blobs, compare checksums rather than content:

```python
current_hash = module.digest_from_file(path, "sha256") if os.path.exists(path) else None
desired_hash = hashlib.sha256(content.encode()).hexdigest()
changed = current_hash != desired_hash
```

### Write atomically

When writing files, write to a temporary path and `module.atomic_move(tmp, dest)`, so a crash never leaves a half-written file.

### The check-then-act race

"Read current state, then write" has a gap. On a busy, concurrently modified system, the state can change in between. Configuration management rarely hits this in practice, but when an API supports it, use conditional writes (an ETag or version field) so the write fails instead of silently overwriting someone else's change.

## Diff Mode

`--diff` shows what changed. A module opts in by returning a `diff` key when `module._diff` is true:

```python
result["diff"] = dict(
    before_header=f"flag {name} (current)",
    after_header=f"flag {name} (desired)",
    before=yaml_dump(current or {}),
    after=yaml_dump(desired),
)
```

`before` and `after` can be strings (shown as a unified diff) or dicts. Strings of serialized YAML usually read best. Run with `--check --diff` to preview without writing:

```text
--- flag new_checkout (current)
+++ flag new_checkout (desired)
@@ -1,4 +1,4 @@
 environments:
 - staging
-rollout_percent: 0
+rollout_percent: 10
```

Never put a `no_log` value into a diff.

## module_utils: Shared Code

Five modules talking to the same API shouldn't each carry their own HTTP client.

```text
acme/platform/
└── plugins/
    ├── module_utils/
    │   └── flags_client.py
    └── modules/
        ├── feature_flag.py
        └── feature_flag_info.py
```

```python title="plugins/modules/feature_flag.py"
from ansible.module_utils.basic import AnsibleModule
from ansible_collections.acme.platform.plugins.module_utils.flags_client import FlagClient
```

When the module runs, Ansible bundles every imported `module_utils` file with it and ships them to the managed node together, so the shared code doesn't need to be installed there. Outside a collection, a `module_utils/` directory next to the playbook is imported as `ansible.module_utils.<name>`.

## Documenting Return Values

`ansible-doc` renders `RETURN` for users, and sanity tests check it's valid YAML:

```python
RETURN = r"""
flag:
  description: The flag as it exists after the task (null when state=absent).
  returned: success
  type: dict
  sample:
    name: new_checkout
    rollout_percent: 10
    environments: [staging, production]
  contains:
    rollout_percent:
      description: Percentage of traffic that sees the flag.
      type: int
      returned: when state=present
"""
```

Document everything you return, including the `returned:` condition, so consumers know what they can `register` and rely on.

## Common Mistakes

- Using `no_log` only on the *task* level and forgetting it belongs on the `argument_spec` parameter itself for a custom module handling secrets.
- Declaring `supports_check_mode=True` and then writing anyway, making `--check` lie.
- Computing `changed` differently in check mode and normal mode.
- Comparing raw API responses, so list ordering or server-added defaults report `changed` on every run.
- A "check-then-act" idempotency check that's actually a race — state can change between the check and the write on a genuinely concurrent system, which is worth calling out even though most Ansible use cases (config management, not high-frequency systems) rarely hit it in practice.
- Copy-pasting a client class into every module instead of using `module_utils`.

## Interview Questions

- What does `no_log=True` on an `argument_spec` parameter actually redact, and where?
- How would you share validation logic across five related custom modules without duplicating it in each one?
- What does a module have to do to support check mode honestly?
- A custom module reports `changed` on every run even though nothing changes. What would you look at first?
- What's the difference between `required_if` and `required_together`?

## Next

Continue to [Build a Collection From Zero](03-build-a-collection-from-zero.md).
