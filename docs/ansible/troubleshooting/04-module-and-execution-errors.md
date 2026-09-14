---
title: "Fix Ansible Module Errors: Not Found, MODULE FAILURE, setup"
icon: lucide/octagon-x
description: "Fix Ansible module and execution errors — couldn't resolve module, missing Python, MODULE FAILURE, ansible.legacy.setup failed to execute, and module result deserialization failed."
tags:
  - Ansible
  - Troubleshooting
---

# Module and Execution Errors

## What You'll Learn

- How to fix "couldn't resolve module/action" in under a minute
- How to handle missing or wrong Python interpreters on managed nodes
- How to read `MODULE FAILURE` and missing-library errors
- How to inspect exactly what a module did on the managed node

## Why This Exists

By the time a task reaches this category, SSH connected and `become` (if any) succeeded — the failure is in the module's own execution on the managed node, or in how the task called it.

## Mental Model

> A module failure has three possible homes. **Control node**: the module can't be found or packaged. **Managed node environment**: no suitable Python, or a missing Python library. **The module's own logic**: it ran, and it's telling you why it refused. The error message almost always says which — read past the `FAILED!` wrapper to the `msg`.

## "couldn't resolve module/action"

```text
ERROR! couldn't resolve module/action 'community.general.ufw'. This often indicates a
misspelling, missing collection, or incorrect module path.
```

This happens on the **control node**, before anything is sent to hosts. Check in order:

```bash
# 1. Is the collection installed where this project looks?
ansible-galaxy collection list community.general

# 2. Is the FQCN spelled correctly?
ansible-doc -l | grep -i ufw

# 3. Which collections path is in effect?
ansible-config dump --only-changed | grep -i collections
```

| Cause | Fix |
|---|---|
| Collection not installed | `ansible-galaxy collection install -r collections/requirements.yml` |
| Installed, but in a path this project doesn't search | Set `collections_path` in `ansible.cfg`; see [Installing and Using Collections](../collections/02-installing-and-using-collections.md) |
| Typo or wrong namespace (`community.general.authorized_key` vs `ansible.posix.authorized_key`) | Use `ansible-doc` to find the right FQCN |
| Module was moved to another collection in a newer release | Check the collection changelog and `meta/runtime.yml` redirects |
| Running in an Execution Environment that lacks the collection | Add it to the EE's `requirements.yml` and rebuild |

## Python Interpreter Problems

```text
fatal: [legacy01]: FAILED! => {"changed": false, "module_stderr": "/bin/sh: 1: /usr/bin/python3: not found\n",
  "msg": "The module failed to execute correctly, you probably need to set the interpreter."}
```

Most modules are Python programs that run **on the managed node**. Ansible discovers an interpreter automatically; this error means it didn't find a usable one.

### No Python at all (minimal images, appliances)

Bootstrap with `raw`, which needs only a shell — see [Architecture and Execution](../getting-started/02-architecture-and-execution.md):

```yaml
- name: Bootstrap Python on minimal hosts
  hosts: new_hosts
  gather_facts: false
  become: true
  tasks:
    - name: Install Python 3
      ansible.builtin.raw: test -e /usr/bin/python3 || (apt-get update && apt-get install -y python3)
      changed_when: false
```

### Python exists, but in a non-standard place

```ini title="group_vars/appliances.yml"
ansible_python_interpreter: /opt/python3.12/bin/python3
```

### Python is too old

Recent `ansible-core` releases require Python 3 on managed nodes; support for Python 2.7 and 3.6 targets was dropped in `ansible-core` 2.17. Very old hosts need either a newer Python installed alongside the system one, or an older `ansible-core` in a separate environment for just those hosts.

Silence the interpreter-discovery warning once you've confirmed the choice is right:

```ini title="ansible.cfg"
[defaults]
interpreter_python = auto_silent
```

## Missing Python Library on the Managed Node

```text
fatal: [db01]: FAILED! => {"changed": false, "msg": "Failed to import the required Python library (psycopg2) on db01's Python /usr/bin/python3. Please read the module documentation and install it in the appropriate location."}
```

Some modules need libraries on the **target**, not the control node. Install them as a task before use:

```yaml
- name: Install the PostgreSQL client library the postgresql_* modules need
  ansible.builtin.package:
    name: python3-psycopg2
    state: present
```

Modules that talk to cloud APIs (`amazon.aws.*`) usually run on the control node via `delegate_to: localhost` or `hosts: localhost`, so *their* libraries (`boto3`) belong on the control node or in the Execution Environment. The error message names the host and interpreter — that's where to install.

## "MODULE FAILURE"

```text
fatal: [web01]: FAILED! => {"changed": false, "module_stderr": "Traceback (most recent call last):\n ...\nPermissionError: [Errno 13] Permission denied: '/etc/checkout/app.conf'\n", "module_stdout": "", "msg": "MODULE FAILURE\nSee stdout/stderr for the exact error", "rc": 1}
```

`MODULE FAILURE` means the module crashed instead of returning a clean error. The generic `msg` is useless; `module_stderr` has the real cause — here a permission problem, which belongs in [Become and Permission Problems](02-become-and-permission-problems.md).

For readable output, switch the callback:

```ini title="ansible.cfg"
[defaults]
stdout_callback = ansible.builtin.default
result_format = yaml
```

## "The following modules failed to execute: ansible.legacy.setup"

