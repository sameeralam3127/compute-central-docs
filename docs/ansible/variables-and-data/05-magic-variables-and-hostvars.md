---
title: "Ansible hostvars and Magic Variables Explained"
icon: lucide/sparkles
description: Ansible's automatically-provided magic variables — hostvars, groups, group_names, inventory_hostname, and ansible_play_hosts.
tags:
  - Ansible
  - Variables
---

# Magic Variables and Hostvars

## What You'll Learn

- The magic variables Ansible defines for every host, and what each one contains
- How one host's tasks read another host's facts and variables
- The trap where `hostvars` works in testing and fails in production

## Why This Exists

Ansible provides a handful of variables automatically, without you ever defining them — they're how one host's tasks can reference *another* host's facts or variables, which is essential for anything involving load balancers, clusters, or cross-host coordination.

## Mental Model

> Each task runs "as" one host and sees that host's variables directly. **Magic variables** are the window onto everything else: the inventory structure (`groups`), where the current host fits in it (`group_names`, `inventory_hostname`), and every other host's variables (`hostvars`).

## The Variables You'll Actually Use

| Variable | Contains | Example value |
|---|---|---|
| `inventory_hostname` | The current host's name as written in inventory | `web01` |
| `inventory_hostname_short` | Name up to the first dot | `web01` from `web01.prod.example.com` |
| `ansible_host` | The address Ansible connects to (if set) | `10.0.1.11` |
| `group_names` | Groups the **current host** belongs to (excluding `all`) | `['production', 'web']` |
| `groups` | **Every** group, mapped to its member hosts | `{'web': ['web01', 'web02'], 'db': ['db01']}` |
| `hostvars` | Every host's variables and facts, keyed by inventory name | `hostvars['db01']['ansible_facts']` |
| `ansible_play_hosts` | Hosts in the current play that haven't failed | `['web01', 'web02']` |
| `ansible_play_batch` | Hosts in the current `serial` batch | `['web01']` |
| `playbook_dir` / `role_path` | Directory of the playbook / current role | `/srv/ansible/playbooks` |

## Worked Example: A Web Tier That Finds Its Database

```ini title="inventory.ini"
[web]
web01
web02

[db]
db01
```

```yaml title="site.yml"
- name: Gather facts from the database tier first
  hosts: db
  gather_facts: true
  tasks: []

- name: Configure the web tier
  hosts: web
  become: true
  tasks:
    - name: Render app config with the primary database address
      ansible.builtin.template:
        src: app.env.j2
        dest: /etc/checkout/app.env
        mode: "0640"
```

```jinja title="templates/app.env.j2"
DATABASE_HOST={{ hostvars[groups['db'][0]]['ansible_facts']['default_ipv4']['address'] }}
DATABASE_PORT={{ hostvars[groups['db'][0]]['db_port'] | default(5432) }}
```

Read the expression from the inside out: `groups['db']` is the list of database hosts, `[0]` picks the first, and `hostvars[...]` opens that host's variables.

!!! warning "hostvars only contains facts that were gathered"
    `hostvars['db01']['ansible_facts']` is empty unless facts were gathered for `db01` **during this run** (or loaded from a [fact cache](../advanced-execution/02-fact-caching.md)). The first play above exists only to populate them. If you run with `--limit web`, `db01` is never contacted — keep a fact cache, or gather explicitly with `delegate_to` and `delegate_facts: true`:

    ```yaml
    - name: Gather database facts even when limited to web hosts
      ansible.builtin.setup:
      delegate_to: "{{ item }}"
      delegate_facts: true
      loop: "{{ groups['db'] }}"
      run_once: true
    ```

Inventory variables (from `group_vars`/`host_vars`) are always present in `hostvars`, even without contacting the host. Only **facts** need gathering.

## Building a Load Balancer Pool

```jinja title="templates/haproxy.cfg.j2"
backend web_pool
    balance roundrobin
{% for host in groups['web'] %}
    server {{ host }} {{ hostvars[host]['ansible_facts']['default_ipv4']['address'] }}:{{ hostvars[host]['http_port'] | default(80) }} check
{% endfor %}
```

Add a host to `[web]` in inventory, re-run, and it joins the pool.

## Branching on Group Membership

```yaml
- name: Install monitoring agent only on production hosts
  ansible.builtin.package:
    name: prometheus-node-exporter
    state: present
  when: "'production' in group_names"

- name: Run the schema migration from exactly one web host
  ansible.builtin.command: /opt/checkout/bin/migrate
  when: inventory_hostname == ansible_play_hosts | first
```

`run_once: true` is the more common way to say "exactly one host" (see [Delegation and Become](../playbook-engineering/04-delegation-and-become.md#run_once-exactly-once)). The explicit `when:` form shown here still works under `serial`, where `run_once` runs once **per batch**.

## Inspecting Them

```bash
ansible web01 -m ansible.builtin.debug -a "var=group_names"
ansible web01 -m ansible.builtin.debug -a "var=groups"
ansible-inventory --host db01          # the inventory-side variables hostvars will hold
```

## Common Mistakes

- Trying to reference another host's facts without `hostvars`, and getting an "undefined variable" error — a task only has direct access to the current host's own variables by default.
- Confusing `groups` (all groups, everywhere) with `group_names` (only the current host's groups).
- Relying on another host's facts under `--limit`, when that host was never contacted and its facts were never gathered.
- Using `groups['db'][0]` as "the primary" when inventory order isn't guaranteed to reflect which node is actually primary — use an explicit variable such as `db_role: primary`.
- Using `ansible_play_hosts` inside a `serial` rollout when you meant the current batch, `ansible_play_batch`.

## Interview Questions

- How would a web server task read a fact from a database host in the same inventory?
- What's the difference between `groups` and `group_names`?
- A playbook works when run against the whole inventory but fails with `--limit web`. What's the likely cause?
- What does `delegate_facts: true` change?

## Next

Continue to [set_fact and combine](06-set-fact-and-combine.md).
