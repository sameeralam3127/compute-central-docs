---
title: "Ansible Ad-Hoc Commands: Syntax and Examples"
icon: lucide/terminal
description: Ansible ad-hoc commands — running a single module against inventory without writing a playbook, and when to graduate to one.
tags:
  - Ansible
  - Core Concepts
---

# Ad-Hoc Commands

## What You'll Learn

- The `ansible` CLI syntax for one-off module calls
- When an ad-hoc command is the right tool, and when it isn't

## Mental Model

An ad-hoc command is a playbook with exactly one task and no file. Same modules, same connection machinery, same JSON result contract — just typed directly at the shell for something you'll run once, not something meant to be re-run or reviewed later.

```bash
ansible <pattern> -m <module> -a "<arguments>"
```

## Examples

```bash
# Connectivity check
ansible web -m ping

# Run a raw command
ansible web -m command -a "uptime"

# Install a package (needs become)
ansible web -m ansible.builtin.package -a "name=nginx state=present" -b

# Copy a file
ansible web -m ansible.builtin.copy -a "src=./motd dest=/etc/motd" -b

# Check disk space everywhere
ansible all -m command -a "df -h"
```

`-b` (short for `--become`) escalates privilege the same way `become: true` does in a playbook.

## When to Use an Ad-Hoc Command

- Checking something ("is nginx running on every web server right now?")
- A genuine one-off action with no reason to ever repeat it
- Quick exploration while writing a real playbook (confirming a module's output shape before committing it to YAML)

## When to Graduate to a Playbook

- Anything you'll run more than once
- Anything that should be reviewed, versioned, or run in CI
- Anything with more than one task, or any conditional logic

!!! warning "An ad-hoc command is not idempotency-checked by you"
    The module itself still behaves idempotently (or doesn't) exactly as it would in a playbook — but there's no file to review, no `--check` dry run habit, and no git history. Treat ad-hoc commands as read-mostly tools; write a real playbook for anything that changes state repeatedly.

## Common Mistakes

- Building a "playbook" out of a shell history of ad-hoc commands instead of an actual YAML file — nothing about it is reviewable or re-runnable by a teammate.
- Forgetting `-b` and getting a permission error that looks like a connection problem.
- Using `command`/`shell` ad hoc for something a real module already does better — see [command vs. shell vs. raw vs. script](../modules/01-command-vs-shell-vs-raw-vs-script.md).

## Interview Questions

- What's the difference between an ad-hoc command and a playbook?
- When would you reach for `ansible` instead of `ansible-playbook`?

## Next

Continue to [Playbooks, Plays, and Tasks](03-playbooks-plays-tasks.md).
