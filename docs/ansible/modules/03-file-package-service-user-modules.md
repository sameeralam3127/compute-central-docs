---
title: "Ansible File, Package, Service, and User Modules"
icon: lucide/boxes
description: The core file, package, service, and user management modules — package, file, stat, lineinfile, blockinfile, user, group, authorized_key, cron, mount.
tags:
  - Ansible
  - Modules
---

# File, Package, Service, and User Modules

## What You'll Learn

- The modules behind most day-to-day configuration management, grouped by job
- Which parameters matter, and how each module decides whether it `changed`
- When to choose a distro-specific module over the cross-platform one
- Which of these live in `ansible.builtin` and which need a collection

## Why This Exists

These modules cover the large majority of what a typical configuration-management playbook does day to day — this page is the category reference, one level below [Command vs. Shell](01-command-vs-shell-vs-raw-vs-script.md) and [Module Decision Trees](02-module-decision-trees.md).

!!! note "Collections matter here"
    Most modules below ship with `ansible-core` as `ansible.builtin.*`. A few commonly used ones live in collections: `authorized_key`, `mount`, and `sysctl` are in **`ansible.posix`**; `ufw` is in **`community.general`**. Install them with `ansible-galaxy collection install ansible.posix community.general` and pin them in `requirements.yml`.

## Packages

### `ansible.builtin.package` — cross-distro

```yaml
- name: Install common tools on any distribution
  ansible.builtin.package:
    name:
      - curl
      - jq
      - git
    state: present
```

It delegates to the host's package manager. Package **names** still differ between distributions (`apache2` vs. `httpd`), so pair it with facts or per-OS variables.

### `ansible.builtin.apt` / `ansible.builtin.dnf` — distro-specific

```yaml
- name: Install nginx on Debian/Ubuntu, refreshing the cache at most hourly
  ansible.builtin.apt:
    name: nginx
    state: present
    update_cache: true
    cache_valid_time: 3600
  when: ansible_facts['os_family'] == 'Debian'

- name: Apply security updates on RHEL-family hosts
  ansible.builtin.dnf:
    name: "*"
    state: latest
    security: true
  when: ansible_facts['os_family'] == 'RedHat'
```

Reach for the specific module when you need its extra parameters: `cache_valid_time`, `deb` files, `default_release`, or `security`-only updates.

| `state` | Meaning |
|---|---|
| `present` | Install if missing; never upgrade. Idempotent and predictable. |
| `latest` | Upgrade on every run if a newer version exists — changes over time, so avoid for pinned fleets. |
| `absent` | Remove. |

Pin exact versions for anything you deploy: `name: nginx=1.26.*` (apt) or `name: nginx-1.26.2` (dnf).

## Services

```yaml
- name: Ensure nginx is running and starts on boot
  ansible.builtin.service:
    name: nginx
    state: started
    enabled: true
```

`ansible.builtin.systemd_service` adds systemd-only features:

```yaml
- name: Install a custom unit file
  ansible.builtin.template:
    src: checkout.service.j2
    dest: /etc/systemd/system/checkout.service
    mode: "0644"
  notify: Restart checkout

- name: Reload systemd and start the service
  ansible.builtin.systemd_service:
    name: checkout
    state: started
    enabled: true
    daemon_reload: true
```

`started`/`stopped` are idempotent. `restarted`/`reloaded` **always** report `changed` — put them in [handlers](../core-concepts/08-handlers.md), not in the main task list.

## Files and Directories

### `file` — state of a path

```yaml
- name: Create the application directory tree
  ansible.builtin.file:
    path: "/opt/checkout/{{ item }}"
    state: directory
    owner: checkout
    group: checkout
    mode: "0750"
  loop: [releases, shared, shared/logs]

- name: Point "current" at the new release
  ansible.builtin.file:
    src: "/opt/checkout/releases/{{ app_release }}"
    dest: /opt/checkout/current
    state: link

- name: Remove an old config file
  ansible.builtin.file:
    path: /etc/nginx/conf.d/default.conf
    state: absent
```

### `copy` and `template` — file content

```yaml
- name: Ship a static CA bundle
  ansible.builtin.copy:
    src: files/internal-ca.pem
    dest: /usr/local/share/ca-certificates/internal-ca.crt
    mode: "0644"
    backup: true

- name: Render nginx config, refusing to deploy an invalid one
  ansible.builtin.template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
    validate: nginx -t -c %s
  notify: Reload nginx
```

Both compare checksums, so an identical file reports `ok`. See [Templates for Config Generation](../jinja2-and-templates/03-templates-for-config-generation.md).

### `stat` — read-only inspection

```yaml
- name: Check whether the app was already initialized
  ansible.builtin.stat:
    path: /opt/checkout/shared/.initialized
  register: init_marker

- name: Initialize the app once
  ansible.builtin.command: /opt/checkout/bin/init
  when: not init_marker.stat.exists
```

`stat` never changes anything, which is why it's almost always paired with `register` and `when`.

### Downloads and archives

