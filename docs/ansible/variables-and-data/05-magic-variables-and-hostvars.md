---
title: "Ansible hostvars and Magic Variables: Full Reference"
icon: lucide/sparkles
description: "What hostvars is in Ansible, how one host reads another host's facts, and a reference of every magic variable, from group_names to ansible_play_batch."
tags:
  - Ansible
  - Variables
---

# Ansible hostvars and Magic Variables

`hostvars` is a dictionary Ansible builds for you that holds the variables of every host in the inventory, keyed by inventory hostname: a task running on `web01` reads `db01`'s port with `hostvars['db01']['db_port']`. It's one of Ansible's **magic variables**, which Ansible sets from its own internal state; you can't set them yourself, because Ansible always overrides them.

## What You'll Learn

- What `hostvars` contains, and how one host's tasks read another host's facts and variables
- The trap where `hostvars` works in testing and fails in production
- How to print every variable a host has
- A reference of the magic variables, grouped by what they tell you

## Why This Exists

Ansible provides a handful of variables automatically, without you ever defining them. They're how one host's tasks can reference *another* host's facts or variables, which is essential for anything involving load balancers, clusters, or cross-host coordination.

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

The [full reference](#magic-variables-reference) further down lists every magic variable.

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

## What the Variables Look Like at Run Time

This play runs against the inventory above, with `db_port=5433` set on `db01` and the `web` group inside a `production` group. The second play uses `serial: 1`, so it processes one web host at a time:

```yaml
- name: Gather facts from the database tier first
  hosts: db
  gather_facts: true
  tasks: []

- name: Configure the web tier
  hosts: web
  gather_facts: false
  serial: 1
  tasks:
    - name: Show what web1 can see
      ansible.builtin.debug:
        msg:
          group_names: "{{ group_names }}"
          ansible_play_hosts: "{{ ansible_play_hosts }}"
          ansible_play_batch: "{{ ansible_play_batch }}"
          db_port: "{{ hostvars['db01']['db_port'] }}"
          db_facts_gathered: "{{ hostvars['db01']['ansible_facts'] | length > 0 }}"
          ansible_run_tags: "{{ ansible_run_tags }}"
          ansible_limit: "{{ ansible_limit | default('not set') }}"
      when: inventory_hostname == 'web1'
```

Output from ansible-core 2.22:

```text
ok: [web1] => {
    "msg": {
        "ansible_limit": "not set",
        "ansible_play_batch": [
            "web1"
        ],
        "ansible_play_hosts": [
            "web1",
            "web2"
        ],
        "ansible_run_tags": [
            "all"
        ],
        "db_facts_gathered": true,
        "db_port": 5433,
        "group_names": [
            "production",
            "web"
        ]
    }
}
```

- `group_names` includes `production`, the parent group, and never `all`.
- Under `serial: 1`, `ansible_play_batch` holds only the current host, while `ansible_play_hosts` holds the whole play.
- `ansible_run_tags` is `["all"]` when you don't pass `--tags`, and `ansible_limit` is undefined when you don't pass `--limit`, so give it a `default()`.

Run the same playbook with `--limit web` and two values change: `ansible_limit` becomes `"web"`, and `db_facts_gathered` becomes `false`, because the database play never ran. `db_port` is still `5433`: it comes from inventory, not from contacting the host.

## Print All Variables for a Host

To see everything one host has, including the magic variables Ansible adds:

```bash
ansible db01 -m ansible.builtin.debug -a 'var=hostvars[inventory_hostname]'
```

That prints a long dictionary. The key names alone are often enough:

```bash
ansible db01 -m ansible.builtin.debug -a 'msg={{ hostvars[inventory_hostname].keys() | list | sort }}'
```

```text
db01 | SUCCESS => {
    "msg": [
        "ansible_check_mode",
        "ansible_config_file",
        "ansible_connection",
        "ansible_diff_mode",
        "ansible_facts",
        "ansible_forks",
        "ansible_inventory_sources",
        "ansible_playbook_python",
        "ansible_python_interpreter",
        "ansible_verbosity",
        "ansible_version",
        "db_port",
        "group_names",
        "groups",
        "inventory_dir",
        "inventory_file",
        "inventory_hostname",
        "inventory_hostname_short",
        "playbook_dir"
    ]
}
```

`ansible_facts` is empty here because an ad hoc `debug` doesn't gather facts. To see only what inventory defines for a host, without anything Ansible adds:

```bash
ansible-inventory --host db01
```

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

## Magic Variables Reference

The magic variables in ansible-core, grouped by what they tell you. Definitions follow the official [special variables reference](https://docs.ansible.com/ansible/latest/reference_appendices/special_variables.html).

### Hosts and inventory

| Variable | Contains |
|---|---|
| `inventory_hostname` | The current host's inventory name. Not affected by delegation |
| `inventory_hostname_short` | `inventory_hostname` up to the first dot |
| `group_names` | Groups the current host belongs to |
| `groups` | Every inventory group, mapped to its list of hosts |
| `hostvars` | Every inventory host, mapped to its variables |
| `inventory_dir` | Directory of the inventory source where the current host was first defined |
| `inventory_file` | File name of that inventory source |
| `ansible_inventory_sources` | All sources used as inventory |

### The play and the run

| Variable | Contains |
|---|---|
| `ansible_play_hosts` | Hosts in the current play run, not limited by `serial`; failed and unreachable hosts are excluded |
| `ansible_play_batch` | Active hosts in the current `serial` batch |
| `ansible_play_hosts_all` | Every host the play targeted |
| `ansible_play_name` | The play's `name:`, not the playbook file name |
| `play_hosts` | **Deprecated**: the same as `ansible_play_batch`. ansible-core 2.22 warns that it will be removed in 2.23 |
| `playbook_dir` | Directory of the playbook being run; inside an `import_playbook`, the imported file's directory |
| `ansible_check_mode` | `true` when running with `--check` ([Check Mode](../core-concepts/10-check-mode-and-diff-mode.md)) |
| `ansible_diff_mode` | `true` when running with `--diff` |
| `ansible_forks` | The maximum number of forks for this run |
| `ansible_verbosity` | The current verbosity level |
| `ansible_version` | Ansible's version, with keys `full`, `major`, `minor`, `revision`, and `string` |
| `ansible_config_file` | Full path of the `ansible.cfg` in use |
| `ansible_playbook_python` | The Python interpreter Ansible runs with on the control node |
| `ansible_search_path` | Where relative paths for action plugins and lookups are searched, such as `template: src=` |

### What you selected on the command line

| Variable | Contains |
|---|---|
| `ansible_limit` | The `--limit` value. Undefined when you don't pass `--limit` |
| `ansible_run_tags` | The `--tags` values; `["all"]` when you don't pass `--tags` |
| `ansible_skip_tags` | The `--skip-tags` values |

### Roles and collections

| Variable | Contains |
|---|---|
| `role_name` | Name of the role currently running |
| `role_path` | Directory of the role currently running |
| `ansible_role_name` | Fully qualified role name, such as `namespace.collection.role_name` |
| `ansible_collection_name` | Collection that the running task belongs to, as `namespace.collection` |
| `ansible_play_role_names` | Roles imported into the current play, excluding dependencies |
| `ansible_role_names` | Roles in the current play, including those pulled in as dependencies |
| `ansible_dependent_role_names` | Roles imported only as dependencies of other roles |
| `ansible_parent_role_names` / `ansible_parent_role_paths` | For a role run through `include_role` or `import_role`, its parent roles, most recent first |
| `role_names` | **Deprecated**: the same as `ansible_play_role_names` |

### Loops

| Variable | Contains |
|---|---|
| `ansible_loop` | Extended loop information (index, first, last, and more) when `loop_control.extended` is on |
| `ansible_loop_var` | The name set with `loop_control.loop_var` |
| `ansible_index_var` | The name set with `loop_control.index_var` |

### Related special variables

These aren't magic variables, but the same reference covers them and you'll see them in `hostvars`:

| Variable | Contains |
|---|---|
| `omit` | Leaves an option out entirely when used as its value, usually through the `default(omit)` filter |
| `ansible_facts` / `ansible_local` | Facts gathered or cached for the host; `ansible_local` holds [custom facts](03-facts.md) |
| `ansible_host`, `ansible_user`, `ansible_connection`, `ansible_become_user`, `ansible_python_interpreter` | How Ansible connects to the host; set them in inventory |

## Common Mistakes

- Trying to reference another host's facts without `hostvars`, and getting an "undefined variable" error — a task only has direct access to the current host's own variables by default.
- Confusing `groups` (all groups, everywhere) with `group_names` (only the current host's groups).
- Relying on another host's facts under `--limit`, when that host was never contacted and its facts were never gathered.
- Using `groups['db'][0]` as "the primary" when inventory order isn't guaranteed to reflect which node is actually primary — use an explicit variable such as `db_role: primary`.
- Using `ansible_play_hosts` inside a `serial` rollout when you meant the current batch, `ansible_play_batch`.
- Still using `play_hosts`. It's deprecated, ansible-core 2.22 warns on every use, and it's due to be removed in 2.23. Use `ansible_play_batch`.
- Reading `ansible_limit` without a `default()`. It's undefined unless the run used `--limit`.

## Check Yourself

!!! quiz "Works everywhere except with --limit"
    A web template reads `hostvars['db01']['ansible_facts']['default_ipv4']['address']`. It works on full runs, but `ansible-playbook site.yml --limit web` fails. Why?

    - [ ] `--limit` hides `hostvars` from web hosts
    - [x] `db01` was never contacted, so its facts were never gathered; its inventory variables are still there
    - [ ] `hostvars` only works inside roles

    Facts exist only for hosts Ansible gathered from in this run, or that a fact cache remembers. Gather with `delegate_facts: true`, or keep a fact cache.

!!! quiz "One batch at a time"
    A play over `web01` and `web02` uses `serial: 1`. While `web01` runs, what's in `ansible_play_batch` and `ansible_play_hosts`?

    - [ ] Both hold `['web01', 'web02']`
    - [x] `ansible_play_batch` is `['web01']`; `ansible_play_hosts` is `['web01', 'web02']`
    - [ ] Both hold `['web01']`

    `ansible_play_batch` follows `serial`. `ansible_play_hosts` covers the whole play, minus failed hosts.

## Interview Questions

- How would a web server task read a fact from a database host in the same inventory?
- What's the difference between `groups` and `group_names`?
- A playbook works when run against the whole inventory but fails with `--limit web`. What's the likely cause?
- What does `delegate_facts: true` change?

## Next

Continue to [set_fact and combine](06-set-fact-and-combine.md).
