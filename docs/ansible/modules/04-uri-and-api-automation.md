---
title: "Ansible uri Module (ansible.builtin.uri): REST API Examples"
icon: lucide/globe
description: "Ansible uri module examples — GET and POST to REST APIs with ansible.builtin.uri, JSON bodies, basic and bearer auth, retries, status_code, and curl equivalents."
tags:
  - Ansible
  - Modules
---

# URI and API Automation

`ansible.builtin.uri` sends an HTTP or HTTPS request (GET, POST, PUT, PATCH, DELETE) from Ansible and returns the response as structured data: `result.status` for the status code, `result.json` for a parsed JSON body. It fails the task if the status code isn't in `status_code`, which defaults to `[200]` only. It's Ansible's built-in replacement for `curl`.

## What You'll Learn

- Calling an HTTP API declaratively with `ansible.builtin.uri`
- The parameters you'll use on almost every request, and their defaults
- How to read a JSON response, authenticate, and retry until a service is ready
- How to translate a `curl` command into `uri`, and why `uri` beats `shell: curl`

## Minimal Example

```yaml
- name: Check that the app is healthy
  ansible.builtin.uri:
    url: "http://localhost:8080/health"
    status_code: 200
```

`uri` runs **on the managed node**, like every other module. `localhost` here is the target host, not your control node. To call an external API once from the control node, add `delegate_to: localhost` and `run_once: true`.

## Parameters You'll Actually Use

| Parameter | Default | What it does |
|---|---|---|
| `url` | (required) | Full URL, including `http://` or `https://` |
| `method` | `GET` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, or any other verb |
| `headers` | `{}` | Dictionary of request headers |
| `body` | none | Request body. A dictionary or list when used with `body_format: json` or `form-urlencoded` |
| `body_format` | `raw` | `json`, `form-urlencoded`, `form-multipart`, or `raw`. `json` serializes `body` and sets `Content-Type: application/json` |
| `status_code` | `[200]` | Status codes that count as success. Anything else fails the task |
| `return_content` | `false` | Put the response body in `result.content`. JSON responses are parsed into `result.json` either way |
| `url_username` / `url_password` | none | Credentials for HTTP basic auth |
| `force_basic_auth` | `false` | Send credentials on the first request instead of waiting for a `401` challenge |
| `validate_certs` | `true` | Verify the server's TLS certificate. Set `ca_path` instead of turning this off |
| `timeout` | `30` | Seconds to wait for a response |
| `follow_redirects` | `safe` | `safe` follows redirects only for `GET` and `HEAD`. `all` follows every redirect |
| `dest` | none | Save the response body to this path on the managed node |

## GET a JSON API and Use the Response

```yaml
- name: Look up the latest node_exporter release
  ansible.builtin.uri:
    url: https://api.github.com/repos/prometheus/node_exporter/releases/latest
    headers:
      Accept: application/vnd.github+json
  register: release
  delegate_to: localhost
  run_once: true

- name: Show the version
  ansible.builtin.debug:
    msg: "Latest node_exporter is {{ release.json.tag_name }}"
```

Because the response is `application/json`, `uri` parses it into `release.json`. You can index into it like any other variable: `release.json.assets | map(attribute='name') | list`.

## POST With a JSON Body and a Bearer Token

```yaml
- name: Register this host with the service registry
  ansible.builtin.uri:
    url: "https://registry.internal/api/v1/hosts"
    method: POST
    headers:
      Authorization: "Bearer {{ registry_token }}"
    body_format: json
    body:
      hostname: "{{ inventory_hostname }}"
      role: web
    status_code: [200, 201]
  register: registration
  changed_when: registration.status == 201
  no_log: true
```

- `body_format: json` serializes `body:` to JSON and sets the right `Content-Type` automatically.
- `status_code: [200, 201]` matters. With the default `[200]`, an API that answers a POST with `201 Created` or `204 No Content` fails the task even though the request worked.
- `uri` can't tell whether a POST changed anything on the server, so `changed_when` reports it from the status: `201` means a new record, `200` means it already existed.
- `no_log: true` because the request includes a bearer token. See [Security](../production-engineering/04-security.md).

## Basic Auth and OAuth Tokens

```yaml
- name: Call an API that uses HTTP basic auth
  ansible.builtin.uri:
    url: https://jenkins.internal/api/json
    url_username: "{{ jenkins_user }}"
    url_password: "{{ jenkins_api_token }}"
    force_basic_auth: true
  register: jenkins
  no_log: true
```

Without `force_basic_auth: true`, Ansible sends credentials only after the server replies `401` with a `WWW-Authenticate` header. Many APIs, including GitHub and Jenkins, never send that challenge, so the request fails with `401` even though the credentials are correct.

For OAuth2 client credentials, fetch a token with a form-encoded POST, then pass it to later requests:

```yaml
- name: Get an access token
  ansible.builtin.uri:
    url: https://auth.example.com/oauth2/token
    method: POST
    body_format: form-urlencoded
    body:
      grant_type: client_credentials
      client_id: "{{ client_id }}"
      client_secret: "{{ client_secret }}"
  register: token
  no_log: true

- name: Call the API with the token
  ansible.builtin.uri:
    url: https://api.example.com/v1/inventory
    headers:
      Authorization: "Bearer {{ token.json.access_token }}"
  register: inventory
  no_log: true
```

