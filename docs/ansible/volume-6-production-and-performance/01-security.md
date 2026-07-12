---
icon: lucide/shield
description: Ansible security in production — Vault, secrets management, SSH keys, become and privilege escalation, least privilege, credential management, Execution Environments, and sensitive logging.
tags:
  - Ansible
  - Volume 6
  - Security
---

# Part 31 — Security

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

Automation with elevated privileges across an entire fleet is a serious attack surface if handled carelessly. This chapter covers Ansible security end to end.

## Why This Exists

- Ansible frequently runs with `become: true` against production infrastructure, holding or transmitting secrets along the way — every security mistake here has fleet-wide blast radius, not single-host blast radius.

## Problem Statement

- Secrets need to exist somewhere (playbook repos, CI systems, control nodes) without being readable by anyone who shouldn't have them, and privilege escalation needs to be scoped as narrowly as the task actually requires.

## Internal Architecture

- **Vault**: AES256-based encryption for secrets at rest in playbook repositories, with `--vault-id` supporting multiple named vault passwords/keys for different trust domains (e.g., separate prod/staging vault passwords).
- **Become**: how privilege escalation (`sudo`, `su`, `pbrun`, etc.) wraps module execution on the managed node, and where `become_user`/`become_method` are resolved from the variable-precedence stack (Volume 2, Part 9).

## Step-by-Step Explanation

- **Secrets**: `ansible-vault encrypt`/`encrypt_string` for file- and value-level secrets; integrating with external secret managers (HashiCorp Vault, AWS Secrets Manager) via lookup plugins instead of committing encrypted values at all.
- **SSH keys**: key-based auth as the default trust model, agent forwarding tradeoffs, and per-environment key scoping.
- **Become**: least-privilege `become_user` targeting (not always root), and `become_method` choice based on the managed node's actual privilege-escalation tooling.
- **Least privilege**: scoping both SSH access and become targets to exactly what a given automation task needs, not blanket root/administrator access.
- **Credential management**: how Automation Controller's Credential objects (Volume 4, Part 21) remove secrets from playbooks entirely for teams running AAP.
- **Execution Environments**: as a security boundary — an EE (Volume 4, Part 22) limits what's installed and reachable during a job run, reducing supply-chain risk.
- **Sensitive logging**: `no_log: true` on tasks handling secrets, and why default verbose logging (`-vvv`) can leak secrets into CI logs if not paired with `no_log`.

## Production Best Practices

- Never committing plaintext secrets, even temporarily, even in a private repository — using Vault or an external secret manager from day one.
- Auditing `no_log` coverage on every task that touches a password, token, or key, especially in CI where logs may be more widely readable than expected.
- Rotating vault passwords and SSH keys on a schedule, not only after a suspected incident.

## Common Mistakes

- Passing secrets via `-e` on a CI command line, where they can end up in shell history or process listings.
- Using `become_user: root` by default for tasks that only need a service-specific user's privileges.
- Forgetting `no_log` on a debug task, leaking a secret into readable playbook output.

## Performance Considerations

- Vault decryption adds negligible per-run overhead; not a meaningful performance topic, noted for completeness.

## Security Considerations

- This entire chapter is the security chapter — cross-referenced explicitly from every other volume's "Security Considerations" section rather than duplicating detail there.

## Interview Questions

- "How does Ansible Vault protect secrets, and what are its limitations compared to an external secret manager?"
- "How would you scope `become` to avoid giving every task root access?"
- "How can secrets accidentally leak through Ansible's logging, and how do you prevent it?"

## Hands-On Lab

- Encrypt a variables file with `ansible-vault encrypt`, reference it from a playbook with `no_log: true` on the task that uses it, and run the playbook with `--ask-vault-pass`, confirming the secret never appears in output even at `-vvv`.

## Summary

- Ansible security is a combination of secrets-at-rest handling (Vault or external managers), least-privilege escalation (`become` scoping), and disciplined logging hygiene (`no_log`) — all three matter together, not individually.

## Next

Continue to [Part 32 — Performance and Scaling](02-performance-and-scaling.md).
