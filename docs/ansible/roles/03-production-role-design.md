---
title: "Production-Ready Ansible Role Design"
icon: lucide/factory
description: Designing Ansible roles for production — single responsibility, testing with Molecule, and versioning roles that other teams depend on.
tags:
  - Ansible
  - Roles
  - Production
---

# Production Role Design

## What You'll Learn

- How to scope a role so it stays reusable instead of becoming a monolith
- The idempotency, check-mode, and platform-support bar a shared role should meet
- How to audit third-party roles before giving them root
- How to version, release, and pin roles that other teams depend on

## Why This Exists

A role that works once, on one project, is different from a role other teams can depend on for years — this page is about the latter.

## Mental Model

> A production role is a **product with users**. It has a clear scope, a documented interface, automated tests, a changelog, and version numbers that mean something. Every decision is judged by one question: can someone consume this safely without reading its internals?

## 1. Single Responsibility

```text
Monolith (hard to reuse)          Composed (easy to reuse)
------------------------          ------------------------
roles/webserver/                  roles/nginx/          # the web server only
  installs nginx                  roles/certbot/        # TLS certificates only
  configures TLS certs            roles/node_exporter/  # monitoring agent only
  installs node_exporter          roles/app_checkout/   # the application only
  deploys the app
  creates the database
```

```yaml title="playbooks/web.yml"
- hosts: web
  become: true
  roles:
    - nginx
    - certbot
    - node_exporter
    - app_checkout
```

A useful test: if you can't describe the role in one sentence without "and," split it.

Keep `meta/main.yml` dependencies to a minimum. A dependency runs implicitly and surprises consumers; composing roles in the playbook is explicit.

## 2. The Quality Bar

| Property | How to prove it |
|---|---|
| **Idempotent** — a second run reports zero changes | Molecule's `idempotence` stage |
| **Check-mode safe** — `--check` doesn't fail or lie | Run converge with `--check` in CI; guard dependent steps with `when: not ansible_check_mode` |
| **Validated inputs** | `meta/argument_specs.yml`, see [Role Variables and Interfaces](02-role-variables-and-interfaces.md) |
| **Declared platforms** | `galaxy_info.platforms` in `meta/main.yml`, and a test per platform |
| **Lint clean** | `ansible-lint` with the `production` profile |
| **Handlers for restarts** | No `state: restarted` in `tasks/` |
| **FQCNs everywhere** | `ansible.builtin.template`, not `template` |

Structure per-OS differences explicitly instead of scattering `when:` everywhere:

```yaml title="roles/nginx/tasks/main.yml"
- name: Load OS-specific variables
  ansible.builtin.include_vars: "{{ lookup('ansible.builtin.first_found', params) }}"
  vars:
    params:
      files:
        - "{{ ansible_facts['distribution'] }}-{{ ansible_facts['distribution_major_version'] }}.yml"
        - "{{ ansible_facts['os_family'] }}.yml"
      paths: ["{{ role_path }}/vars"]

- name: Install nginx
  ansible.builtin.package:
    name: "{{ __nginx_packages }}"
    state: present
```

```yaml title="roles/nginx/vars/Debian.yml"
__nginx_packages: [nginx]
__nginx_service: nginx
```

## 3. Testing in Isolation

Test roles before any playbook uses them:

```bash
cd roles/nginx
molecule test
```

That single command creates containers for each platform, applies the role, applies it again to catch non-idempotent tasks, runs `verify.yml` assertions, and destroys everything. The full setup is in [Molecule Testing](../production-engineering/07-molecule-testing.md).

## 4. Auditing Third-Party Roles

A role from Galaxy runs with whatever privileges your play grants — usually `become: true`, meaning root on every host. Before adopting one:

- [ ] **Read `tasks/`, `handlers/`, and `templates/` in full.** Look for `shell`/`command` that downloads and executes (`curl ... | bash`), disables security controls, or opens firewall ports.
- [ ] **Check `meta/main.yml` dependencies** — you're adopting those too.
- [ ] **Check maintenance** — recent commits, open issues, supported platforms matching yours.
- [ ] **Check the license.**
- [ ] **Pin an exact version or commit**, never a moving branch.
- [ ] **Run it through Molecule** against your own platforms before production.

For critical roles, fork into your organization's Git server or private Automation Hub and consume the fork, so an upstream change can't reach production without review. Wider controls are in [Security](../production-engineering/04-security.md).

## 5. Versioning and Releasing

Use semantic versioning, from the consumer's point of view:

| Change | Version bump |
|---|---|
| Rename or remove a variable; change a default in a way that changes behavior | **Major** (2.0.0) |
| New optional variable, new supported platform | **Minor** (1.4.0) |
| Bug fix with no interface change | **Patch** (1.3.2) |

Release by tagging the role's repository (or the collection that contains it), with a `CHANGELOG.md` entry that says what consumers need to do.

Consumers pin in `requirements.yml`:

```yaml title="requirements.yml"
roles:
  - name: acme.nginx
    src: git+https://git.example.com/platform/ansible-role-nginx.git
    version: v2.3.1

  - name: geerlingguy.docker
    version: "7.4.1"

collections:
  - name: acme.platform          # roles packaged inside a collection
    version: ">=3.1.0,<4.0.0"
```

```bash
ansible-galaxy install -r requirements.yml -p roles/
ansible-galaxy collection install -r requirements.yml
```

New shared roles are usually better distributed **inside a collection**, where they're versioned alongside related modules and plugins — see [Collections](../collections/index.md).

## 6. Deprecating Safely

When you must change the interface, keep the old variable working for a release and warn:

```yaml title="roles/nginx/tasks/main.yml"
- name: Warn about the renamed variable
  ansible.builtin.debug:
    msg: "DEPRECATED: nginx_port was renamed to nginx_http_port and will be removed in 3.0.0"
  when: nginx_port is defined

- name: Support the old name for one major version
  ansible.builtin.set_fact:
    nginx_http_port: "{{ nginx_port }}"
  when: nginx_port is defined
```

## Common Mistakes

- Running an unaudited third-party role with `become: true` in production without reading what it actually does.
- No version pinning on role dependencies, so a role update silently breaks every consumer at once.
- Growing one role to install everything a server needs, so nobody can reuse part of it.
- Hiding cross-role ordering in `meta/main.yml` dependencies instead of the playbook.
- Releasing a renamed variable as a patch version.
- Testing a role only through the one playbook that uses it, so its defaults are never exercised on their own.

## Interview Questions

- What would you check before running a third-party Galaxy role with elevated privileges in production?
- How do you test a role in isolation before it's consumed by a real playbook?
- A role owner wants to rename a widely used variable. How should they release that change?
- When should shared roles live in a collection rather than their own repositories?

## Next

Continue to [Collections](../collections/index.md).