## Retry Until a Service Is Ready

```yaml
- name: Wait for the app to report healthy after a restart
  ansible.builtin.uri:
    url: "http://{{ ansible_host }}:8080/health"
    status_code: 200
  register: health
  until: health.status == 200
  retries: 30
  delay: 5
```

This polls every 5 seconds for up to 150 seconds. While the port is closed, `health.status` is `-1`, so the loop keeps retrying instead of failing on the first attempt. This is the standard health gate in a [rolling deployment](../case-studies/01-rolling-nginx-deployment.md).

## The Response: What `register` Gives You

| Key | Contains |
|---|---|
| `status` | HTTP status code, or `-1` if the connection failed |
| `json` | The parsed body, when the response is JSON |
| `content` | The raw body, only with `return_content: true` |
| `msg` | A summary such as `OK (512 bytes)` or the failure reason |
| `url` | The final URL after redirects |
| `redirected` | Whether a redirect was followed |
| `elapsed` | Seconds the request took |
| `cookies` | Cookies the server set, as a dictionary |
| response headers | Each header as its own key, lowercased with `-` changed to `_`, such as `content_type` or `location` |

Run `ansible.builtin.debug: var=result` once against a new API to see the exact shape.

## curl to uri

| curl | uri |
|---|---|
| `curl -X POST` | `method: POST` |
| `-H 'Accept: application/json'` | `headers: { Accept: application/json }` |
| `-d '{"a":1}'` with a JSON header | `body: { a: 1 }` and `body_format: json` |
| `--data-urlencode a=1` | `body: { a: 1 }` and `body_format: form-urlencoded` |
| `-u user:pass` | `url_username`, `url_password`, `force_basic_auth: true` |
| `-k` / `--insecure` | `validate_certs: false` (labs only) |
| `--cacert ca.pem` | `ca_path: /path/to/ca.pem` |
| `--cert` / `--key` | `client_cert`, `client_key` |
| `-L` | `follow_redirects: all` |
| `-o file` | `dest: /path/to/file` |
| `--max-time 10` | `timeout: 10` |
| `--fail` | `status_code` (fails on anything not listed) |

To download a file, prefer [`ansible.builtin.get_url`](03-file-package-service-user-modules.md). It verifies the file with `checksum:`, sets `owner`, `group`, and `mode` in the same task, and is the module reviewers expect for downloads.

## Why Not `shell: curl ...`

```yaml
# Loses structure: raw exit code, unparsed stdout, no built-in status check
- ansible.builtin.shell: curl -X POST https://registry.internal/api/v1/hosts -d '{"hostname":"{{ inventory_hostname }}"}'
```

`uri` gives you a structured, `register`-able result (`registration.json`, `registration.status`) instead of a string you'd have to parse yourself, checks the status code declaratively via `status_code:`, and avoids building a shell command string out of variables — which is a real injection risk the moment any value is even slightly untrusted. It also works on hosts that don't have `curl` installed.

## Common Errors

| Error | Cause and fix |
|---|---|
| `Status code was 201 and not [200]` | The request worked, but `201` isn't in `status_code`. Add it: `status_code: [200, 201]` |
| `Status code was 401 and not [200]: HTTP Error 401: Unauthorized` | Bad credentials, or basic auth without `force_basic_auth: true` |
| `Status code was -1 and not [200]: Request failed: <urlopen error [Errno 111] Connection refused>` | Nothing is listening. Either the service is down, or `uri` ran on the managed node when you meant the control node (add `delegate_to: localhost`) |
| `Status code was -1 ... CERTIFICATE_VERIFY_FAILED` | The server uses a private CA. Point `ca_path` at the CA bundle rather than setting `validate_certs: false` |
| `The read operation timed out` | The API took longer than `timeout` (default 30 seconds). Raise `timeout` |
| `'dict object' has no attribute 'json'` | The response wasn't JSON, often an HTML error page. Add `return_content: true` and check `result.content` |

## Common Mistakes

- Leaving `status_code` at its default of `[200]` for a POST, PUT, or DELETE that returns `201`, `202`, or `204`. The task fails even though the request worked.
- Not setting `no_log: true` on requests carrying credentials or tokens.
- Calling an external API from every host when it should run once: add `run_once: true` and `delegate_to: localhost`.
- Turning off `validate_certs` instead of trusting the right CA with `ca_path`.
- Reaching for `shell: curl` out of habit when `uri` already covers the case — see [Command vs. Shell](01-command-vs-shell-vs-raw-vs-script.md).

## Interview Questions

- What does `uri`'s `status_code:` parameter actually control, and what's its default?
- Where does a `uri` task run, and how do you make it call an API from the control node instead?
- Why does basic auth sometimes fail with `401` even with correct credentials?
- Why is `uri` preferred over `shell: curl` for API automation in a reviewed playbook?

## Related

- [Case study: API automation with uri](../case-studies/07-api-automation-with-uri.md)

## Next

Continue to [Playbook Engineering](../playbook-engineering/index.md).
