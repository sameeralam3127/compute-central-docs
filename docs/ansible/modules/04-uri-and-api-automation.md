---
title: "Ansible uri Module (ansible.builtin.uri): REST API Examples"
icon: lucide/globe
description: "Ansible uri module examples: GET and POST to REST APIs, JSON bodies, auth, retries, and status_code, plus a converter that turns any curl command into a uri task."
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

Or paste the whole command. The converter handles quoting, bundled flags such as `-sSL`, JSON and form bodies, and commands copied from a browser's developer tools, and it moves tokens and passwords into variables so they don't end up in your playbook:

<div class="cc-tool" data-cc-tool="curl2uri" markdown>
**curl to uri converter** (needs JavaScript). Without it, translate the command flag by flag with the table above.
</div>

To download a file, prefer [`ansible.builtin.get_url`](03-file-package-service-user-modules.md). It verifies the file with `checksum:`, sets `owner`, `group`, and `mode` in the same task, and is the module reviewers expect for downloads.

## Why Not `shell: curl ...`

```yaml
# Loses structure: raw exit code, unparsed stdout, no built-in status check
- ansible.builtin.shell: curl -X POST https://registry.internal/api/v1/hosts -d '{"hostname":"{{ inventory_hostname }}"}'
```

`uri` gives you a structured, `register`-able result (`registration.json`, `registration.status`) instead of a string you'd have to parse yourself, checks the status code declaratively via `status_code:`, and avoids building a shell command string out of variables — which is a real injection risk the moment any value is even slightly untrusted. It also works on hosts that don't have `curl` installed.

## Check Mode and Destructive Calls

`uri` doesn't support check mode. Under `--check`, every `uri` task is **skipped**, harmless `GET`s included, so a later task that reads `result.json` fails the dry run even though a real run would work. Let read-only requests run anyway:

```yaml
- name: Read the current config (safe during --check)
  ansible.builtin.uri:
    url: https://api.example.com/v1/config
  register: current
  check_mode: false
```

Never put `check_mode: false` on a `POST`, `PUT`, `PATCH`, or `DELETE`: your dry run would start changing things.

Destructive calls need a guard of their own. Look up every ID before deleting, and refuse if any isn't what you expect:

```yaml
- name: Look up each object first
  ansible.builtin.uri:
    url: "https://api.example.com/v1/objects/{{ item }}"
    headers:
      Authorization: "Bearer {{ api_token }}"
  loop: "{{ ids_to_delete }}"
  register: lookups
  check_mode: false
  no_log: true

- name: Refuse unless every ID is the kind of object we mean to delete
  ansible.builtin.assert:
    that: lookups.results | map(attribute='json.type') | unique | list == ['app']
    fail_msg: "Some IDs are not apps. Nothing was deleted."
```

!!! incident "Real incident: Atlassian, April 2022"
    A script meant to delete a retired app's data was given the IDs of entire customer sites, didn't check what they referred to, and ran in "permanently delete" mode. 883 sites belonging to 775 customers were deleted in 23 minutes, and some took 14 days to restore. The full guardrail, including a recoverable delete by default, is in [Automation Outages](../case-studies/08-automation-outages-and-guardrails.md#atlassian-2022-right-script-wrong-ids-permanent-mode).

## What Most Engineers Miss

- **`uri` reads `~/.netrc` on the managed node.** `use_netrc` defaults to `true`, so if the target user's `.netrc` has credentials for that host, they're sent even though the task sets none. Set `use_netrc: false` when that would surprise you.
- **`follow_redirects: safe` doesn't follow a redirect on `POST`.** The task gets the `301` or `302` back and fails with `Status code was 302 and not [200]`. Set `follow_redirects: all` or post to the final URL. The old `yes`/`no` values are deprecated and removed in ansible-core 2.22.
- **`timeout` applies to each attempt.** With `retries: 30`, `delay: 5`, and the default `timeout: 30`, a dead endpoint can hold the task for 30 × (30 + 5) seconds, over 17 minutes, not 150 seconds. Lower `timeout` on health checks.
- **`form-multipart` writes its own `Content-Type`**, boundary included, and ignores yours. With `json` and `form-urlencoded` you can override it through `headers`.
- **The request leaves from the managed node**, so its DNS, firewall rules, and proxy settings apply. To use a proxy, set `environment: { https_proxy: "http://proxy:3128" }` on the task.

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

## Check Yourself

!!! quiz "201 Created"
    A `uri` task POSTs to an API that answers `201 Created`. The task doesn't set `status_code`. What happens?

    - [ ] The task succeeds: any 2xx status is a success
    - [x] The task fails with `Status code was 201 and not [200]`
    - [ ] The task succeeds but reports `changed`

    `status_code` defaults to `[200]` only. List every status the API documents as success, such as `status_code: [200, 201]`.

!!! quiz "The dry run that failed"
    A playbook GETs `/v1/config` with `uri`, then uses `result.json.version` in a `when:`. The real run works, but `--check` fails on the `when:`. Why?

    - [ ] `--check` sends requests without headers
    - [x] `uri` doesn't support check mode, so the GET was skipped and `result` has no `json`
    - [ ] `when:` isn't evaluated in check mode

    Add `check_mode: false` to the read-only GET so it runs during dry runs too. Never do that for requests that change something.

!!! quiz "401 with the right password"
    A `uri` task sets `url_username` and `url_password` for a Jenkins API and gets `401 Unauthorized`, though the credentials are correct. What's the most likely fix?

    - [ ] `validate_certs: false`
    - [x] `force_basic_auth: true`
    - [ ] `body_format: json`

    Without `force_basic_auth`, `uri` waits for a `401` challenge before sending credentials, and many APIs never send one. Forcing it sends the `Authorization` header on the first request.

## Interview Questions

- What does `uri`'s `status_code:` parameter actually control, and what's its default?
- Where does a `uri` task run, and how do you make it call an API from the control node instead?
- Why does basic auth sometimes fail with `401` even with correct credentials?
- Why is `uri` preferred over `shell: curl` for API automation in a reviewed playbook?

## Related

- [Case study: API automation with uri](../case-studies/07-api-automation-with-uri.md)

## Next

Continue to [Playbook Engineering](../playbook-engineering/index.md).
