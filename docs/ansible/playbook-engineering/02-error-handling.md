---
title: "Ansible Error Handling: ignore_errors and failed_when"
icon: lucide/octagon-alert
description: "Ansible error handling: define failure with failed_when, keep going with ignore_errors, and stop a rollout with any_errors_fatal or max_fail_percentage."
tags:
  - Ansible
  - Playbook Engineering
  - Error Handling
---

# Error Handling

## What You'll Learn

- What Ansible does by default when a task fails on one host
- How to define failure precisely with `failed_when` and `changed_when`
- When `ignore_errors` is acceptable, and what it doesn't cover
- How `any_errors_fatal` and `max_fail_percentage` stop a whole rollout early

## Why This Exists

By default, a failed task on one host removes that host from the rest of the play but lets other hosts continue — that default is usually right, but not always, and this page covers the keywords that change it deliberately.

## Mental Model

> Ask two separate questions. **"What counts as failure for this task?"** — answered per task with `failed_when` or `ignore_errors`. **"How many failed hosts should stop everything?"** — answered per play with `any_errors_fatal` and `max_fail_percentage`.

| Scope | Keyword | Effect |
|---|---|---|
| Task | `failed_when` | Redefine failure from the result |
| Task | `changed_when` | Redefine "changed" from the result |
| Task | `ignore_errors` | Keep going on this host after a failure |
| Task | `ignore_unreachable` | Keep going if the host is unreachable for this task |
| Play | `any_errors_fatal` | One failed host stops the play for all hosts |
| Play | `max_fail_percentage` | Stop once too many hosts in a batch fail |

## Defining Failure: failed_when

`command` and `shell` fail on any non-zero exit code. Many tools use exit codes differently:

```yaml
- name: Check for pending schema migrations
  ansible.builtin.command: /opt/checkout/bin/migrate --status
  register: migrate_status
  changed_when: false
  # exit 0 = up to date, exit 2 = migrations pending, anything else = real error
  failed_when: migrate_status.rc not in [0, 2]

- name: Run pending migrations
  ansible.builtin.command: /opt/checkout/bin/migrate
  when: migrate_status.rc == 2
```

Combine conditions, including checks on output:

```yaml
- name: Validate the nginx configuration
  ansible.builtin.command: nginx -t
  register: nginx_test
  changed_when: false
  failed_when:
    - nginx_test.rc != 0
    - "'test is successful' not in nginx_test.stderr"
```

A list under `failed_when` means **all** conditions must be true (logical AND). Use `or` in a single expression for OR.

## Defining Change: changed_when

Read-only commands should never report `changed`, or every run looks like it modified the host:

```yaml
- name: Read the installed version
  ansible.builtin.command: /opt/checkout/bin/checkout --version
  register: installed_version
  changed_when: false

- name: Rotate the API key only if the tool says it did something
  ansible.builtin.command: /opt/checkout/bin/rotate-key
  register: rotate
  changed_when: "'rotated' in rotate.stdout"
```

This is what keeps `command`-based tasks compatible with [Idempotency](../core-concepts/11-idempotency.md) checks.

## ignore_errors: Rarely the Right First Instinct

```yaml
- name: Stop the legacy service if it happens to exist
  ansible.builtin.service:
    name: legacy-checkout
    state: stopped
  register: legacy_stop
  ignore_errors: true

- name: Report that the legacy service wasn't present
  ansible.builtin.debug:
    msg: "legacy-checkout not installed on {{ inventory_hostname }}"
  when: legacy_stop is failed
```

The task still shows as `failed` (with `...ignoring`) and counts in the recap's `ignored=` column. Two limits:

- It hides **every** failure of that task, including ones you didn't anticipate (a typo in the service name looks identical to "not installed").
- It doesn't cover unreachable hosts or syntax/undefined-variable errors. Use `ignore_unreachable: true` for the former.

Prefer `failed_when` whenever you can describe the acceptable outcome precisely.

## Failing on Purpose: assert and fail

```yaml
- name: Refuse to deploy without a release version
  ansible.builtin.assert:
    that:
      - app_release is defined
      - app_release is match('^[0-9]+\.[0-9]+\.[0-9]+$')
    fail_msg: "app_release must be set to a semantic version, got: {{ app_release | default('undefined') }}"
    quiet: true
```

Preflight assertions at the top of a play fail fast with a clear message, before anything changes.

## Stopping a Whole Rollout

### any_errors_fatal

```yaml
- name: Update the database cluster
  hosts: db
  any_errors_fatal: true
  tasks:
    - name: Apply cluster-wide configuration
      ansible.builtin.template:
        src: postgresql.conf.j2
        dest: /etc/postgresql/16/main/postgresql.conf
```

The moment any host fails, Ansible finishes the current task on the other hosts and then ends the play for **all** of them. Use it when a partial change is worse than no change — clustered databases, consensus systems.

### max_fail_percentage

```yaml
- name: Rolling update of 20 web servers
  hosts: web
  serial: 5
  max_fail_percentage: 20
  tasks:
    - name: Deploy new release
      ansible.builtin.include_role:
        name: checkout
```

The percentage is evaluated **per batch**. In a batch of 5, one failure is exactly 20%, which does *not* abort; the play aborts only when failures **exceed** the threshold (two failures, 40%). With `max_fail_percentage: 0`, any failure stops the rollout.

This pairs naturally with the stepped `serial` pattern in [Case Study: Rolling Nginx Deployment](../case-studies/01-rolling-nginx-deployment.md).

## Ending a Host or Play Cleanly

```yaml
- name: Skip hosts that are already on the target release
  ansible.builtin.meta: end_host
  when: running_release == app_release
```

`meta: end_host` stops the play for that host without marking it failed. `meta: end_play` does the same for every host.

## How These Interact With block/rescue

A task failure inside a [`block`](01-blocks-rescue-always.md) with a `rescue` doesn't count toward `max_fail_percentage` if `rescue` recovers the host. If you want a rescued rollback to still stop the rollout, end `rescue` with `ansible.builtin.fail`.

## Common Mistakes

- Reaching for `ignore_errors: true` to silence a failure instead of fixing the underlying `failed_when` logic — this hides real problems, not just cosmetic ones.
- Not setting `any_errors_fatal`/`max_fail_percentage` on a rollout that should stop early if early hosts are already failing.
- Forgetting `changed_when: false` on read-only `command` tasks, so every run reports changes.
- Assuming `max_fail_percentage: 20` stops a 5-host batch after one failure — it has to be exceeded, not reached.
- Expecting `ignore_errors` to keep going when a host becomes unreachable.

## Interview Questions

- What's the difference between `ignore_errors` and `failed_when`?
- How would you stop an entire rollout early if 20% of hosts fail?
- A `command` task reports `changed` on every run. How do you fix it without changing the command?
- When would you choose `any_errors_fatal` over `max_fail_percentage`?

## Next

Continue to [Imports vs. Includes](03-imports-vs-includes.md).
