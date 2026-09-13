---
title: "Ansible async and poll for Long-Running Tasks"
icon: lucide/clock
description: Ansible async and poll — running long tasks in the background and checking on them later, instead of blocking the whole play.
tags:
  - Ansible
  - Playbook Engineering
---

# Async and Poll

## What You'll Learn

- What `async` and `poll` control, and the three combinations you'll use
- How to launch a job, continue the play, and check on it later with `async_status`
- How to run slow loop items concurrently, and how to collect their results
- How async avoids SSH timeouts on long-running tasks

## Why This Exists

A task that takes ten minutes (a large file download, a slow database migration) blocks the entire play for that host by default — `async`/`poll` lets Ansible kick it off and check back later, or fire-and-forget entirely.

## Mental Model

> `async: N` says "run this in the background on the managed node, and kill it if it runs longer than N seconds." `poll: M` says "check back every M seconds and wait for it" — or, with `poll: 0`, "don't wait at all; give me a job ID."

| Settings | Behavior |
|---|---|
| no `async` | Normal task: holds the connection until done |
| `async: 1800`, `poll: 15` | Runs in the background but the play still **waits**, checking every 15 s. Avoids SSH/connection timeouts on long tasks |
| `async: 1800`, `poll: 0` | Fire and forget: the play moves on immediately and you check later with `async_status` |

## Waiting Without Holding a Connection

```yaml
- name: Rebuild the search index (takes ~20 minutes)
  ansible.builtin.command: /opt/search/bin/reindex --full
  async: 3600
  poll: 30
```

Without `async`, a 20-minute command holds an SSH session open the whole time and can be killed by an idle timeout on a firewall or bastion. With it, each check is a short, fresh connection.

## Fire and Forget, Then Check Later

```yaml
- name: Start the nightly backup in the background
  ansible.builtin.command: /usr/local/bin/backup-db --target s3://backups/checkout
  async: 7200            # hard ceiling: 2 hours
  poll: 0
  register: backup_job

- name: Meanwhile, rotate logs
  ansible.builtin.command: logrotate -f /etc/logrotate.d/checkout

- name: Wait for the backup to finish
  ansible.builtin.async_status:
    jid: "{{ backup_job.ansible_job_id }}"
  register: backup_result
  until: backup_result.finished
  retries: 240
  delay: 30              # 240 × 30 s = up to 2 hours

- name: Clean up the job's status file
  ansible.builtin.async_status:
    jid: "{{ backup_job.ansible_job_id }}"
    mode: cleanup
```

`backup_result` has the finished task's real result (`rc`, `stdout`, `stderr`), so you can use `failed_when` on it like any other result. Make `retries × delay` at least as long as `async`, or you'll stop waiting before the job's own ceiling.

!!! note "A job ID belongs to one host"
    `async_status` must run on the same host that started the job. That happens naturally when both tasks are in the same play.

## Running Loop Items Concurrently

A normal `loop` runs items one after another on each host. With `poll: 0`, each item is launched and the loop moves straight on, so the items **do** run at the same time:

```yaml
- name: Download large model files in parallel
  ansible.builtin.get_url:
    url: "https://artifacts.example.com/models/{{ item }}"
    dest: "/srv/models/{{ item }}"
  loop:
    - embeddings-v3.bin
    - reranker-v2.bin
    - classifier-v7.bin
  async: 1800
  poll: 0
  register: downloads

- name: Wait for every download
  ansible.builtin.async_status:
    jid: "{{ item.ansible_job_id }}"
  loop: "{{ downloads.results }}"
  loop_control:
    label: "{{ item.item }}"
  register: download_status
  until: download_status.finished
  retries: 60
  delay: 30
```

With `poll` greater than zero, the loop is still sequential: each item is backgrounded but waited on before the next starts. And none of this replaces **host** parallelism, which comes from `forks` — see [Forks, Serial, Strategy, and Throttle](../advanced-execution/01-forks-serial-strategy-throttle.md).

## Limiting Concurrency

Launching 50 heavy jobs at once can overwhelm a host or the service they call. Batch them with `throttle` at the task level, or split the list:

```yaml
- name: Start at most 4 exports at a time per batch
  ansible.builtin.include_tasks: export_batch.yml
  loop: "{{ tenants | batch(4) | list }}"
  loop_control:
    loop_var: tenant_batch
```

Each included file launches its batch with `poll: 0` and waits with `async_status` before the next batch begins.

## When Not to Use Async

- **Tasks later steps depend on.** If the next task needs the result, a normal task (or `poll > 0`) is clearer.
- **Check mode.** Background jobs and check mode don't mix well; guard with `when: not ansible_check_mode`.
- **Reboots.** Use `ansible.builtin.reboot`, which handles disconnect and reconnect for you.

## Common Mistakes

- Assuming `async` with `poll > 0` makes a `loop` run in parallel — it doesn't; only `poll: 0` plus `async_status` does.
- Setting `async` too low, so the job is killed mid-run once the ceiling is hit.
- Setting `retries × delay` shorter than the job's real runtime, so the play fails while the job is still healthy.
- Never checking a `poll: 0` job, so failures are silent.
- Forgetting `mode: cleanup` on very frequent jobs, leaving status files to accumulate in `~/.ansible_async`.

## Interview Questions

- What's the difference between `poll: 0` and a normal blocking task?
- How would you check on a fire-and-forget async task later in the same playbook?
- Why would you use `async` with `poll: 30` rather than no async at all?
- How do you download ten files concurrently on each host and still fail the play if one download fails?

## Next

Continue to [Advanced Execution](../advanced-execution/index.md).
