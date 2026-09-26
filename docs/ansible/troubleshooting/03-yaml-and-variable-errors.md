---
title: "Fix Ansible YAML Errors and Undefined Variables"
icon: lucide/file-warning
description: "Fix Ansible YAML parse errors, undefined variables, and ansible-core 2.19 upgrade errors like \"Conditionals must have a boolean result\"."
tags:
  - Ansible
  - Troubleshooting
  - YAML
---

# YAML and Variable Errors

## What You'll Learn

- How to read a YAML parser error, and why it often points at the wrong line
- The handful of YAML mistakes behind most parse errors
- How to diagnose `'X' is undefined` and `'dict object' has no attribute` errors quickly
- How YAML type surprises become confusing errors deep inside a task
- The errors that appear after upgrading to `ansible-core` 2.19, and how to fix each one

## Why This Exists

These two error categories both surface **before** a task ever reaches a host — they're the fastest to fix, once you know where to look, and the most common first-week source of "the playbook does nothing" confusion.

## First Move: --syntax-check

```bash
ansible-playbook site.yml --syntax-check
yamllint site.yml roles/
```

`--syntax-check` parses the playbook and resolves roles and static imports without connecting to anything. `yamllint` catches structural problems (tabs, indentation, duplicate keys) with clearer messages.

## Reading a YAML Error

```text
ERROR! We were unable to read either as JSON nor YAML, these are the errors we got from each:
...
Syntax Error while loading YAML.
  mapping values are not allowed in this context

The error appears to be in '/srv/ansible/site.yml': line 9, column 15, but may
be elsewhere in the file depending on the exact syntax problem.

The offending line appears to be:

      - name: Install nginx
        package: name: nginx
              ^ here
```

The parser reports **where it gave up**, not where the mistake started. Look at the reported line **and the one or two lines above it** — a missing colon, an unclosed quote, or bad indentation earlier often surfaces one line later.

## The YAML Mistakes Behind Most Errors

| Error message | Usual cause | Fix |
|---|---|---|
| `mapping values are not allowed in this context` | A second `key: value` on the same line, or an unquoted value containing `: ` | Put it on its own line, or quote the value |
| `did not find expected key` | Inconsistent indentation inside a list or mapping | Align siblings to the same column |
| `found character that cannot start any token` | A **tab** used for indentation | Replace tabs with spaces |
| `found undefined alias` / `unexpected end of stream` | An unclosed quote or bracket earlier | Close it; check the lines above |
| `found unacceptable key (unhashable type)` | A value starting with `{{` that isn't quoted | Quote the whole value |

The last one deserves an example, because Ansible even suggests the fix:

```yaml
# Wrong: YAML sees { and starts parsing a dictionary
- ansible.builtin.debug:
    msg: {{ greeting }} world

# Right
- ansible.builtin.debug:
    msg: "{{ greeting }} world"
```

```text
We could be wrong, but this one looks like it might be an issue with
missing quotes. Always quote template expression brackets when they
start a value.
```

Colons inside values also need quotes:

```yaml
- name: "Deploy: version 2"      # quoted because of ": "
  ansible.builtin.lineinfile:
    path: /etc/app.conf
    line: "listen: 8080"
```

## "'X' is undefined"

```text
fatal: [web01]: FAILED! => {"msg": "The task includes an option with an undefined variable. The error was: 'nginx_http_port' is undefined"}
```

Work out where the variable was **supposed** to come from, then check that source for this host:

```bash
# Every variable this host has from inventory (group_vars, host_vars, inventory file)
ansible-inventory -i inventories/production --host web01 | jq 'keys'

# Is web01 actually in the group whose group_vars defines it?
ansible-inventory -i inventories/production --graph web
```

Most common causes, in order:

1. **Wrong group.** The variable is in `group_vars/web.yml`, but the host isn't in `[web]`, or the file name doesn't match the group name exactly.
2. **Wrong location.** `group_vars/` sits next to neither the inventory nor the playbook, so Ansible never loads it.
3. **Wrong inventory.** Running with `-i inventories/staging` while the variable exists only in production.
4. **Typo** in the variable name, in either the definition or the use.
5. **Scope.** Defined as task `vars:` in one task and used in another, or defined by a role included with `include_role` (private by default).
6. **Facts not gathered.** `gather_facts: false`, then `ansible_facts['os_family']` is used.

Precedence and the full list of sources: [Variable Types and Sources](../variables-and-data/01-variable-types-and-sources.md) and [Variable Precedence](../variables-and-data/02-variable-precedence.md).

## "'dict object' has no attribute 'X'"

```text
fatal: [web01]: FAILED! => {"msg": "The task includes an option with an undefined variable. The error was: 'dict object' has no attribute 'port'"}
```

The **parent** exists, but it doesn't have the key you asked for. Print the parent to see its real shape:

```yaml
- name: Inspect the structure
  ansible.builtin.debug:
    var: database
```

```text
ok: [web01] => {
    "database": {
        "host": "db01.internal",
        "Port": 5432
    }
}
```

Here the key is `Port`, not `port` — keys are case-sensitive. Other frequent shapes:

- **A list, not a dictionary**: `registered.results` from a loop is a list; use `registered.results[0].stdout` or `map(attribute='stdout')`.
- **A registered result missing a field** because the task was skipped: a skipped result has no `stdout`. Guard with `when: result is not skipped` or `result.stdout | default('')`.
- **A string that looks like JSON**: use `| from_json` before accessing keys.

