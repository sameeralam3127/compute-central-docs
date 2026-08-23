---
title: "Ansible Check Mode and Diff Mode (Dry Run)"
icon: lucide/eye
description: Ansible --check and --diff — dry-running a playbook to see what would change before it actually changes anything.
tags:
  - Ansible
  - Core Concepts
  - Check Mode
---

# Check Mode and Diff Mode

## What You'll Learn

- What `--check` actually does, and its limits
- What `--diff` adds on top of it
- Why `changed_when`/`failed_when` matter for check mode with `command`/`shell`

## Mental Model

`--check` runs every task's check-then-act comparison **without performing the act** — each module reports what it *would* do, but the managed node is never touched. `--diff` adds a before/after view of any file content that would change.

```bash
ansible-playbook site.yml --check --diff
```

```text
TASK [Deploy nginx configuration] ***
--- before: /etc/nginx/nginx.conf
+++ after: nginx.conf.j2
@@ -12,7 +12,7 @@
-worker_connections 768;
+worker_connections 1024;
changed: [web01]
```

This ran with zero actual changes to `web01` — exactly the review step you want before applying an unfamiliar playbook to production.

## The Limit: Not Every Module Supports Check Mode

A module has to be written to support it (`supports_check_mode=True` internally, see [Build a Custom Module](../build-your-own/01-build-a-custom-module.md)). Most `ansible.builtin` modules do. `command` and `shell` **cannot** know what they'd change without actually running — by default, Ansible skips them in check mode entirely, unless you tell it otherwise:

```yaml
- name: Restart the app only if a new build exists
  ansible.builtin.command: systemctl restart app
  when: new_build.stat.exists
  changed_when: new_build.stat.exists
  check_mode: false   # explicitly still run this even in --check, if you're sure it's safe
```

`changed_when` overrides how a `command`/`shell` task reports change (by default it reports `changed` any time its return code is `0`, which is almost never what you want) — see it used the same way for idempotency workarounds in [command vs. shell vs. raw vs. script](../modules/01-command-vs-shell-vs-raw-vs-script.md).

## Common Mistakes

- Trusting `--check` output for a playbook full of unguarded `command`/`shell` tasks — they're silently skipped, so the dry run doesn't actually preview what they'd do.
- Never running `--check --diff` before a first production run of a new or edited playbook.
- Assuming `--check` catches logic errors like a bad `when:` — it only tells you what modules *would* change, not whether your playbook's logic is correct.

## Interview Questions

- What does `--check` actually guarantee, and what does it not catch?
- Why are `command`/`shell` tasks skipped in check mode by default?
- What does `--diff` add on top of `--check`?

## Next

Continue to [Idempotency](11-idempotency.md) — the concept this entire section has been building toward.