```yaml
- name: Download a release tarball, verified by checksum
  ansible.builtin.get_url:
    url: "https://releases.example.com/checkout-{{ app_release }}.tar.gz"
    dest: "/tmp/checkout-{{ app_release }}.tar.gz"
    checksum: "sha256:{{ app_release_sha256 }}"

- name: Unpack it into a versioned release directory
  ansible.builtin.unarchive:
    src: "/tmp/checkout-{{ app_release }}.tar.gz"
    dest: "/opt/checkout/releases/{{ app_release }}"
    remote_src: true
    creates: "/opt/checkout/releases/{{ app_release }}/bin/checkout"
```

`creates:` is what makes `unarchive` idempotent.

### Source control

```yaml
- name: Check out a pinned tag
  ansible.builtin.git:
    repo: https://github.com/example/ops-scripts.git
    dest: /opt/ops-scripts
    version: v3.2.0
```

## Partial File Edits

| Module | Edits | Best for |
|---|---|---|
| `lineinfile` | One line, matched by regex | A single setting in a file you don't own |
| `blockinfile` | A marked multi-line block | A few lines you own inside a file you don't |
| `replace` | Every regex match in the file | Bulk substitutions |
| `template` | The whole file | Any file you fully own — usually the right answer |

```yaml
- name: Disable SSH password authentication
  ansible.builtin.lineinfile:
    path: /etc/ssh/sshd_config
    regexp: '^#?PasswordAuthentication'
    line: PasswordAuthentication no
    validate: sshd -t -f %s
  notify: Reload sshd

- name: Add internal hosts entries
  ansible.builtin.blockinfile:
    path: /etc/hosts
    marker: "# {mark} ANSIBLE MANAGED: internal services"
    block: |
      10.0.2.10 registry.internal
      10.0.2.11 vault.internal
```

Without `regexp`, `lineinfile` appends a new line whenever the exact `line` is missing — a common way to end up with duplicate, conflicting settings. See [Module Decision Trees](02-module-decision-trees.md) for when `template` is the better choice.

## Users and Access

```yaml
- name: Create the application group
  ansible.builtin.group:
    name: checkout
    system: true

- name: Create the application service account
  ansible.builtin.user:
    name: checkout
    group: checkout
    system: true
    shell: /usr/sbin/nologin
    home: /opt/checkout
    create_home: false

- name: Authorize an engineer's SSH key
  ansible.posix.authorized_key:
    user: alice
    key: "{{ lookup('ansible.builtin.file', 'files/keys/alice.pub') }}"
    state: present
```

`user` with `state: absent` and `remove: true` also deletes the home directory. A full team-access design is in [Case Study: User and SSH Access](../case-studies/04-user-and-ssh-access.md); key-based authentication itself ties to [SSH and Connectivity](../getting-started/05-ssh-and-connectivity.md).

## Scheduling

```yaml
- name: Nightly log cleanup at 02:30
  ansible.builtin.cron:
    name: checkout log cleanup          # the unique ID Ansible uses to find this entry
    user: checkout
    minute: "30"
    hour: "2"
    job: "find /opt/checkout/shared/logs -name '*.log' -mtime +14 -delete"
```

The `name` is what makes `cron` idempotent — change it and you get a second, duplicate job.

## Mounts and Kernel Settings

```yaml
- name: Mount the data volume and persist it in /etc/fstab
  ansible.posix.mount:
    path: /data
    src: UUID=3f0c1b7e-2a9d-4c55-9a51-6f3e2d1c9b10
    fstype: xfs
    opts: defaults,noatime
    state: mounted

- name: Raise the listen backlog
  ansible.posix.sysctl:
    name: net.core.somaxconn
    value: "4096"
    state: present
    reload: true
```

`mount` states: `mounted` (mount now + fstab), `present` (fstab only), `unmounted` (unmount, keep fstab), `absent` (unmount + remove from fstab).

## Check Mode Support at a Glance

All modules on this page support `--check`. The catch is chained tasks: in check mode, `get_url` doesn't actually download, so a following `unarchive` with `remote_src: true` fails on a missing file. Guard such steps with `when: not ansible_check_mode`, as covered in [Check Mode and Diff Mode](../core-concepts/10-check-mode-and-diff-mode.md).

## Common Mistakes

- Using `state: latest` everywhere, so every run can upgrade packages nobody intended to upgrade.
- Putting `state: restarted` in a regular task, restarting the service on every run.
- Using `lineinfile` without `regexp`, appending duplicate settings instead of replacing the existing line.
- Editing `sshd_config` or `sudoers` without `validate:`, and locking yourself out with one typo.
- Calling `authorized_key` or `mount` by short name without installing `ansible.posix`, then getting "couldn't resolve module/action."
- Renaming a `cron` job's `name`, which creates a second entry instead of updating the first.

## Interview Questions

- When would you choose `apt`/`dnf` directly instead of the cross-distro `package` module?
- What's the difference between `lineinfile` and `blockinfile`, and when is `template` better than both?
- Why is `stat` commonly paired with `register` and `when` instead of used alone?
- How does `unarchive` stay idempotent, and what breaks about a download-then-unpack sequence in check mode?
- Why does `service: state=restarted` belong in a handler?

## Next

Continue to [URI and API Automation](04-uri-and-api-automation.md).