For optional nested values, supply a default at the point of use:

```yaml
port: "{{ database.port | default(5432) }}"
```

## "unexpected parameter type in action: AnsibleSequence"

```text
ERROR! unexpected parameter type in action: <class 'ansible.parsing.yaml.objects.AnsibleSequence'>
```

The module's arguments were written as a YAML **list** instead of a **mapping**. It is almost always one extra `-` (newer `ansible-core` releases may print a different class name, such as `list`):

```yaml
# Wrong: the dash turns the arguments into a list
- name: Install nginx
  ansible.builtin.package:
    - name: nginx
      state: present

# Right: the arguments are a mapping
- name: Install nginx
  ansible.builtin.package:
    name: nginx
    state: present
```

## Type Surprises That Parse Fine but Fail Later

YAML happily loads these; the error shows up deep inside a task, far from the cause.

```yaml
country_code: NO          # boolean false in YAML 1.1 — the "Norway problem"
enable_feature: yes       # boolean true
app_version: 1.10         # float 1.1 — the trailing zero is gone
file_mode: 0644           # may become the integer 420
zip_code: 01234           # may become an integer or octal
```

Symptoms: `when: country_code == 'NO'` is never true; a download URL containing `app-1.1.tar.gz` returns 404; files get odd permissions.

Fix: quote values that must stay strings, and always quote file modes:

```yaml
country_code: "NO"
app_version: "1.10"
file_mode: "0644"
```

`yamllint`'s `truthy` and `octal-values` rules catch these before they run. More in [YAML Essentials](../yaml-and-execution-model/01-yaml-essentials.md).

## Values Passed With -e

```bash
ansible-playbook site.yml -e replicas=3
```

`replicas` is the **string** `"3"`. `when: replicas > 2` then compares a string with an integer and fails. Pass typed values as JSON, or convert:

```bash
ansible-playbook site.yml -e '{"replicas": 3}'
```

```yaml
when: replicas | int > 2
```

## Upgrade Errors After ansible-core 2.19

`ansible-core` 2.19 rebuilt templating. Most playbooks run unchanged, but code that relied on the old, looser behavior fails. These are the patterns behind nearly all upgrade failures, in the order you're likely to meet them.

### "Conditionals must have a boolean result"

```text
fatal: [web01]: FAILED! => {"msg": "Conditional result (True) was derived from value of type 'str' at '...'. Conditionals must have a boolean result."}
```

A `when:`, `failed_when:`, `changed_when:`, `until:`, or `assert` expression returned a string, list, or number instead of `true`/`false`. The usual culprits are flags passed with `-e` (always strings) and "is this non-empty?" checks:

```yaml
when: skip_backup                  # "false" from -e is a non-empty string
when: skip_backup | bool           # fixed

when: result.stdout                # a string
when: result.stdout | length > 0   # fixed
```

More examples: [Conditionals must be booleans](../core-concepts/06-conditionals.md#conditionals-must-be-booleans-ansible-core-219). As a stopgap while you fix a large codebase, `ALLOW_BROKEN_CONDITIONALS=True` restores the old behavior with a deprecation warning. Treat it as temporary.

### Templates inside a conditional

```yaml
when: "{{ env }} == 'production'"     # fails on 2.19+
when: env == 'production'             # fixed: when is already an expression
```

`when:` is evaluated as Jinja2 already. Wrapping part of it in `{{ }}` built a string that was then evaluated a second time, which 2.19 no longer allows.

### A template built at run time doesn't render

A value assembled at run time that contains `{{ }}`, such as a string built with `set_fact` from pieces, is no longer rendered a second time. Strings that come from module results, files, and APIs are never treated as templates. Replace the pattern with direct access:

```yaml
# Before: build a variable name as a template, then render it
msg: "{{ '{{ ' ~ service_name ~ '_port }}' }}"

# After: look the variable up directly
msg: "{{ lookup('ansible.builtin.vars', service_name ~ '_port') }}"
```

### Deprecation warnings about top-level facts

`ansible-core` 2.20 warns when a playbook reads injected fact variables like `ansible_os_family`. They still work for now; switch to `ansible_facts['os_family']` before the default changes. [Facts](../variables-and-data/03-facts.md) has a one-line `grep` to find them all.

### Upgrade safely

1. Install the new `ansible-core` in a separate virtualenv; don't upgrade the shared control node first.
2. Run `ansible-lint` and `ansible-playbook --syntax-check`, then `--check --diff` against staging.
3. Read every `[DEPRECATION WARNING]` in the output. Each one names the file and line to fix.
4. Run the full test suite ([Molecule](../production-engineering/07-molecule-testing.md)) on the new version in CI before switching production runs over.

## Common Mistakes

- Staring at the exact line a YAML error reports instead of checking the lines above it.
- Leaving `{{ }}` unquoted at the start of a value.
- Mixing tabs and spaces, usually from pasting into an editor without YAML settings.
- Assuming a variable is undefined because of precedence, when the host simply isn't in the group that defines it.
- Unquoted versions, country codes, and file modes changing type silently.

## Interview Questions

- A task fails with `'X' is undefined` — what's your process for finding where it should have come from?
- Why does a YAML syntax error sometimes point to the wrong line?
- What causes `'dict object' has no attribute`, and how do you inspect the real structure?
- What's the "Norway problem," and how do you prevent it?

## Next

Continue to [Module and Execution Errors](04-module-and-execution-errors.md).
