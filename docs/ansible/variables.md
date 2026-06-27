---
icon: lucide/database
description: Learn Ansible variables, where to define values, how variables support reusable playbooks, and how to inspect variable behavior while practicing automation.
tags:
  - Variables
---

# Ansible Variables Guide

Variables help you keep playbooks flexible instead of hardcoding values for every host.

## Group Variables

Use group variables when the same value applies to many hosts.

```yaml
http_port: 80
ntp_servers:
  - 0.pool.ntp.org
  - 1.pool.ntp.org
```

## Host Variables

Use host variables only when one server needs different values.

```yaml
http_port: 8080
```

## Practical Advice

- Put shared values in group variables first
- Keep host variables small and specific
- Use clear names that match the service or purpose

## Quick Check

```bash
ansible-inventory -i inventory.ini --host myserver
```
