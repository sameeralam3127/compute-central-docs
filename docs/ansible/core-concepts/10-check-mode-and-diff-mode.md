---
title: "Ansible Check Mode and Diff Mode (Dry Run)"
icon: lucide/eye
description: "How to dry run an Ansible playbook with --check and --diff, control it per task with check_mode and ansible_check_mode, and spot what a dry run can't show."
tags:
  - Ansible
  - Core Concepts
  - Check Mode
---

# Ansible Check Mode and Diff Mode

Check mode is Ansible's dry run: `--check` runs a playbook without changing anything, and `--diff` shows the exact lines that would change. Run both together for a dry run you can read, and know which tasks it can't preview.

## What You'll Learn

- How to dry run a playbook safely, one host first
- What `--check` and `--diff` do, and the task keywords and variables that control them
- How to tell from a module's documentation whether it supports check mode
- The two ways a dry run misleads you: taking the wrong branch, and failing where a real run works

## How to Dry Run an Ansible Playbook

```bash
ansible-playbook site.yml --check --diff --limit web01   # one host first
ansible-playbook site.yml --check --diff                 # then everything
ansible-playbook site.yml --diff                         # the real run, still showing what changed
```

1. **Add `--check`** so modules report what they *would* change without changing it. The short form is `-C`.
2. **Add `--diff`** to see the before and after of every file that would change. The short form is `-D`.
3. **Limit it to one host** the first time. Diff output is long, and one host is enough to review the change.
4. **Read the skipped tasks too.** A task that shows `skipping` wasn't previewed at all (see [which modules support check mode](#which-modules-support-check-mode)).

This is real output from ansible-core 2.22.0 for a template task, with the file paths adapted to this example:

```text
TASK [Deploy nginx configuration] ***
--- before: /etc/nginx/nginx.conf
+++ after: nginx.conf.j2
@@ -1,3 +1,3 @@
 events {
-    worker_connections 768;
+    worker_connections 1024;
 }
changed: [web01]
```

The task reports `changed`, but the file on `web01` still says `768` afterwards. That's the review step you want before applying an unfamiliar playbook to production.

## Mental Model

`--check` runs every task's check-then-act comparison **without performing the act**: each module reports what it *would* do, and the managed node is never touched. `--diff` adds a before/after view of any file content that would change, and works on its own too, during a real run.

## Check Mode Controls at a Glance

| Control | Where | What it does |
|---|---|---|
| `--check` (`-C`) | Command line | Simulate every task; modules report predicted changes |
| `--diff` (`-D`) | Command line | Show before/after for modules that support it, with or without `--check` |
| `check_mode: true` | Play, role, block, or task | Always simulate, even in a normal run |
| `check_mode: false` | Play, role, block, or task | Always run for real, even under `--check`. Only for tasks that change nothing |
| `diff: false` | Play, role, block, or task | Never return a diff, even under `--diff`. Use it for files with secrets |
| `ansible_check_mode` | Variable | `true` during `--check`; use it in `when:` |
| `ansible_diff_mode` | Variable | `true` when `--diff` is on |

`check_mode: true` is useful for a "what would change" report inside a real deployment. In a normal run, such a task still reports `changed` (with a diff, if `--diff` is on), but writes nothing.

## Which Modules Support Check Mode

Every module's documentation page has an **Attributes** table. Its `check_mode` row says `Support: full`, `partial`, or `none`, and a `diff_mode` row does the same for `--diff`:

| Module | `check_mode` | What that means in a dry run |
|---|---|---|
| `copy`, `template`, `lineinfile` | full | Predicts the change accurately |
| `command`, `shell` | partial | Skipped, unless `creates:` or `removes:` lets Ansible decide without running it |
| `get_url` | partial | Reports `changed` without saving the file, but still contacts the server |
| `uri` | none | Skipped entirely |

A module without support is skipped, with a message that says so. In ansible-core 2.22.0:

```text
"msg": "This action (ansible.builtin.uri) does not support check mode."
"msg": "Command would have run if not in check mode"
```

A module has to be written to support check mode (`supports_check_mode=True` internally, see [Build a Custom Module](../build-your-own/01-build-a-custom-module.md)).

## When a Dry Run Takes the Wrong Branch

A skipped task still registers a result, and its `stdout` is an empty string, not the value a real run would read. Later conditions quietly compare against that empty string:

```yaml
- name: Read the currently deployed release
  ansible.builtin.command: readlink /opt/checkout/current
  register: current_release
  changed_when: false

- name: Upgrade when the release differs
  ansible.builtin.include_tasks: upgrade.yml
  when: (current_release.stdout | basename) != app_release
```

Under `--check`, ansible-core 2.22.0 registers this for the first task:

```text
"current_release": {
    "changed": false,
    "msg": "Command would have run if not in check mode",
    "rc": 0,
    "skipped": true,
    "stdout": "",
    ...
}
```

`'' != app_release` is always true, so the dry run reports an upgrade even on a host that's already on `app_release`. Nothing fails, and the preview is simply wrong. The fix is to let the read-only command run for real:

```yaml
- name: Read the currently deployed release
  ansible.builtin.command: readlink /opt/checkout/current
  register: current_release
  changed_when: false
  check_mode: false      # safe to run for real: it only reads
```

Use `check_mode: false` only on tasks that genuinely change nothing. `changed_when` controls how a `command`/`shell` task *reports* its result (by default it reports `changed` whenever it runs), as in [command vs. shell vs. raw vs. script](../modules/01-command-vs-shell-vs-raw-vs-script.md). It doesn't make the task run in check mode.

