---
title: "Ansible Role Variables and Defaults Design"
icon: lucide/plug-zap
description: Designing a role's public interface through defaults, and documenting what a role expects versus what it provides.
tags:
  - Ansible
  - Roles
---

# Role Variables and Interfaces

## What You'll Learn

- How to design `defaults/main.yml` as a role's public, documented interface
- How to validate inputs automatically with `meta/argument_specs.yml`
- Why role variables need a prefix, and how collisions actually happen
- How to pass variables into a role, and how scope differs between `roles:`, `import_role`, and `include_role`

## Why This Exists

A well-designed role has a clear "contract" — what a consumer must set, what's optional with sensible defaults, and what's genuinely internal — the same discipline as designing a function signature, applied to `defaults/main.yml`.

## Mental Model

> Treat a role like a function. **`defaults/main.yml`** is the parameter list with default values. **`meta/argument_specs.yml`** is the type signature and validation. **`vars/main.yml`** holds private constants. **The README** is the docstring. If a consumer has to read `tasks/main.yml` to use the role, the interface is missing.

```text
roles/nginx/
├── README.md                  # documented interface
├── defaults/main.yml          # public inputs, all prefixed nginx_
├── vars/main.yml              # internal constants
├── meta/
│   ├── main.yml               # dependencies, platforms
│   └── argument_specs.yml     # input validation
└── tasks/main.yml
```

## Designing defaults/main.yml

```yaml title="roles/nginx/defaults/main.yml"
---
# Port nginx listens on for HTTP. Set to 0 to disable the HTTP listener.
nginx_http_port: 80

# Enable TLS. When true, nginx_tls_certificate and nginx_tls_key are required.
nginx_tls_enabled: false
nginx_tls_certificate: ""
nginx_tls_key: ""

# Worker processes. "auto" uses one per CPU core.
nginx_worker_processes: auto

# Virtual hosts to create. Each item: {name, server_names, upstream}.
nginx_vhosts: []

# Remove the distribution's default site.
nginx_remove_default_site: true
```

Rules that keep this file useful:

- **Every** variable the role reads from outside has a default here, even if it's empty.
- A comment on each explains purpose and valid values.
- Values are safe for a first run in a lab, not tuned for one team's production.

## Validating Inputs: meta/argument_specs.yml

Since `ansible-core` 2.11, a role can declare its inputs. Ansible validates them automatically before any of the role's tasks run:

```yaml title="roles/nginx/meta/argument_specs.yml"
---
argument_specs:
  main:
    short_description: Install and configure nginx
    options:
      nginx_http_port:
        type: int
        default: 80
        description: HTTP listen port; 0 disables the HTTP listener.
      nginx_tls_enabled:
        type: bool
        default: false
      nginx_tls_certificate:
        type: str
        description: Path to the certificate on the managed node.
      nginx_tls_key:
        type: str
        no_log: true
      nginx_worker_processes:
        type: raw
        default: auto
      nginx_vhosts:
        type: list
        elements: dict
        default: []
        options:
          name:
            type: str
            required: true
          server_names:
            type: list
            elements: str
            required: true
          upstream:
            type: str
            required: true
```

Pass a string where a list is expected, and the play fails immediately with a message naming the parameter. `ansible-doc` can't read role specs directly, but `ansible-navigator doc` and collection documentation tooling can, so this also becomes your generated reference.

Cross-field rules (such as "TLS enabled requires a certificate") still need an assertion:

```yaml title="roles/nginx/tasks/main.yml"
- name: Validate TLS settings
  ansible.builtin.assert:
    that:
      - nginx_tls_certificate | length > 0
      - nginx_tls_key | length > 0
    fail_msg: "nginx_tls_enabled is true, so nginx_tls_certificate and nginx_tls_key must be set"
    quiet: true
  when: nginx_tls_enabled
```

## Why the Prefix Matters

Most variables share one namespace per host. Two roles in the same play that both read `port` will read the **same** value:

```yaml
roles:
  - role: app          # reads `port`, defaults to 8080
  - role: metrics      # also reads `port`, defaults to 9100
```

If inventory sets `port: 8080` for the app, the metrics role silently listens on 8080 too. Prefix every variable with the role name — `app_port`, `metrics_port` — and the collision can't happen. `ansible-lint`'s `var-naming` rule enforces this.

Internal helper variables deserve a prefix as well, often with a double underscore to signal "private": `__nginx_package_name`.

## Passing Variables Into a Role

```yaml
# 1. From inventory — the usual way for environment-specific values
#    group_vars/production.yml:  nginx_worker_processes: 8

# 2. At the point of use, as role parameters
- hosts: web
  roles:
    - role: nginx
      vars:
        nginx_tls_enabled: true
        nginx_tls_certificate: /etc/ssl/shop.pem
        nginx_tls_key: /etc/ssl/private/shop.key

# 3. Dynamically
- hosts: web
  tasks:
    - name: Configure nginx for the admin site
      ansible.builtin.include_role:
        name: nginx
      vars:
        nginx_http_port: 8081
```

Role parameters and `include_role` `vars:` sit high in [Variable Precedence](../variables-and-data/02-variable-precedence.md) — above inventory — so they're the right way to give the **same role different inputs in one play**.

### Using a role twice

```yaml
- hosts: web
  roles:
    - role: nginx_vhost
      vars: { nginx_vhost_name: shop,  nginx_vhost_port: 8080 }
    - role: nginx_vhost
      vars: { nginx_vhost_name: admin, nginx_vhost_port: 8081 }
```

Ansible runs a role only once per play if its parameters are identical. Different `vars:` count as different parameters, so both run. (`allow_duplicates: true` in `meta/main.yml` forces repeats even with identical parameters.)

## Scope: Do Role Variables Leak?

| How the role is used | Its `defaults`/`vars` visible to later tasks in the play? |
|---|---|
| `roles:` at play level | Yes |
| `import_role` | Yes |
| `include_role` | No, unless `public: true` |

Relying on leaked role variables in later tasks couples plays to role internals. If other tasks need a value, expose it deliberately with `set_fact` or `include_role` `public: true`, and document it.

## Documenting the Interface

```markdown title="roles/nginx/README.md"
## Required variables
None for plain HTTP. With `nginx_tls_enabled: true`:
| Variable | Description |
|---|---|
| `nginx_tls_certificate` | Certificate path on the managed node |
| `nginx_tls_key` | Private key path on the managed node |

## Optional variables
See `defaults/main.yml`; every variable is documented there.

## Outputs
Sets no facts. Notifies the `Reload nginx` handler when configuration changes.

## Example
    - hosts: web
      roles:
        - role: nginx
          vars:
            nginx_vhosts:
              - { name: shop, server_names: [shop.example.com], upstream: "127.0.0.1:8080" }
```

## Common Mistakes

- Unnamespaced role variables (`port` instead of `nginx_port`) colliding with another role's variable of the same name.
- A role with no documented interface — consumers have to read `tasks/main.yml` to discover what's configurable.
- Putting configurable values in `vars/main.yml`, where inventory can't override them.
- Reading a variable in tasks that has no default, so the role fails with "undefined" instead of a clear validation message.
- Depending on variables that leaked from a previously run role.

## Interview Questions

- Why namespace role variables instead of using short, generic names?
- How would you document a role's required vs. optional variables for other teams to consume it safely?
- What does `meta/argument_specs.yml` give you that assertions in tasks don't?
- How do you apply the same role twice in one play with different inputs?

## Next

Continue to [Production Role Design](03-production-role-design.md).
