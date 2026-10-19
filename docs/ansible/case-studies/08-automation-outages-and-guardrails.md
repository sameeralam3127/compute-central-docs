---
title: "Automation Outages: 9 Real Incidents and the Ansible Fix"
icon: lucide/siren
description: "Nine real outages caused by automation, from AWS S3 and GitLab to CrowdStrike and Cloudflare, and the Ansible guardrail that would have contained each one."
tags:
  - Ansible
  - Case Studies
  - Incidents
---

# Automation Outages and the Guardrails That Contain Them

Most outages caused by automation come from one of four mistakes: **a bad input**, **the wrong target**, **a change applied everywhere at once**, or **two runs racing each other**. Each has a cheap, specific guardrail in Ansible. This page walks through nine public postmortems: what happened, why it spread, and the few lines of YAML that would have stopped it or kept it small.

None of these companies was careless. Every one had automation, reviews, and experienced engineers. That's the point: the guardrails below are for the day a careful person makes an ordinary mistake.

| Incident | What went wrong | Ansible guardrail |
|---|---|---|
| [AWS S3, 2017](#aws-s3-2017-a-typo-in-an-established-playbook) | A mistyped input removed too many servers | `assert` the blast radius, then remove in `serial` batches |
| [GitLab.com, 2017](#gitlabcom-2017-the-right-command-on-the-wrong-server) | A wipe ran on the primary database | Check live state on the host, not just its inventory group |
| [Knight Capital, 2012](#knight-capital-2012-seven-servers-out-of-eight) | One of eight servers kept old code | `any_errors_fatal` and a version check across every host |
| [Facebook, 2021](#facebook-2021-the-audit-tool-had-a-bug) | The safety check had a bug | Test that guards fire, with a negative test in CI |
| [CrowdStrike, 2024](#crowdstrike-2024-one-update-every-machine) | One update went to every machine at once | `serial` waves with `max_fail_percentage: 0` |
| [Atlassian, 2022](#atlassian-2022-right-script-wrong-ids-permanent-mode) | A delete script got the wrong IDs | Look up and `assert` every ID before a destructive API call |
| [Cloudflare, 2025](#cloudflare-2025-a-generated-file-doubled-in-size) | A generated config file doubled in size | `validate:` and size limits on generated files |
| [AWS us-east-1, 2025](#aws-us-east-1-2025-two-automation-runs-raced) | Two automation runs raced | One run at a time, and refuse stale plans |
| [Datadog, 2023](#datadog-2023-every-node-patched-in-the-same-hour) | Every node patched in the same hour | Patch through `serial` with a health check, not a timer |

## AWS S3, 2017: A Typo in an Established Playbook

On February 28, 2017, an Amazon S3 engineer debugging a slow billing system ran a command from an established playbook to take a small number of servers out of service. One input was entered incorrectly, and a much larger set was removed, including servers behind S3's index and placement subsystems in us-east-1. S3 in the region was unavailable from 9:37 AM until it finished recovering at 1:54 PM PST, and a large part of the internet that stored assets there broke with it.

AWS's fix was a guardrail, not a reprimand: the tool now removes capacity more slowly and refuses to take any subsystem below its minimum required capacity. Both translate directly to Ansible:

```yaml title="playbooks/remove_capacity.yml"
- name: Remove servers from the billing fleet
  hosts: "{{ target }}"
  serial: 2                    # slowly, two at a time
  any_errors_fatal: true       # any failure stops every host
  pre_tasks:
    - name: Refuse to shrink the fleet below its minimum
      ansible.builtin.assert:
        that:
          - ansible_play_hosts_all | length <= max_removals | int
          - (groups['billing'] | length) - (ansible_play_hosts_all | length) >= min_in_service | int
        fail_msg: >-
          Refusing to remove {{ ansible_play_hosts_all | length }} hosts.
          At most {{ max_removals }} may go, and {{ min_in_service }} must stay in service.
      run_once: true

  tasks:
    - name: Drain the host
      ansible.builtin.command: /usr/local/bin/fleet drain {{ inventory_hostname }}
      delegate_to: localhost
      changed_when: true
```

```bash
ansible-playbook playbooks/remove_capacity.yml -e target=billing_old -e max_removals=4 -e min_in_service=20
```

`ansible_play_hosts_all` is every host the play matched, so a mistyped `target` (say, `billing` instead of `billing_old`) fails the assertion before a single host is drained.

## GitLab.com, 2017: The Right Command on the Wrong Server

On January 31, 2017, a GitLab engineer fighting a replication problem ran a command to wipe a PostgreSQL data directory, on the primary, believing it was the secondary. The backups that should have saved the day weren't working: the backup job ran `pg_dump` 9.2 against PostgreSQL 9.6 and failed, and the emails reporting it were rejected because DMARC wasn't set up for the cron mail. GitLab.com was down for about 18 hours, and roughly six hours of data was lost, an estimated 5,000 projects, 5,000 comments, and 700 users.

Two of GitLab's follow-ups were shell prompts that make host and environment unmistakable, and automated testing of backup restores. In a playbook, the equivalent of "look at the prompt" is to ask the host what it is, instead of trusting the inventory group it sits in:

```yaml title="playbooks/rebuild_replica.yml"
- name: Rebuild a PostgreSQL replica
  hosts: db_replicas
  serial: 1
  become: true
  tasks:
    - name: Ask PostgreSQL whether this server is a replica
      ansible.builtin.command: psql -tAc "SELECT pg_is_in_recovery()"
      become_user: postgres
      register: in_recovery
      changed_when: false
      check_mode: false          # read-only, so it runs during --check too

    - name: Refuse to touch a primary
      ansible.builtin.assert:
        that: in_recovery.stdout == "t"
        fail_msg: "{{ inventory_hostname }} is a PRIMARY. Not wiping its data directory."

    - name: Remove the old data directory
      ansible.builtin.file:
        path: /var/lib/postgresql/16/main
        state: absent
```

Inventory is just a file someone edited. A failover last week could have made `db_replicas` wrong; `pg_is_in_recovery()` can't be. The other lesson costs nothing to adopt: a scheduled playbook that restores last night's backup into a scratch database and fails loudly when it can't. A backup you've never restored is a hope, not a backup.

## Knight Capital, 2012: Seven Servers Out of Eight

On August 1, 2012, Knight Capital deployed new trading code to the eight servers running its order router. According to the SEC's order, a technician didn't copy the new code to one of them, and no one noticed. Orders carrying a repurposed flag then woke up old, unused "Power Peg" code on that eighth server, which sent orders into the market without stopping. In about 45 minutes Knight obtained more than 4 million executions in 154 stocks; the SEC put the loss at over $460 million.

A manual, partial deploy is exactly what idempotent automation exists to prevent, but automation can leave a host behind too, if one host fails and the rest carry on. Make one failure stop everything, then prove every host matches before anything is switched on:

```yaml title="playbooks/deploy_router.yml"
- name: Deploy the order router
  hosts: trading
  any_errors_fatal: true       # a failure on one host stops the deploy everywhere
  tasks:
    - name: Unpack release {{ release }}
      ansible.builtin.unarchive:
        src: "files/router-{{ release }}.tar.gz"
        dest: /opt/router
        creates: "/opt/router/{{ release }}"

- name: Verify before enabling any new feature
  hosts: trading
  gather_facts: false
  tasks:
    - name: Read the release each host is actually running
      ansible.builtin.slurp:
        src: /opt/router/RELEASE
      register: running

    - name: Every host answered, and every host runs the same release
      ansible.builtin.assert:
        that:
          - ansible_play_hosts | length == ansible_play_hosts_all | length
          - >-
            ansible_play_hosts
            | map('extract', hostvars, ['running', 'content'])
            | map('b64decode') | map('trim') | unique | list == [release]
        fail_msg: "Hosts disagree on the running release. The feature flag stays off."
      run_once: true
```

The first assertion catches the host that didn't answer (unreachable hosts drop out of `ansible_play_hosts`); the second catches the host that answered with the wrong version. The non-Ansible lesson is just as cheap: never reuse an old flag for a new meaning.

## Facebook, 2021: The Audit Tool Had a Bug

On October 4, 2021, during routine maintenance, a command meant to assess the availability of global backbone capacity instead took down every connection in Facebook's backbone network. Facebook's systems were designed to audit commands like it, but a bug in the audit tool let it through. With the backbone gone, Facebook's DNS servers withdrew their BGP route advertisements, so Facebook, Instagram, and WhatsApp vanished from the internet for roughly six hours. Remote access went down with everything else, and engineers had to work inside data centers built to be hard to get into.

A guardrail you've never seen fire is a guardrail you don't know works. Test it the way you test code: with an input it must reject.

```bash title="ci/test_guards.sh"
#!/usr/bin/env bash
set -u
# The capacity guard must refuse to drain the whole fleet.
# If the playbook accepts target=all, the guard is broken: fail the pipeline.
if ansible-playbook -i inventories/production playbooks/remove_capacity.yml \
     -e target=all -e max_removals=4 -e min_in_service=20 --check; then
  echo "Guard did not fire for target=all" >&2
  exit 1
fi
echo "Guard refused target=all, as it should"
```

`assert` runs normally under `--check`, so the test touches nothing. The second lesson is about access: keep a way into your systems that doesn't depend on the thing you're changing, such as an out-of-band management network or a console that doesn't route through the backbone.

## CrowdStrike, 2024: One Update, Every Machine

On July 19, 2024 at 04:09 UTC, CrowdStrike released a content update for its Falcon sensor, Channel File 291, to every online Windows machine running it. A mismatch between the update's input fields and what the sensor expected caused an out-of-bounds memory read. The sensor runs in the kernel, so Windows crashed, and kept crashing on every reboot. The update was reverted at 05:27 UTC, but Microsoft estimated 8.5 million Windows devices were affected, disrupting airlines, hospitals, and banks worldwide. CrowdStrike's review committed to a staggered deployment strategy, starting with a canary.

Ansible's version of a canary is a `serial` list, and the part that matters is what stops it:

```yaml title="playbooks/agent_rollout.yml"
- name: Roll out the endpoint agent in waves
  hosts: endpoints
  serial: [1, "1%", "10%", "100%"]
  max_fail_percentage: 0       # one failed host stops the next wave
  become: true
  tasks:
    - name: Install agent {{ agent_version }}
      ansible.builtin.apt:
        name: "endpoint-agent={{ agent_version }}"
        state: present

    - name: Reboot and prove the host comes back with a working agent
      ansible.builtin.reboot:
        test_command: systemctl is-active endpoint-agent
```

Without `max_fail_percentage` (or `any_errors_fatal`), `serial` alone **doesn't** stop a bad rollout: failed hosts are dropped and the next wave starts anyway. The [serial batch planner](../advanced-execution/01-forks-serial-strategy-throttle.md#stopping-a-bad-rollout) shows exactly which failures stop which batch.

## Atlassian, 2022: Right Script, Wrong IDs, Permanent Mode

On April 5, 2022, Atlassian ran a script to delete data from a retired app. The team supplied it with the IDs of entire customer cloud sites instead of the app's IDs. The script didn't check what the IDs referred to, and it ran in its "permanently delete" mode instead of "mark for deletion." Between 07:38 and 08:01 UTC it deleted 883 sites belonging to 775 customers. Restoring them took up to 14 days for some customers, because the data had to be pulled piece by piece out of backups shared with other customers. Atlassian committed to soft deletes across its systems.

If a playbook calls a destructive API, look up every ID first and assert it's what you think it is:

```yaml title="playbooks/delete_app_data.yml"
- name: Look up every object before deleting anything
  ansible.builtin.uri:
    url: "https://api.example.com/v1/objects/{{ item }}"
    headers:
      Authorization: "Bearer {{ api_token }}"
  loop: "{{ ids_to_delete }}"
  register: lookups
  check_mode: false            # uri is skipped in --check unless told to run
  no_log: true

- name: Refuse unless every ID is an app, not a whole site
  ansible.builtin.assert:
    that: lookups.results | map(attribute='json.type') | unique | list == ['app']
    fail_msg: "Some IDs are not apps. Nothing was deleted."

- name: Mark the apps for deletion (recoverable for 30 days)
  ansible.builtin.uri:
    url: "https://api.example.com/v1/objects/{{ item }}"
    method: DELETE
    headers:
      Authorization: "Bearer {{ api_token }}"
    status_code: [200, 202, 204]
  loop: "{{ ids_to_delete }}"
  no_log: true
```

Make the recoverable path the default, and make the permanent one require an explicit `-e` flag that a pasted command won't carry by accident. More `uri` safety details are in [URI and API Automation](../modules/04-uri-and-api-automation.md#check-mode-and-destructive-calls).

## Cloudflare, 2025: A Generated File Doubled in Size

On November 18, 2025, a ClickHouse permissions change made the query that builds Cloudflare's Bot Management "feature file" return duplicate rows. The file doubled in size, past the limit of 200 features that Cloudflare's proxy preallocates memory for, and the proxy panicked. The file was regenerated every five minutes, and only some database nodes had the change, so the network flapped between working and failing before failing everywhere. Core traffic was largely flowing again by 14:30 UTC, and everything was back by 17:06. Cloudflare's first remediation: treat configuration files it generates with the same suspicion as user input.

Ansible renders configuration from data all day long. Check the data, then let the service check the file before it replaces the live one:

```yaml
- name: Refuse a feature list larger than the proxy can load
  ansible.builtin.assert:
    that: bot_features | length <= 200
    fail_msg: "{{ bot_features | length }} features; the proxy preallocates room for 200."

- name: Write the feature file only if the proxy accepts it
  ansible.builtin.template:
    src: features.json.j2
    dest: /etc/proxy/features.json
    validate: /usr/local/bin/proxy --check-features %s
  notify: Reload proxy
```

`validate:` runs against a temporary copy (`%s`) and leaves the live file untouched if the command fails. Pair it with `serial` on the reload, so a file that passes validation but still misbehaves reaches one batch, not the whole fleet. More on [templates and validation](../jinja2-and-templates/03-templates-for-config-generation.md#validate-before-it-goes-live).

## AWS us-east-1, 2025: Two Automation Runs Raced

DynamoDB's DNS records are maintained by automation: a DNS Planner produces plans, and independent DNS Enactors apply them through Route 53. On October 19–20, 2025, one Enactor was badly delayed while applying an older plan. Another Enactor applied a newer plan, then ran its cleanup, which deletes plans that are much older than the newest one. The delayed Enactor's old plan landed on the regional endpoint, overwriting the newer one, and the cleanup then deleted that old plan, leaving `dynamodb.us-east-1.amazonaws.com` with an empty DNS record. The inconsistent state also blocked later updates and needed manual repair. The event ran from 11:48 PM PDT on October 19 to 2:20 PM PDT on October 20 and spread into EC2 and load balancers. AWS disabled the automation worldwide until the race was fixed.

Two runs of the same automation acting on the same state is a race, even when each run is correct on its own. Make runs take turns, and make each run refuse to apply something older than what's live:

```bash
# cron or CI: one run at a time; the next one waits instead of racing
flock --exclusive --timeout 600 /var/lock/dns-sync.lock \
  ansible-playbook playbooks/dns_sync.yml
```

```yaml
- name: Read the generation that's live right now
  ansible.builtin.uri:
    url: "https://dns-api.internal/v1/zones/{{ zone }}"
  register: live
  check_mode: false

- name: Refuse to apply a plan older than the live one
  ansible.builtin.assert:
    that: plan.generation | int > live.json.generation | int
    fail_msg: "Plan {{ plan.generation }} is older than live {{ live.json.generation }}; another run got there first."
```

In AWX and Ansible Automation Platform, a job template runs one job at a time unless **Concurrent Jobs** is enabled. Leave it off for anything that writes shared state, and remember that job slicing runs its slices concurrently even when the box is unchecked.

## Datadog, 2023: Every Node Patched in the Same Hour

On March 8, 2023, Datadog's Ubuntu 22.04 nodes installed a systemd security update. Ubuntu's default unattended upgrades were still active on them, so every host upgraded in the same window, between 06:00 and 07:00 UTC. Installing the update restarted `systemd-networkd`, and since systemd v248, networkd deletes routing rules it doesn't manage when it starts, including the ones Cilium had installed for container networking. More than 60% of Datadog's instances dropped off the network across several regions and three cloud providers. Freshly booted nodes were fine, which is why nothing had caught it: the problem only appeared when networkd restarted on a node that was already running.

A security patch is a change like any other. Roll it out like one:

```yaml title="playbooks/patch_nodes.yml"
- name: Patch Kubernetes nodes a few at a time
  hosts: k8s_nodes
  serial: "10%"
  max_fail_percentage: 0
  become: true
  tasks:
    - name: Apply pending updates
      ansible.builtin.apt:
        upgrade: safe
        update_cache: true

    - name: The routing rules container networking needs must survive
      ansible.builtin.command: ip rule show
      register: rules
      changed_when: false
      failed_when: "'lookup local' not in rules.stdout"
```

Then stop the timer from doing it behind your back: set `APT::Periodic::Unattended-Upgrade "0";` on nodes that Ansible patches. The Kubernetes side of this incident, including the systemd-networkd settings that leave CNI routes alone, is in [Kubernetes Outages](../../kubernetes/case-studies/07-real-world-outages-and-lessons.md#datadog-2023-an-os-patch-deleted-the-cnis-routes).

## What the Nine Have in Common

| Failure mode | Incidents | The habit that contains it |
|---|---|---|
| Bad input | AWS S3, Atlassian, Cloudflare | Validate inputs and generated data with `assert` and `validate:` before acting |
| Wrong target | GitLab.com, Knight Capital | Ask the host what it is; verify every host after the change |
| Everything at once | CrowdStrike, Datadog | `serial` waves that stop on the first failure |
| Two runs racing | AWS us-east-1 | One run at a time; refuse plans older than what's live |
| Broken safety net | Facebook, GitLab.com | Test guards with inputs they must reject, and test restores |

Every guardrail here is under ten lines of YAML. The expensive part is remembering to add them before you need them, which is why they belong in roles and templates your team copies, not in a postmortem.

## Check Yourself

!!! quiz "A canary that doesn't stop"
    A play has `serial: [1, "10%", "100%"]` and nothing else about failures. The canary host fails its health check. What happens next?

    - [ ] The play stops: the canary failed
    - [x] The failed host is dropped and the `10%` batch starts anyway
    - [ ] Ansible retries the canary until it passes

    `serial` only sets batch sizes. A failed host is removed from the play and the next batch runs. Only a batch in which every host fails ends the play. Add `max_fail_percentage: 0` or `any_errors_fatal: true` to make the canary actually gate the rollout.

!!! quiz "Inventory said replica"
    A playbook targets `db_replicas` and wipes the data directory. Yesterday a failover promoted one of those replicas to primary, but the inventory wasn't updated. Which guard stops the wipe?

    - [ ] `hosts: db_replicas` already guarantees the host is a replica
    - [ ] `--check` before the real run
    - [x] Asking PostgreSQL with `pg_is_in_recovery()` and asserting the answer is `t`

    The inventory group is only as accurate as the last person who edited it. Live state on the host is the source of truth, so check it right before the destructive step.

!!! quiz "When validate runs"
    A `template` task has `validate: nginx -t -c %s`. The rendered file is invalid. What's on disk afterwards?

    - [x] The old file, unchanged: validation ran on a temporary copy and failed
    - [ ] The new file, followed by a failed task
    - [ ] Nothing: Ansible deletes the destination when validation fails

    `validate` checks the temporary file passed in as `%s`. Only if the command succeeds does Ansible move it into place, so a bad render never reaches the live path.

## Sources

- AWS: [Summary of the Amazon S3 Service Disruption](https://aws.amazon.com/message/41926/) (February 2017)
- GitLab: [Postmortem of database outage of January 31](https://about.gitlab.com/blog/2017/02/10/postmortem-of-database-outage-of-january-31/)
- SEC: [Order against Knight Capital Americas LLC](https://www.sec.gov/files/litigation/admin/2013/34-70694.pdf) (October 2013)
- Meta Engineering: [More details about the October 4 outage](https://engineering.fb.com/2021/10/05/networking-traffic/outage-details/)
- CrowdStrike: [Channel File 291 root cause analysis](https://www.crowdstrike.com/wp-content/uploads/2024/08/Channel-File-291-Incident-Root-Cause-Analysis-08.06.2024.pdf); Microsoft: [Helping our customers through the CrowdStrike outage](https://blogs.microsoft.com/blog/2024/07/20/helping-our-customers-through-the-crowdstrike-outage/)
- Atlassian: [Post-incident review on the April 2022 outage](https://www.atlassian.com/engineering/post-incident-review-april-2022-outage)
- Cloudflare: [Cloudflare outage on November 18, 2025](https://blog.cloudflare.com/18-november-2025-outage/)
- AWS: [Summary of the Amazon DynamoDB Service Disruption in us-east-1](https://aws.amazon.com/message/101925/) (October 2025)
- Datadog: [2023-03-08 incident: a deep dive into the platform-level impact](https://www.datadoghq.com/blog/engineering/2023-03-08-deep-dive-into-platform-level-impact/)

## Related

- [Forks, Serial, Strategy, and Throttle](../advanced-execution/01-forks-serial-strategy-throttle.md) — batch sizes and what stops a rollout
- [Check Mode and Diff Mode](../core-concepts/10-check-mode-and-diff-mode.md) — what a dry run can and can't tell you
- [Multi-Environment Inventory](02-multi-environment-inventory.md) — a preflight play that refuses production without confirmation
- [Kubernetes Outages: 11 Real Postmortems](../../kubernetes/case-studies/07-real-world-outages-and-lessons.md)

## Next

Continue to [Troubleshooting](../troubleshooting/index.md).
