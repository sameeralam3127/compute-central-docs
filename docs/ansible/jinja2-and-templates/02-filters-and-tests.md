---
title: "Ansible Jinja2 Filters and Tests Reference"
icon: lucide/filter
description: The Jinja2 filters and tests used constantly in Ansible playbooks — default, join, dict2items, and is defined/is failed.
tags:
  - Ansible
  - Jinja2
---

# Filters and Tests

## What You'll Learn

- The difference between a filter (`|`) and a test (`is`)
- The dozen filters that cover most real playbooks, with examples
- How to filter and reshape lists of dictionaries without writing loops
- Precedence traps that make a filter apply to less than you think

## Why This Exists

Filters transform a value (`| default`, `| join`); tests answer a yes/no question about a value (`is defined`, `is failed`) — together they're most of what makes a Jinja2 expression in a real playbook longer than a bare variable name.

## Mental Model

> A **filter** takes a value in and gives a *new value* out: `value | filter(args)`. A **test** takes a value in and gives *true or false* out: `value is test`. Filters chain left to right like a shell pipeline; tests are used in `when:`, `failed_when:`, and `{% if %}`.

```yaml
"{{ packages | unique | sort | join(', ') }}"    # filter chain → a string
when: result is failed                           # test → boolean
```

## Defaults and Required Values

```yaml
# Fallback when the variable is undefined
listen_port: "{{ http_port | default(80) }}"

# Also treat empty/falsy values ("", [], 0) as missing
admin_email: "{{ owner_email | default('ops@example.com', true) }}"

# Omit a module parameter entirely when no value was given
- ansible.builtin.user:
    name: deploy
    shell: "{{ user_shell | default(omit) }}"

# Fail with a clear message instead of a vague undefined error
db_password: "{{ vault_db_password | mandatory('vault_db_password must be set in vault.yml') }}"
```

## Strings and Lists

| Filter | Example | Result |
|---|---|---|
| `join` | `['a','b'] \| join(',')` | `a,b` |
| `length` | `['a','b'] \| length` | `2` |
| `unique` | `[1,1,2] \| unique` | `[1, 2]` |
| `sort` | `['b','a'] \| sort` | `['a', 'b']` |
| `first` / `last` | `groups['web'] \| first` | `web01` |
| `flatten` | `[[1,2],[3]] \| flatten` | `[1, 2, 3]` |
| `difference` / `union` / `intersect` | `[1,2,3] \| difference([2])` | `[1, 3]` |
| `lower` / `upper` / `trim` | `' Web ' \| trim \| lower` | `web` |
| `replace` | `'a-b' \| replace('-', '_')` | `a_b` |
| `regex_replace` | `'v1.2.3' \| regex_replace('^v', '')` | `1.2.3` |
| `regex_search` | `'build-4521' \| regex_search('\\d+')` | `4521` |
| `int` / `float` / `bool` / `string` | `'3' \| int` | `3` |
| `basename` / `dirname` | `'/opt/app/releases/2.1' \| basename` | `2.1` |
| `ternary` | `is_prod \| ternary('warning', 'debug')` | `warning` |

## Looping Over Dictionaries: dict2items and items2dict

`loop:` needs a list. Turn a dictionary into one:

```yaml
vars:
  sysctl_settings:
    net.core.somaxconn: 4096
    vm.swappiness: 10

tasks:
  - name: Apply kernel settings
    ansible.posix.sysctl:
      name: "{{ item.key }}"
      value: "{{ item.value }}"
      state: present
    loop: "{{ sysctl_settings | dict2items }}"
```

And back again:

```yaml
users_by_name: "{{ user_list | items2dict(key_name='name', value_name='uid') }}"
```

## Selecting and Projecting Lists of Dictionaries

Real data is usually a list of dictionaries:

```yaml
vars:
  services:
    - { name: checkout, port: 8080, enabled: true,  tier: web }
    - { name: payments, port: 8081, enabled: false, tier: web }
    - { name: reports,  port: 9000, enabled: true,  tier: batch }
```

```yaml
# Keep only enabled services
enabled: "{{ services | selectattr('enabled') | list }}"

# Keep only web-tier services
web: "{{ services | selectattr('tier', 'equalto', 'web') | list }}"

# Drop disabled ones
active: "{{ services | rejectattr('enabled', 'false') | list }}"

# Project one attribute from each: ['checkout', 'reports']
names: "{{ services | selectattr('enabled') | map(attribute='name') | list }}"

# Ports of enabled web services, as a comma-separated string
ports: "{{ services | selectattr('enabled') | selectattr('tier', 'equalto', 'web') | map(attribute='port') | join(',') }}"
```

`select`/`reject` do the same for plain lists using a test: `ports | select('greaterthan', 1024) | list`.

!!! tip "End with `| list`"
    `selectattr`, `map`, and `select` return lazy generators. Add `| list` when you store the result or pass it to a module, or you'll see `<generator object ...>`.

## Serialization

```yaml
- ansible.builtin.copy:
    dest: /etc/checkout/config.json
    content: "{{ app_config | to_nice_json(indent=2) }}"

- ansible.builtin.set_fact:
    api_payload: "{{ response.content | from_json }}"
```

`to_json`/`to_yaml` produce compact output; `to_nice_json`/`to_nice_yaml` produce readable, indented output for config files.

## Tests

| Test | True when |
|---|---|
| `is defined` / `is undefined` | The variable exists / doesn't |
| `is none` | The value is `null` |
| `is failed` / `is succeeded` | A registered result failed / succeeded |
| `is changed` / `is skipped` | A registered result changed / was skipped |
| `is string` / `is number` / `is mapping` / `is iterable` | Type checks |
| `is match('^web')` / `is search('prod')` | Regex match at start / anywhere |
| `is version('2.0', '>=')` | Version comparison |
| `is in` | Membership: `'web' is in group_names` |

```yaml
- name: Check whether the app is installed
  ansible.builtin.command: /opt/checkout/bin/checkout --version
  register: version_check
  failed_when: false
  changed_when: false

- name: Install when missing or older than 2.0
  ansible.builtin.include_tasks: install.yml
  when: >
    version_check is failed
    or not (version_check.stdout | regex_search('[0-9.]+') is version('2.0', '>='))
```

## Precedence Traps

A filter binds tighter than arithmetic and comparison operators:

```yaml
# Applies default only to `extra` — if `base` is undefined, this still fails
total: "{{ base + extra | default(0) }}"

# What you meant
total: "{{ (base | default(0)) + (extra | default(0)) }}"
```

Likewise, `not x is defined` reads as `not (x is defined)`, but mixing `not`, `and`, and filters without parentheses gets unreadable fast — add parentheses.

## Common Mistakes

- Writing `a + b | default(0)` and expecting the default to cover the whole expression — it only covers `b`.
- Confusing `is defined` (variable exists) with a falsy-value check — an empty string or `0` is still "defined."
- Forgetting `| list` after `selectattr`/`map`, passing a generator object to a module.
- Using `| default('')` for a module parameter that should be *absent* — use `| default(omit)`.
- Comparing version strings with `>` (string comparison: `"10.0" < "9.0"`) instead of the `version` test.

## Interview Questions

- What does `| default([], true)` do differently from plain `| default([])`?
- How would you filter a list of dictionaries down to only the ones matching a condition, without a full `for` loop?
- What's the difference between `default('')` and `default(omit)` for a module parameter?
- Why does `"{{ '10.0' > '9.0' }}"` evaluate to false, and how do you compare versions correctly?

## Next

Continue to [Templates for Config Generation](03-templates-for-config-generation.md).
