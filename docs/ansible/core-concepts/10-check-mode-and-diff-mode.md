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

## What Most Engineers Miss

- **Some modules are skipped entirely.** Modules without check-mode support, `uri` among them, don't run at all under `--check`, so every API call disappears from the dry run, along with the results later tasks expect. Add `check_mode: false` to the read-only ones; see [URI and API Automation](../modules/04-uri-and-api-automation.md#check-mode-and-destructive-calls).
- **A dry run can fail where the real run succeeds.** In check mode, `package` reports it would install nginx but doesn't, so the next task, `service: name=nginx state=started`, fails because there is no nginx service yet. Guard steps that depend on an earlier change with `when: not ansible_check_mode`.
- **`--diff` prints file contents into your logs.** A template that contains passwords shows them, line by line, in CI output. Set `diff: false` on tasks that write secrets; `no_log: true` hides the diff as well.
- **Check mode predicts files, not behavior.** It can show that the new `nginx.conf` differs, but not that nginx will reject it. That's what `validate:` on [templates](../jinja2-and-templates/03-templates-for-config-generation.md#validate-before-it-goes-live) is for.

!!! incident "Real incident: Facebook, October 2021"
    A command meant to *assess* backbone capacity took down every backbone link instead. The audit tool built to stop commands like it had a bug and let it through, and Facebook, Instagram, and WhatsApp were offline for about six hours. A dry run or a preflight check is a safety net with holes: test that it fires on an input it must reject, and keep a way in that doesn't depend on the system you're changing. [The CI test](../case-studies/08-automation-outages-and-guardrails.md#facebook-2021-the-audit-tool-had-a-bug) is in Automation Outages.

## Common Mistakes

- Trusting `--check` output for a playbook full of unguarded `command`/`shell` tasks — they're silently skipped, so the dry run doesn't actually preview what they'd do.
- Never running `--check --diff` before a first production run of a new or edited playbook.
- Assuming `--check` catches logic errors like a bad `when:` — it only tells you what modules *would* change, not whether your playbook's logic is correct.

## Check Yourself

!!! quiz "Install, then start"
    A play installs nginx with `ansible.builtin.package`, then starts it with `ansible.builtin.service`. You run it with `--check` on a fresh server. What happens?

    - [ ] Both tasks report `changed` and nothing is touched
    - [x] The install reports `changed`, then the start fails: nginx was never actually installed
    - [ ] Both tasks are skipped

    Check mode only predicts the install, so the service doesn't exist when the next task looks for it. Add `when: not ansible_check_mode` to steps that depend on an earlier change.

!!! quiz "Secrets in the diff"
    A template renders a config file that contains a database password. Which setting keeps the password out of `--diff` output in CI?

    - [ ] `check_mode: false`
    - [x] `diff: false` on that task (or `no_log: true`)
    - [ ] `changed_when: false`

    `diff` is a task keyword: set to `false`, the task never returns before/after content, even when the run uses `--diff`.

!!! quiz "Read-only, but skipped"
    `ansible.builtin.command: readlink /opt/app/current` has `changed_when: false`. Does it run during `--check`?

    - [ ] Yes: `changed_when: false` marks it as safe
    - [x] No: `command` is skipped in check mode unless the task sets `check_mode: false`
    - [ ] Only if `--diff` is also set

    `changed_when` controls how the result is reported, not whether the task runs. `check_mode: false` is what makes a read-only command run during a dry run.

## Interview Questions

- What does `--check` actually guarantee, and what does it not catch?
- Why are `command`/`shell` tasks skipped in check mode by default?
- What does `--diff` add on top of `--check`?

## Related

- [Testing roles with Molecule](../production-engineering/07-molecule-testing.md)

## Next

Continue to [Idempotency](11-idempotency.md) — the concept this entire section has been building toward.
