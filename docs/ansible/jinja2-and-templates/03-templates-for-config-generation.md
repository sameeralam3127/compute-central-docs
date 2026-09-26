---
title: "Ansible Template Module: Config File Example"
icon: lucide/file-cog
description: "The Ansible template module renders a Jinja2 .j2 file with the host's variables and copies the result to the target. Loops, conditionals, and why not lineinfile."
tags:
  - Ansible
  - Jinja2
  - Templates
---

# Templates for Config Generation

`ansible.builtin.template` renders a Jinja2 `.j2` file using that host's variables and copies the result to the target — the right way to manage a whole config file.

## What You'll Learn

- The `template` module and `.j2` file convention
- Loops and conditionals inside a template file, not just in a task
- When `template` is the right tool, and when `lineinfile` is better instead

## Minimal Example

```jinja title="templates/nginx.conf.j2"
server {
    listen {{ http_port }};
    server_name {{ server_name }};
    root {{ document_root }};
}
```

```yaml
- name: Deploy nginx configuration
  ansible.builtin.template:
    src: nginx.conf.j2
    dest: /etc/nginx/sites-available/app.conf
  notify: Restart nginx
```

## Practical Example — Loops and Conditionals Inside a Template

```jinja title="templates/app.conf.j2"
# {{ ansible_managed }}
upstream app_backend {
{% for backend in upstream_servers %}
    server {{ backend.host }}:{{ backend.port }} max_fails=3 fail_timeout=10s;
{% endfor %}
    keepalive 32;
}

server {
    listen {{ http_port }};
    server_name {{ server_name }};
{% if ssl_enabled %}
    listen 443 ssl;
    ssl_certificate     {{ ssl_cert_path }};
    ssl_certificate_key {{ ssl_key_path }};
    ssl_protocols       TLSv1.2 TLSv1.3;
{% endif %}

    location / {
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```yaml
vars:
  http_port: 80
  server_name: shop.example.com
  ssl_enabled: true
  ssl_cert_path: /etc/ssl/certs/shop.pem
  ssl_key_path: /etc/ssl/private/shop.key
  upstream_servers:
    - { host: 10.0.1.10, port: 8080 }
    - { host: 10.0.1.11, port: 8080 }
```

```yaml
- name: Deploy the site config
  ansible.builtin.template:
    src: app.conf.j2
    dest: /etc/nginx/conf.d/app.conf
    owner: root
    group: root
    mode: "0644"
  notify: Reload nginx

- name: Test the full nginx config before reloading
  ansible.builtin.command: nginx -t
  changed_when: false
```

`{% for %}`/`{% if %}` (statement tags, not expression tags) work inside any file the `template` module renders — the whole file is one Jinja2 document, not just the parts that look like variables. One `upstream` block with a loop inside it gives nginx a real pool to balance across; `keepalive` plus the empty `Connection` header reuse connections to the backends instead of opening a new one per request.

`{{ ansible_managed }}` renders a "this file is managed by Ansible" comment, which warns the next person who opens the file on the server not to edit it by hand.

!!! tip "Validating a fragment"
    `validate: nginx -t -c %s` only works for a **complete** config such as `/etc/nginx/nginx.conf`. A `conf.d/` fragment isn't a valid config on its own, so for fragments run `nginx -t` as a separate task after writing it (as above), before the handler reloads nginx.

## Why `template`, Not `lineinfile`, for Whole Files

```yaml
# Fragile — depends on the file already existing in a specific shape,
# and can't express "regenerate this file's structure from variables"
- ansible.builtin.lineinfile:
    path: /etc/nginx/nginx.conf
    regexp: "^worker_connections"
    line: "worker_connections 1024;"

# Correct for files you own outright — one template, fully regenerated
- ansible.builtin.template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
```

`lineinfile`/`blockinfile` are the right tool for surgically editing *part* of a file you don't fully own (a system file another process also writes to). `template` is right when Ansible owns the entire file's content — it's simpler to reason about, and a diff of the template source shows the *whole* intended config, not scattered regex patches. See [Copy vs. Template](../modules/02-module-decision-trees.md) for the fuller decision guide.

## Common Mistakes

- Using `lineinfile` to build up an entire config file line by line instead of one `template` — harder to review, and each `lineinfile` task is a separate idempotency check instead of one coherent render.
- Forgetting `notify:` on a `template` task that changes a service's config — the service never picks up the new config until restarted; see [Handlers](../core-concepts/08-handlers.md).
- Hardcoding environment-specific values directly in the `.j2` file instead of passing them as variables — defeats the entire point of templating.

## Interview Questions

- Why would you choose `template` over `lineinfile` for a config file, and vice versa?
- Can a Jinja2 template file contain loops and conditionals, not just variable substitution?

## Next

Continue to [Advanced Jinja2](04-advanced-jinja2.md).
