---
title: "Ansible set_fact and combine Filter Explained"
icon: lucide/merge
description: "set_fact defines a variable at runtime on a host; the combine filter merges dictionaries instead of replacing them, which is where most data loss happens."
tags:
  - Ansible
  - Variables
---

# set_fact and combine

`set_fact` defines a variable at run time, scoped to the host. The `combine` filter merges dictionaries instead of overwriting them — the fix for "my other keys disappeared".

## What You'll Learn

- How `set_fact` creates variables during a run, and how long they last
- Why assigning a dictionary replaces it instead of merging it
- How `combine` merges dictionaries, including nested ones and lists

## Why This Exists

Not every variable is known before a play starts — `set_fact` computes one at run time from other variables or registered results, and `combine` merges dictionaries without clobbering keys a plain reassignment would lose.

## Mental Model

> `set_fact` is "assign a variable to **this host**, right now." The value belongs to the host, sticks around for the rest of the playbook run, and outranks inventory and play vars. `combine` is a filter that returns a **new** dictionary built from several — it never changes the originals.

## set_fact Basics

```yaml
- name: Look up the current release symlink
  ansible.builtin.command: readlink /opt/checkout/current
  register: current_link
  changed_when: false

- name: Derive the running release from the symlink target
  ansible.builtin.set_fact:
    running_release: "{{ current_link.stdout | basename }}"
    needs_upgrade: "{{ (current_link.stdout | basename) != app_release }}"

- name: Upgrade only when needed
  ansible.builtin.include_tasks: upgrade.yml
  when: needs_upgrade | bool
```

Things to know:

- **Per host.** Each host gets its own value, computed from its own data.
- **Rest of the run.** The variable is visible to later plays in the same `ansible-playbook` run, via the host.
- **High precedence.** Alongside registered variables — above inventory, `group_vars`, play `vars`, and role defaults; see [Variable Precedence](02-variable-precedence.md).
- **Types survive.** `needs_upgrade` above is a real boolean, not the string `"True"`.

### Persisting across runs: `cacheable: true`

```yaml
- name: Remember the detected cluster role for future runs
  ansible.builtin.set_fact:
    cluster_role: "{{ 'primary' if is_leader else 'replica' }}"
    cacheable: true
```

With [fact caching](../advanced-execution/02-fact-caching.md) enabled, the value is written to the cache and available in later runs as if it were a gathered fact. Without a cache configured, `cacheable` has nothing to persist to.

## Why Dictionary Reassignment Loses Keys

```yaml title="group_vars/all.yml"
app_config:
  log_level: info
  cache:
    enabled: true
    ttl: 300
  features:
    new_checkout: false
```

A tempting — and wrong — override for production:

```yaml
- ansible.builtin.set_fact:
    app_config:
      log_level: warning
```

`app_config` is now `{log_level: warning}` only. `cache` and `features` are gone, and the template that reads `app_config.cache.ttl` fails.

## combine: Non-Destructive Merge

```yaml
- name: Layer production overrides onto the base config
  ansible.builtin.set_fact:
    app_config: "{{ app_config | combine(prod_overrides, recursive=true) }}"
  vars:
    prod_overrides:
      log_level: warning
      cache:
        ttl: 900
```

Result:

```yaml
app_config:
  log_level: warning
  cache:
    enabled: true     # kept from base
    ttl: 900          # overridden
  features:
    new_checkout: false   # kept from base
```

### recursive: shallow vs. deep

| Call | `cache` after merge |
|---|---|
| `combine(prod_overrides)` | `{ttl: 900}` — the whole nested dict is replaced |
| `combine(prod_overrides, recursive=true)` | `{enabled: true, ttl: 900}` — nested keys merged |

### Merging more than two

Later dictionaries win:

```yaml
final_config: "{{ base_config | combine(env_config, host_config, recursive=true) }}"
```

### Lists inside dictionaries: `list_merge`

By default a list in the override replaces the list in the base. Change that with `list_merge`:

```yaml
- ansible.builtin.set_fact:
    firewall: "{{ firewall_base | combine(firewall_extra, recursive=true, list_merge='append_rp') }}"
  vars:
    firewall_base:
      allowed_ports: [22, 443]
    firewall_extra:
      allowed_ports: [443, 9100]
```

`append_rp` appends and removes duplicates, giving `[22, 443, 9100]`. Other options are `replace` (default), `keep`, `append`, `prepend`, and `prepend_rp`.

## Worked Example: Environment Layers Without set_fact

Often you don't need `set_fact` at all — compute the merge where it's used:

```yaml title="group_vars/all.yml"
app_config_base:
  log_level: info
  workers: 2
```

```yaml title="group_vars/production.yml"
app_config_env:
  log_level: warning
  workers: 8
```

```yaml title="roles/checkout/templates/config.yml.j2"
{{ app_config_base | combine(app_config_env | default({}), recursive=true) | to_nice_yaml }}
```

The data flow stays visible in inventory, and no runtime side effect is involved.

## Common Mistakes

- Reassigning a dictionary variable directly instead of using `combine`, silently dropping keys that weren't in the new value.
- Forgetting `recursive=true` when nested dictionaries need merging, not just top-level keys.
- Overusing `set_fact` as a substitute for proper role variable design — every `set_fact` is a runtime side effect that makes a playbook's data flow harder to follow.
- Trying to "override" a `set_fact` value later with `group_vars` — `set_fact` has higher precedence, so the inventory value never wins.
- Using `cacheable: true` without a fact cache configured and expecting the value in the next run.

## Interview Questions

- Why would `my_dict: "{{ new_values }}"` be wrong when you meant to merge, not replace?
- What does `combine(..., recursive=true)` do that a plain dictionary reassignment doesn't?
- How long does a `set_fact` variable live, and which hosts can see it?
- How would you merge two lists of firewall ports without duplicates?

## Next

Continue to [Jinja2 & Templates](../jinja2-and-templates/index.md).
