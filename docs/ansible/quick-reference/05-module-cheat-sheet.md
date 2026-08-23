---
title: "Ansible Module Cheat Sheet"
icon: lucide/package
description: A quick module-selection reference — which ansible.builtin module to reach for, by task.
tags:
  - Ansible
  - Quick Reference
---

# Module Cheat Sheet

| Need to... | Module |
|---|---|
| Install/remove a package (any distro) | `ansible.builtin.package` |
| Install/remove a package (Debian-specific features) | `ansible.builtin.apt` |
| Install/remove a package (RHEL-specific features) | `ansible.builtin.dnf` |
| Start/stop/restart/enable a service | `ansible.builtin.service` (or `systemd_service`) |
| Copy a static file | `ansible.builtin.copy` |
| Render a Jinja2 template to a file | `ansible.builtin.template` |
| Set file permissions/ownership, create a directory or symlink | `ansible.builtin.file` |
| Check whether a file/path exists, and its metadata | `ansible.builtin.stat` |
| Ensure one line exists/is correct in a file | `ansible.builtin.lineinfile` |
| Ensure a marked block exists in a file | `ansible.builtin.blockinfile` |
| Regex-replace content in a file | `ansible.builtin.replace` |
| Create/remove a user | `ansible.builtin.user` |
| Create/remove a group | `ansible.builtin.group` |
| Manage an SSH authorized key | `ansible.builtin.authorized_key` |
| Schedule a cron job | `ansible.builtin.cron` |
| Run a command with no shell | `ansible.builtin.command` |
| Run a command needing pipes/redirects | `ansible.builtin.shell` |
| Bootstrap a host with no Python | `ansible.builtin.raw` |
| Call an HTTP API | `ansible.builtin.uri` |
| Download a file over HTTP | `ansible.builtin.get_url` |
| Extract an archive | `ansible.builtin.unarchive` |
| Clone/update a git repository | `ansible.builtin.git` |
| Print a variable/message for debugging | `ansible.builtin.debug` |
| Assert a condition, failing the play if false | `ansible.builtin.assert` |
| Fail deliberately with a message | `ansible.builtin.fail` |
| Set a runtime variable | `ansible.builtin.set_fact` |
| Include a static task file | `ansible.builtin.import_tasks` |
| Include a dynamic task file | `ansible.builtin.include_tasks` |
| Include a role dynamically | `ansible.builtin.include_role` |

## Related

Full decision trees: [Command vs. Shell vs. Raw vs. Script](../modules/01-command-vs-shell-vs-raw-vs-script.md) · [Module Decision Trees](../modules/02-module-decision-trees.md)
