---
icon: lucide/puzzle
description: Ansible's plugin architecture — action, lookup, filter, cache, connection, strategy, inventory, vars, and callback plugins — and how to write custom ones.
tags:
  - Ansible
  - Volume 5
  - Plugins
---

# Part 26 — Plugin Architecture

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

If modules are *what runs on the managed node*, plugins are *everything that shapes behavior on the control node* — this chapter covers all nine plugin types and how to write your own.

## Why This Exists

- Plugins are Ansible's actual extensibility mechanism for control-node behavior; understanding them explains how features like Jinja2 filters, fact caching, and custom output formatting are all implemented the same underlying way.

## Problem Statement

- Different kinds of control-node behavior (transforming data, connecting to hosts, caching facts, formatting output) need different extension points — a single plugin type couldn't cleanly serve all of them, hence nine distinct plugin categories.

## Internal Architecture — The Nine Plugin Types

- **Action plugins**: run on the control node *before* a task's module executes remotely — many "modules" (like `template`, `copy`) are actually action-plugin-plus-module pairs, with the action plugin handling local work (e.g., rendering a template) before shipping data to the module.
- **Lookup plugins**: pull data from outside sources into a playbook at parse/run time (`lookup('file', ...)`, `lookup('env', ...)`).
- **Filter plugins**: Jinja2 filters used in templating (`{{ value | my_filter }}`).
- **Cache plugins**: back `fact_caching` (previewed here, covered fully in Volume 6) — Redis, JSON file, Memcached, etc.
- **Connection plugins**: transport implementations (`ssh`, `local`, `winrm`, `docker`) — covered from the runtime side in Volume 3.
- **Strategy plugins**: control task scheduling across hosts (`linear`, `free`) — covered from the runtime side in Volume 3.
- **Inventory plugins**: source inventory dynamically (`aws_ec2`, `azure_rm`) — covered from the usage side in Volume 2.
- **Vars plugins**: inject additional variables into the variable-resolution process beyond the standard `host_vars`/`group_vars` files.
- **Callback plugins**: react to execution-lifecycle events (task start, task result, playbook stats) — this is how output formatting (`default`, `yaml`, `json`, `minimal`) and external integrations (Slack notifications, log shipping) are implemented.

## Workflow

- How the plugin loader (Volume 3, Part 19) discovers plugins from `ansible-core`'s bundled set, installed collections, and a project's local `*_plugins/` directories, in that resolution order.

## Step-by-Step Explanation — Writing a Custom Plugin

1. Choose the correct plugin type for the behavior needed (a common early mistake is reaching for an action plugin when a filter plugin would do).
2. Subclass the relevant base class (`ActionBase`, `LookupBase`, `CallbackBase`, etc.) and implement its required method (`run()` for actions/lookups, `v2_runner_on_ok()` etc. for callbacks).
3. Place the plugin in the correct local directory (`filter_plugins/`, `callback_plugins/`, etc.) or package it inside a collection under `plugins/<type>/`.
4. Reference it (filters/lookups are used directly in Jinja2; callbacks often need enabling via `ansible.cfg`'s `callbacks_enabled`).

## Production Best Practices

- Shipping custom plugins inside an internal collection rather than scattered `*_plugins/` directories per project, so they're versioned and reusable the same way modules are (Volume 2, Part 13).
- Writing callback plugins for structured log shipping (e.g., JSON lines to a log aggregator) instead of parsing default human-readable output in downstream tooling.

## Common Mistakes

- Writing an action plugin to do something a filter plugin could do more simply, adding unnecessary control-node/module round-trip complexity.
- Forgetting that some plugin types (notably callbacks) must be explicitly enabled in `ansible.cfg` even once installed.

## Performance Considerations

- Action plugins run local, potentially expensive work (like large template rendering) on the control node — badly written action plugins can become a bottleneck independent of managed-node performance.

## Security Considerations

- Lookup plugins that read from external systems (files, environment variables, vaults, APIs) are a common place secrets flow through — auditing custom lookup plugins matters as much as auditing modules.

## Interview Questions

- "What's the difference between an action plugin and a module?"
- "Name three Ansible plugin types and what each is responsible for."
- "How would you write a custom callback plugin to ship structured job results to an external system?"

## Hands-On Lab

- Write a simple custom filter plugin (e.g., one that converts a string to title case) and use it in a playbook template with `{{ my_var | my_titlecase }}`.

## Summary

- Nine plugin types cover nearly every way Ansible's control-node behavior can be extended — knowing which type matches which problem is the key skill; the mechanics of writing one are consistent across types (subclass a base, implement one method, place it correctly).

## Next

Continue to [Part 27 — Testing Ansible Content](03-testing-ansible-content.md).
