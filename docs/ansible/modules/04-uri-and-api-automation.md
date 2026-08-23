---
title: "Ansible uri Module: API Automation Guide"
icon: lucide/globe
description: API automation with the uri module — status_code checks, JSON bodies, authentication headers, and registering structured responses.
tags:
  - Ansible
  - Modules
---

# URI and API Automation

## What You'll Learn

- Calling an HTTP API declaratively with `ansible.builtin.uri`
- Why `uri` beats `shell: curl` for anything beyond a throwaway check

## Minimal Example

```yaml
- name: Check that the app is healthy
  ansible.builtin.uri:
    url: "http://localhost:8080/health"
    status_code: 200
```

## Practical Example — POST With a JSON Body and Auth

```yaml
- name: Register this host with the service registry
  ansible.builtin.uri:
    url: "https://registry.internal/api/v1/hosts"
    method: POST
    headers:
      Authorization: "Bearer {{ registry_token }}"
    body_format: json
    body:
      hostname: "{{ inventory_hostname }}"
      role: web
    status_code: [200, 201]
  register: registration
  no_log: true
```

- `body_format: json` serializes `body:` to JSON and sets the right `Content-Type` automatically.
- `status_code:` accepts a list — anything else fails the task outright, no manual exit-code parsing needed.
- `no_log: true` because the request includes a bearer token — see [Security](../production-engineering/04-security.md).

## Why Not `shell: curl ...`

```yaml
# Loses structure: raw exit code, unparsed stdout, no built-in status check
- ansible.builtin.shell: curl -X POST https://registry.internal/api/v1/hosts -d '{"hostname":"{{ inventory_hostname }}"}'
```

`uri` gives you a structured, `register`-able result (`registration.json`, `registration.status`) instead of a string you'd have to parse yourself, checks the status code declaratively via `status_code:`, and avoids building a shell command string out of variables — which is a real injection risk the moment any value is even slightly untrusted.

## Common Mistakes

- Forgetting `status_code:` and treating a non-2xx response as success because the task didn't fail — `uri` only fails on a status **not** in the list you gave it (default: 200-299).
- Not setting `no_log: true` on requests carrying credentials or tokens.
- Reaching for `shell: curl` out of habit when `uri` already covers the case — see [Command vs. Shell](01-command-vs-shell-vs-raw-vs-script.md).

## Interview Questions

- What does `uri`'s `status_code:` parameter actually control?
- Why is `uri` preferred over `shell: curl` for API automation in a reviewed playbook?

## Next

Continue to [Playbook Engineering](../playbook-engineering/index.md).
