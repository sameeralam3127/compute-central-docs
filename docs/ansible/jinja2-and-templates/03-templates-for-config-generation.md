---
icon: lucide/file-cog
description: Generating real config files with the template module — .j2 files, loops and conditionals inside a template, and why template beats lineinfile for whole-file management.
tags:
  - Ansible
  - Jinja2
  - Templates
---

# Templates for Config Generation

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

```jinja title="templates/nginx.conf.j2"
{% for upstream in upstream_servers %}
upstream backend_{{ loop.index }} {
    server {{ upstream.host }}:{{ upstream.port }};
}
{% endfor %}

server {
    listen {{ http_port }};
{% if ssl_enabled %}
    listen 443 ssl;
    ssl_certificate {{ ssl_cert_path }};
{% endif %}
    location / {
        proxy_pass http://backend_1;
    }
}
```

```yaml
vars:
  http_port: 80
  ssl_enabled: true
  ssl_cert_path: /etc/ssl/certs/app.pem
  upstream_servers:
    - { host: 10.0.1.10, port: 8080 }
    - { host: 10.0.1.11, port: 8080 }
```

`{% for %}`/`{% if %}` (statement tags, not expression tags) work inside any file the `template` module renders — the whole file is one Jinja2 document, not just the parts that look like variables.

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
