---
icon: lucide/file-code
description: Write and run your first Ansible playbook, target inventory groups, use privilege escalation, add conditions, and validate changes with check mode.
tags:
  - Playbooks
---

# Ansible Playbooks: First Automation Workflow

Playbooks are where Ansible becomes useful in practice. They describe what should happen on a group of hosts in a readable YAML format.

## Example Playbook

```yaml
---
- name: Install Apache on webservers
  hosts: webservers
  become: yes
  tasks:
    - name: Ensure Apache is installed
      apt:
        name: apache2
        state: present
      when: ansible_os_family == "Debian"
```

## Run the Playbook

```bash
ansible-playbook -i hosts.ini playbook.yml
```

## What This Playbook Does

- Targets the `webservers` group
- Uses privilege escalation with `become`
- Installs Apache on Debian-based systems

## Practical Advice

- Start with one small, testable task
- Use meaningful task names
- Run with `--check` before applying changes when possible

## Quick Check

```bash
ansible-playbook -i hosts.ini playbook.yml --check
```