```text
fatal: [web01]: FAILED! => {"ansible_facts": {}, "changed": false, "failed_modules": {"ansible.legacy.setup": {"failed": true, "module_stderr": "...", "msg": "MODULE FAILURE\nSee stdout/stderr for the exact error", "rc": 1}}, "msg": "The following modules failed to execute: ansible.legacy.setup\n"}
```

`ansible.legacy.setup` is the module behind the implicit **Gathering Facts** step, so the play failed before your first task. The real cause is in `module_stderr` inside `failed_modules`:

| `module_stderr` shows | Cause | Fix |
|---|---|---|
| `python3: not found`, or a `SyntaxError` | No Python, or a Python too old for this `ansible-core` | [Python Interpreter Problems](#python-interpreter-problems) |
| `Permission denied`, or a sudo message | Escalation failed while gathering facts | [Become and Permission Problems](02-become-and-permission-problems.md) |
| `No space left on device` | Ansible can't write the module to the remote temp directory | Free space, or point `remote_tmp` at a filesystem with room |
| Nothing, and the task times out | A hung mount (often NFS) that hardware fact gathering tries to read | Skip those facts with `gather_subset: ["!hardware"]`, then fix the mount |

To confirm the rest of the play works while you investigate, run it once with `gather_facts: false`.

## "Module result deserialization failed: No start of json char found"

```text
fatal: [web01]: FAILED! => {"msg": "Module result deserialization failed: No start of json char found"}
```

A module reports its result by printing a JSON document. This error means Ansible got output back but found no JSON in it at all, so the module never really ran or something replaced its output. Common causes:

- `ansible_python_interpreter` points at something that isn't a working Python: a wrapper script, a deleted virtualenv, or a different program.
- A custom module in `library/` prints plain text instead of calling `module.exit_json()`.
- A shell startup file or wrapper on the host exits early for non-interactive sessions.

Run the task with `-vvv` and read `module_stdout` and `module_stderr`, which show what actually came back. Then test the interpreter directly:

```bash
ansible web01 -m ansible.builtin.raw -a "/usr/bin/python3 --version"
```

## Reading a Module's Own msg

When a module handles the error itself, `msg` is specific and usually tells you the fix:

```text
fatal: [web01]: FAILED! => {"changed": false, "msg": "No package matching 'ngnix' is available"}
fatal: [web01]: FAILED! => {"changed": false, "msg": "Unable to start service checkout: Job for checkout.service failed because the control process exited with error code."}
fatal: [web01]: FAILED! => {"changed": false, "msg": "Destination directory /opt/checkout/releases does not exist"}
```

For service failures, the module only relays systemd's summary. Get the details from the host:

```bash
ansible web01 -m ansible.builtin.command -a "journalctl -u checkout -n 50 --no-pager" --become
```

## command and shell: Non-Zero Exit Codes

```text
fatal: [web01]: FAILED! => {"changed": true, "cmd": ["grep", "-q", "feature_x", "/etc/app.conf"], "rc": 1, "stderr": "", "stdout": ""}
```

`command` and `shell` fail on any non-zero exit code, but many tools use exit codes as answers (`grep` returns 1 for "no match"). Define failure explicitly:

```yaml
- name: Check whether feature_x is configured
  ansible.builtin.command: grep -q feature_x /etc/app.conf
  register: feature_check
  changed_when: false
  failed_when: feature_check.rc not in [0, 1]
```

See [Error Handling](../playbook-engineering/02-error-handling.md) and [Command vs. Shell](../modules/01-command-vs-shell-vs-raw-vs-script.md).

## Inspecting What Actually Ran on the Host

When an error makes no sense, keep the module files on the host and run them yourself:

```bash
ANSIBLE_KEEP_REMOTE_FILES=1 ansible-playbook site.yml --limit web01 \
  --start-at-task "Deploy nginx configuration" -vvvv
```

The `-vvvv` output shows the temporary directory, for example `/home/deploy/.ansible/tmp/ansible-tmp-1726212345.67-1234/`. On the host:

```bash
cd /home/deploy/.ansible/tmp/ansible-tmp-1726212345.67-1234/
ls                                  # AnsiballZ_template.py or similar
sudo /usr/bin/python3 AnsiballZ_template.py
```

The module runs with the same arguments and prints its full JSON result or traceback. Delete these directories afterwards — they can contain arguments, including secrets. With pipelining on, no files are written; disable it for this debugging run (`ANSIBLE_PIPELINING=False`).

For problems in Ansible itself on the control node (plugin loading, connection negotiation), `ANSIBLE_DEBUG=1` prints internal debug logs — very verbose, and it can include sensitive values.

## Common Mistakes

- Reading only `msg: MODULE FAILURE` and never looking at `module_stderr`.
- Installing a missing Python library on the control node when the error says the managed node needs it (or the reverse).
- Using short module names and getting a module from an unexpected collection, or none.
- Letting `command`/`shell` fail on exit codes that are normal answers.
- Leaving `ANSIBLE_KEEP_REMOTE_FILES` temp directories full of arguments on hosts after debugging.

## Interview Questions

- A task fails with "couldn't resolve module/action" — what are the two most likely causes?
- How would you inspect exactly what a module did on the managed node, beyond the summarized error Ansible shows?
- A module says it can't import `psycopg2`. Where do you install it, and how do you know?
- How do you manage hosts that have no Python installed?

## Next

Return to [Troubleshooting](index.md), or continue to [Interview Preparation](../interview-prep/index.md).
