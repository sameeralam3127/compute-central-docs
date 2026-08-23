---
icon: lucide/variable
description: A map of where Ansible variables come from — inventory, roles, facts, registered results, extra vars — before the full precedence deep dive.
tags:
  - Ansible
  - Core Concepts
  - Variables
---

# Variables (Overview)

This page is a map, not the full explanation — it exists so you can write a real playbook today. The complete precedence order, magic variables, and `set_fact`/`combine` behavior live in the dedicated [Variables & Data](../variables-and-data/index.md) section; come back here as a quick refresher.

## Where a Value Can Come From

```yaml
# 1. Inventory (host_vars / group_vars, or inline)
[web]
web01 http_port=8080

# 2. Play-level vars
- hosts: web
  vars:
    http_port: 8080

# 3. Role defaults (defaults/main.yml) — freely overridable
http_port: 80

# 4. Registered from a previous task
- ansible.builtin.command: cat /etc/app/port
  register: port_check

# 5. Facts, gathered automatically from the host
{{ ansible_facts['default_ipv4']['address'] }}

# 6. Extra vars, on the command line — always wins
ansible-playbook site.yml -e "http_port=9090"
```

Use `{{ variable_name }}` to reference a variable inside a string, and bare `variable_name` in most `key: value` task arguments.

## The One Rule Worth Memorizing Now

More than one of these can set the *same* variable name at once — when that happens, Ansible has a strict, memorizable order it resolves conflicts by (`-e` always wins; role defaults always lose). That full order is the single most-asked Ansible question in real support channels and interviews — it has its own page for a reason: [Variable Precedence](../variables-and-data/02-variable-precedence.md).

## Interview Questions

- Name three places a variable's value can come from.
- What's the fastest command to check what value Ansible actually resolved for a variable on a given host?

## Next

Continue to [Conditionals](06-conditionals.md), or jump ahead to [Variable Precedence](../variables-and-data/02-variable-precedence.md) if a variable isn't behaving the way you expect right now.
