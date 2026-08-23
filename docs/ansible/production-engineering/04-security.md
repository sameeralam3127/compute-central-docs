---
title: "Ansible Security Best Practices"
icon: lucide/shield
description: Ansible security end to end — Vault, SSH keys, least-privilege become, credential handling, no_log, and shell-injection risks in command/shell/uri tasks.
tags:
  - Ansible
  - Production
  - Security
---

# Security

## What You'll Learn

- Why Ansible security has fleet-wide blast radius, not single-host blast radius
- The concrete checklist: secrets, privilege escalation, and logging hygiene
- Where shell injection actually creeps into playbooks

## Why This Matters

Ansible frequently runs with `become: true` against every host in an environment at once, often carrying secrets along the way. A mistake here doesn't compromise one server — it compromises whatever the playbook's reach and privileges cover, which in production is usually "everything."

## Secrets

- Never commit plaintext secrets, even temporarily, even to a private repository — use [Vault](03-secrets-and-vault.md) or an external secret manager from day one.
- Prefer an external secret manager (HashiCorp Vault, AWS Secrets Manager) via a lookup plugin over committing even encrypted values, when the team is large enough to justify the operational overhead.
- Never pass a secret via `-e` on a CI command line — it can land in shell history, process listings (`ps aux`), and CI job logs.

```yaml
# Risky — the token is visible in CI logs and shell history
ansible-playbook deploy.yml -e "api_token=abc123secret"

# Better — sourced from Vault or a CI secret store, referenced by lookup
ansible-playbook deploy.yml
```

```yaml
- name: Register with the API
  ansible.builtin.uri:
    url: "https://api.internal/register"
    headers:
      Authorization: "Bearer {{ api_token }}"
  no_log: true
```

`no_log: true` suppresses this task's arguments **and** result from all output — necessary any time a task's input or output could contain a secret, not just when a password is the obvious argument name.

## Least-Privilege `become`

```yaml
# Overbroad — every task in this play runs as root
- hosts: app
  become: true
  become_user: root
  tasks: ...
```

```yaml
# Scoped — only escalates to the service account this task actually needs
- name: Restart the app service
  ansible.builtin.systemd_service:
    name: myapp
    state: restarted
  become: true
  become_user: myapp
```

Scope both SSH access and `become` targets to exactly what a given task needs — `become_user: root` by default, for tasks that only need a service-specific account's privileges, is one of the most common over-privileged patterns in real playbooks.

## SSH Key Hygiene

Key-based auth is the production default (see [SSH and Connectivity](../getting-started/05-ssh-and-connectivity.md)) — scope keys per environment or per team rather than one shared key reused everywhere, and rotate on a schedule, not only after a suspected incident.

## Shell Injection

```yaml
# Risky — a variable is interpolated directly into a shell command
- ansible.builtin.shell: "curl {{ user_supplied_url }}"
```

```yaml
# Safer — command avoids the shell entirely; no injection surface
- ansible.builtin.command: "curl {{ user_supplied_url }}"
```

```yaml
# Best — a real module, no shell involved at all
- ansible.builtin.uri:
    url: "{{ user_supplied_url }}"
```

Any `shell:` task built from a variable that isn't fully trusted is a real command-injection vector — see [Command vs. Shell](../modules/01-command-vs-shell-vs-raw-vs-script.md). Prefer `command` (no shell, no injection surface) or a real module over `shell` whenever the input isn't a fixed, trusted string.

## Common Mistakes

- Passing secrets via `-e` on a CI command line instead of Vault or a secret manager.
- `become_user: root` by default for tasks that only need one service account's privileges.
- Forgetting `no_log` on a task that touches a secret, leaking it into `-vvv` output or CI logs.
- Interpolating untrusted variables into `shell:` commands instead of using `command` or a real module.

## Interview Questions

- How does Ansible Vault protect secrets, and what are its limitations?
- How would you scope `become` to avoid giving every task root access?
- How can secrets accidentally leak through Ansible's own logging, and how do you prevent it?
- Why is `shell` a bigger injection risk than `command`, and when is that risk actually relevant?

See [Interview Prep: Roles, Collections & Modules](../interview-prep/04-roles-collections-and-modules-questions.md) and [Senior & Architect Questions](../interview-prep/05-senior-and-architect-questions.md) for the deeper scenarios.

## Next

Continue to [Performance](05-performance.md).