## When a Dry Run Fails but the Real Run Works

The opposite problem: a task depends on something an earlier task only *pretended* to do.

```yaml
- name: Download the release
  ansible.builtin.get_url:
    url: https://releases.example.com/app-v42.tar.gz
    dest: /tmp/app-v42.tar.gz

- name: Unpack the release
  ansible.builtin.unarchive:
    src: /tmp/app-v42.tar.gz
    dest: /opt/app/releases
    remote_src: true
```

In check mode, `get_url` reports `changed` but saves nothing, so `unarchive` has nothing to unpack. Real output from ansible-core 2.22.0:

```text
TASK [Download the release] ***
changed: [web1]

TASK [Unpack the release] ***
fatal: [web1]: FAILED! => {"changed": false, "msg": "Source '/tmp/app-v42.tar.gz' does not exist"}
```

The same playbook without `--check` downloads and unpacks the archive. Guard steps that depend on an earlier change with `ansible_check_mode`:

```yaml
- name: Unpack the release
  ansible.builtin.unarchive:
    src: /tmp/app-v42.tar.gz
    dest: /opt/app/releases
    remote_src: true
  when: not ansible_check_mode
```

The same thing happens when a play installs a package and then starts its service: check mode doesn't install the package, so the service the next task looks for isn't there yet.

## What Most Engineers Miss

- **Skipped isn't the same as previewed.** `uri` calls and unguarded `command`/`shell` tasks disappear from the dry run, along with the results later tasks expect. Add `check_mode: false` to the read-only ones; see [URI and API Automation](../modules/04-uri-and-api-automation.md#check-mode-and-destructive-calls).
- **Check mode isn't offline.** `get_url` still contacts the server during `--check` and fails if it's unreachable, even though it never saves the file.
- **`--diff` prints file contents into your logs.** A template that contains passwords shows them, line by line, in CI output. Set `diff: false` on tasks that write secrets; `no_log: true` hides the diff as well.
- **Check mode predicts files, not behavior.** It can show that the new `nginx.conf` differs, but not that nginx will reject it. That's what `validate:` on [templates](../jinja2-and-templates/03-templates-for-config-generation.md#validate-before-it-goes-live) is for.
- **A clean dry run doesn't prove the playbook is idempotent.** Only a second real run that reports `changed=0` does; see [Idempotency](11-idempotency.md#how-to-test-for-idempotency).

!!! incident "Real incident: Facebook, October 2021"
    A command meant to *assess* backbone capacity took down every backbone link instead. The audit tool built to stop commands like it had a bug and let it through, and Facebook, Instagram, and WhatsApp were offline for about six hours. A dry run or a preflight check is a safety net with holes: test that it fires on an input it must reject, and keep a way in that doesn't depend on the system you're changing. [The CI test](../case-studies/08-automation-outages-and-guardrails.md#facebook-2021-the-audit-tool-had-a-bug) is in Automation Outages.

## Common Mistakes

- Trusting `--check` output for a playbook full of unguarded `command`/`shell` tasks. They're skipped, so the dry run doesn't preview what they'd do.
- Never running `--check --diff` before a first production run of a new or edited playbook.
- Assuming `--check` catches logic errors like a bad `when:`. It only tells you what modules *would* change, and conditions built on skipped tasks can make even that wrong.
- Adding `check_mode: false` to a task that changes something, so the "dry run" makes real changes.

## Check Yourself

!!! quiz "Download, then unpack"
    A play downloads an archive with `ansible.builtin.get_url`, then unpacks it with `ansible.builtin.unarchive` and `remote_src: true`. You run it with `--check` on a fresh server. What happens?

    - [ ] Both tasks report `changed` and nothing is touched
    - [x] The download reports `changed`, then the unpack fails: the archive was never saved
    - [ ] Both tasks are skipped

    Check mode only predicts the download, so the file doesn't exist when the next task looks for it. Add `when: not ansible_check_mode` to steps that depend on an earlier change.

!!! quiz "Secrets in the diff"
    A template renders a config file that contains a database password. Which setting keeps the password out of `--diff` output in CI?

    - [ ] `check_mode: false`
    - [x] `diff: false` on that task (or `no_log: true`)
    - [ ] `changed_when: false`

    `diff` is a task keyword: set to `false`, the task never returns before/after content, even when the run uses `--diff`.

!!! quiz "What did the dry run read?"
    `ansible.builtin.command: readlink /opt/app/current` has `changed_when: false` and `register: current`. During `--check`, what is `current.stdout`?

    - [ ] The real symlink target: `changed_when: false` marks the task as safe to run
    - [x] An empty string: the task was skipped, so any condition built on it compares against `''`
    - [ ] Undefined, so the next task that uses it fails

    `changed_when` controls how the result is reported, not whether the task runs. Add `check_mode: false` so a read-only command runs during a dry run.

## Interview Questions

- What does `--check` actually guarantee, and what does it not catch?
- Why are `command`/`shell` tasks skipped in check mode by default, and what do they register when skipped?
- What does `--diff` add on top of `--check`, and when would you set `diff: false`?
- How do `check_mode: false` and `when: not ansible_check_mode` differ, and when do you use each?

## Related

- [Testing roles with Molecule](../production-engineering/07-molecule-testing.md)
- [Error handling](../playbook-engineering/02-error-handling.md)

## Next

Continue to [Idempotency](11-idempotency.md), the concept this entire section has been building toward.
