---
title: "Advanced Ansible Jinja2: Macros and Whitespace"
icon: lucide/sparkles
description: "Advanced Jinja2 for Ansible: macros that work like template functions, whitespace control that stops mangling config files, and custom filter plugins."
tags:
  - Ansible
  - Jinja2
---

# Advanced Jinja2

## What You'll Learn

- How to reuse template snippets with `{% macro %}` and `{% import %}`
- How whitespace control keeps generated config files clean and diffs quiet
- Why `{% set %}` inside a loop "doesn't work," and how `namespace()` fixes it
- How to write a custom filter plugin when built-in filters get unreadable

## Why This Exists

Once templates generate real configuration — nginx vhosts, HAProxy backends, Prometheus scrape configs — the same snippet appears in several files, blank lines pile up, and expressions get long. These features keep large templates maintainable.

## Macros: Functions for Templates

A macro is a named, parameterized block of template text:

```jinja title="templates/macros/nginx.j2"
{% macro upstream(name, servers, port=8080) -%}
upstream {{ name }} {
{% for server in servers %}
    server {{ server }}:{{ port }} max_fails=3 fail_timeout=10s;
{% endfor %}
}
{%- endmacro %}

{% macro location(path, upstream_name) -%}
    location {{ path }} {
        proxy_pass http://{{ upstream_name }};
        proxy_set_header Host $host;
        proxy_set_header X-Request-ID $request_id;
    }
{%- endmacro %}
```

Use it from any template in the role:

```jinja title="templates/site.conf.j2"
{% import 'macros/nginx.j2' as nginx %}

{{ nginx.upstream('checkout', groups['checkout']) }}
{{ nginx.upstream('payments', groups['payments'], port=8081) }}

server {
    listen 443 ssl;
    server_name {{ site_name }};

{{ nginx.location('/api/checkout', 'checkout') }}
{{ nginx.location('/api/payments', 'payments') }}
}
```

Import paths are resolved from the role's `templates/` directory (and the playbook's `templates/`), the same search path the `template` module uses for `src`.

## Whitespace Control

Every `{% %}` tag leaves its line behind in the output. Without control, loops and conditionals produce stray blank lines and odd indentation.

| Syntax / setting | Effect |
|---|---|
| `{%- ... %}` | Strip whitespace (including newlines) **before** the tag |
| `{% ... -%}` | Strip whitespace **after** the tag |
| `trim_blocks` | Remove the first newline after a block tag. **On by default** in the `template` module |
| `lstrip_blocks` | Strip spaces and tabs from the start of a line up to a block tag. **Off by default** |

Enable `lstrip_blocks` so block tags can be indented for readability without indenting the output:

```yaml
- name: Render HAProxy config
  ansible.builtin.template:
    src: haproxy.cfg.j2
    dest: /etc/haproxy/haproxy.cfg
    lstrip_blocks: true
    validate: haproxy -c -f %s
```

Or set it in the template itself, on the first line:

```jinja
#jinja2: lstrip_blocks: True
backend web_pool
    {% for host in groups['web'] %}
    server {{ host }} {{ hostvars[host]['ansible_host'] }}:80 check
    {% endfor %}
```

Output, with no blank lines between servers:

```text
backend web_pool
    server web01 10.0.1.11:80 check
    server web02 10.0.1.12:80 check
```

## Variables Inside Templates: set and namespace

`{% set %}` computes an intermediate value:

```jinja
{% set is_prod = 'production' in group_names %}
log_level = {{ 'warning' if is_prod else 'debug' }}
```

But a `set` **inside a loop** is scoped to that iteration, so this classic counter stays at 0:

```jinja
{% set total = 0 %}
{% for svc in services %}{% set total = total + svc.workers %}{% endfor %}
total_workers = {{ total }}     {# prints 0 #}
```

Use a `namespace` object, whose attributes survive the loop:

```jinja
{% set ns = namespace(total=0, has_tls=false) %}
{% for svc in services %}
{%   set ns.total = ns.total + svc.workers %}
{%   if svc.tls | default(false) %}{% set ns.has_tls = true %}{% endif %}
{% endfor %}
total_workers = {{ ns.total }}
tls_enabled = {{ ns.has_tls | lower }}
```

For that particular sum, a filter is shorter: `{{ services | map(attribute='workers') | sum }}`.

## Custom Filter Plugins

When an expression needs three chained filters and a regex just to build one string, a small Python filter is clearer and testable.

```python title="plugins/filter/network_filters.py"
from ansible.errors import AnsibleFilterError


def to_upstream_list(hosts, hostvars, port=80):
    """Turn inventory hostnames into 'address:port' strings."""
    try:
        return [f"{hostvars[h]['ansible_host']}:{port}" for h in hosts]
    except KeyError as exc:
        raise AnsibleFilterError(f"to_upstream_list: host missing ansible_host: {exc}")


class FilterModule:
    def filters(self):
        return {"to_upstream_list": to_upstream_list}
```

Where the file lives decides how you call it:

| Location | Usage in a template |
|---|---|
| `filter_plugins/` next to the playbook | `{{ groups['web'] \| to_upstream_list(hostvars, 8080) }}` |
| `plugins/filter/` in a collection | `{{ groups['web'] \| acme.platform.to_upstream_list(hostvars, 8080) }}` |

Packaging filters in a collection is covered in [Build a Collection From Zero](../build-your-own/03-build-a-collection-from-zero.md).

## Macros, set_fact, or a Filter?

| Need | Best tool |
|---|---|
| Repeat a block of **text** with different inputs | Macro |
| Compute a value used by several tasks, not just one template | `set_fact` or a variable in inventory |
| Transform **data** in a way that's hard to read in Jinja2 | Custom filter plugin |
| One-off intermediate value in a single template | `{% set %}` |

## Common Mistakes

- Overusing macros for logic that would be clearer as a `set_fact` computed before the template renders at all.
- Not using whitespace control, producing config files with irregular blank lines that make diffs noisy in review — and triggering `changed` on runs where nothing meaningful changed.
- Expecting `{% set %}` inside a `for` loop to update a variable outside it — use `namespace()`.
- Writing a custom filter that talks to the network or reads remote files — filters run on the control node during rendering and should be pure data transforms.
- Forgetting `validate:` on templates for services with a config checker (`nginx -t -c %s`, `haproxy -c -f %s`), so a broken render is deployed before anything notices.

## Interview Questions

- When would you write a custom Jinja2 filter instead of chaining built-in ones?
- What does whitespace control (`{%-`/`-%}`) actually change in rendered output, and what do `trim_blocks` and `lstrip_blocks` do?
- Why doesn't a counter updated with `{% set %}` inside a loop keep its value, and how do you fix it?
- Where does a filter plugin execute — control node or managed node?

## Next

Continue to [Modules](../modules/index.md).
