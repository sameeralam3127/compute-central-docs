---
title: "Ansible Check Mode and Diff Mode (Dry Run)"
icon: lucide/eye
description: "Ansible --check dry-runs a playbook without changing anything, and --diff shows the exact lines that would change. Plus the modules that can't be dry-run."
tags:
  - Ansible
  - Core Concepts
  - Check Mode
---

# Check Mode and Diff Mode

`--check` runs a playbook without changing anything, and `--diff` shows the exact lines that would change. Run both together for a dry run you can read.

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

A module has to be written to support it (`supports_check_mode=True` internally, see [Build a Custom Module](../build-your-own/01-build-a-custom-module.md)). Most `ansible.builtin` modules do. `command` and `shell` **cannot** know what they'd change without actually running, so in check mode Ansible skips them. The exception is a task with `creates:` or `removes:`, which Ansible can evaluate without running the command.

That skip causes a real problem for **read-only** commands whose output later tasks need:

```yaml
- name: Read the currently deployed release
  ansible.builtin.command: readlink /opt/checkout/current
  register: current_release
  changed_when: false
  check_mode: false      # safe to run for real: it only reads

- name: Upgrade when the release differs
  ansible.builtin.include_tasks: upgrade.yml
  when: (current_release.stdout | basename) != app_release
```

Without `check_mode: false`, the first task is skipped under `--check`, `current_release.stdout` doesn't exist, and the dry run fails on the second task, even though a real run would work. Use `check_mode: false` only on tasks that genuinely change nothing.

`changed_when` overrides how a `command`/`shell` task reports change (by default it reports `changed` any time its return code is `0`, which is almost never what you want) — see it used the same way for idempotency workarounds in [command vs. shell vs. raw vs. script](../modules/01-command-vs-shell-vs-raw-vs-script.md). It does not make the task run in check mode.

The opposite control also exists: `check_mode: true` on a task makes it **always** dry-run, even in a normal run. That's useful for a "what would change" report task inside a real deployment.

`ansible_check_mode` is a variable that's `true` during `--check`. Use it to skip steps that can't work in a dry run, such as unpacking an archive the previous (dry-run) task never downloaded: `when: not ansible_check_mode`.

## Common Mistakes

- Trusting `--check` output for a playbook full of unguarded `command`/`shell` tasks — they're silently skipped, so the dry run doesn't actually preview what they'd do.
- Never running `--check --diff` before a first production run of a new or edited playbook.
- Assuming `--check` catches logic errors like a bad `when:` — it only tells you what modules *would* change, not whether your playbook's logic is correct.

## Interview Questions

- What does `--check` actually guarantee, and what does it not catch?
- Why are `command`/`shell` tasks skipped in check mode by default?
- What does `--diff` add on top of `--check`?

## Related

- [Testing roles with Molecule](../production-engineering/07-molecule-testing.md)

## Next

Continue to [Idempotency](11-idempotency.md) — the concept this entire section has been building toward.
