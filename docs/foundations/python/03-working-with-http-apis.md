---
title: "Python HTTP APIs: httpx, Retries, and Pagination"
icon: lucide/webhook
description: "Call HTTP APIs reliably from Python — httpx clients, timeouts, retries with backoff and jitter, rate limits, pagination, and authentication."
tags:
  - Python
  - APIs
  - HTTP
---

# Working With HTTP APIs

## What You'll Learn

- How to use a reusable `httpx` client with sensible timeouts
- How to retry the right failures with exponential backoff and jitter
- How to handle rate limits, pagination, and authentication
- How to turn HTTP failures into clear errors your tool can act on

## Use a Client, Not One-Off Calls

```python
import httpx

with httpx.Client(
    base_url="https://api.github.com",
    headers={"Accept": "application/vnd.github+json", "User-Agent": "opsctl/0.1"},
    timeout=httpx.Timeout(10.0, connect=3.0),
) as client:
    r = client.get("/repos/prometheus/prometheus/releases/latest")
    r.raise_for_status()
    print(r.json()["tag_name"])
```

A client reuses TCP and TLS connections across requests (much faster), and holds shared settings: base URL, headers, authentication, and timeouts.

`httpx` has an API very close to `requests` and adds HTTP/2 and async support. Everything on this page applies to `requests` with small syntax changes.

## Timeouts Are Not Optional

Without a timeout, a request to a server that accepts the connection but never responds waits **forever**. `httpx` defaults to 5 seconds; set timeouts deliberately anyway:

```python
timeout = httpx.Timeout(
    connect=3.0,     # establishing the TCP and TLS connection
    read=15.0,       # waiting for response data
    write=10.0,
    pool=5.0,        # waiting for a free connection from the pool
)
```

## Handling Errors

```python
import logging
import httpx

log = logging.getLogger(__name__)

def get_json(client: httpx.Client, path: str) -> dict:
    try:
        r = client.get(path)
        r.raise_for_status()
        return r.json()
    except httpx.HTTPStatusError as exc:
        # The server responded with 4xx or 5xx
        log.error("%s %s returned %s: %s", exc.request.method, exc.request.url,
                  exc.response.status_code, exc.response.text[:200])
        raise
    except httpx.TransportError as exc:
        # DNS failure, connection refused, timeout, TLS error
        log.error("could not reach %s: %s", exc.request.url, exc)
        raise
```

## Retries With Backoff

Retry **transient** failures only:

| Retry | Don't retry |
|---|---|
| Timeouts and connection errors | `400`, `401`, `403`, `404`, `422` — retrying won't change the answer |
| `429 Too Many Requests` (respect `Retry-After`) | Non-idempotent requests (`POST`) unless the API supports idempotency keys |
| `502`, `503`, `504` | |

Use [tenacity](https://tenacity.readthedocs.io/) to express the policy clearly:

```python title="src/opsctl/http.py"
import logging

import httpx
from tenacity import (
    before_sleep_log,
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential_jitter,
)

log = logging.getLogger(__name__)
RETRYABLE_STATUS = {429, 502, 503, 504}


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.TransportError):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in RETRYABLE_STATUS
    return False


@retry(
    retry=retry_if_exception(_is_retryable),
    stop=stop_after_attempt(5),
    wait=wait_exponential_jitter(initial=1, max=30),  # ~1s, 2s, 4s, 8s... plus random jitter
    before_sleep=before_sleep_log(log, logging.WARNING),
    reraise=True,
)
def get_with_retries(client: httpx.Client, url: str, **kwargs) -> httpx.Response:
    r = client.get(url, **kwargs)
    r.raise_for_status()
    return r
```

**Jitter** matters: if a hundred clients fail at the same moment and all retry after exactly 2 seconds, they hit the recovering server together again. Randomized delays spread them out.

### Respect `Retry-After`

```python
import time

def get_respecting_rate_limit(client: httpx.Client, url: str) -> httpx.Response:
    for _ in range(5):
        r = client.get(url)
        if r.status_code != 429:
            r.raise_for_status()
            return r
        wait = int(r.headers.get("Retry-After", "5"))
        log.warning("rate limited, sleeping %ss", wait)
        time.sleep(min(wait, 60))
    raise RuntimeError(f"still rate limited after 5 attempts: {url}")
```

Many APIs also report remaining quota in headers such as `X-RateLimit-Remaining`. Slow down before you hit the limit when running bulk jobs.

## Pagination

APIs return large collections in pages. Three common styles:

| Style | How you get the next page |
|---|---|
| **Link header** (GitHub) | Follow `Link: <...>; rel="next"` |
| **Cursor / token** (most modern APIs, AWS) | Pass back a `next_cursor` or `nextToken` value |
| **Offset / page number** | Increment `page` or `offset` until results are empty |

```python
from collections.abc import Iterator

def iter_link_pages(client: httpx.Client, url: str, params: dict | None = None) -> Iterator[dict]:
    """Yield items from every page of a Link-header-paginated API."""
    next_url: str | None = url
    while next_url:
        r = get_with_retries(client, next_url, params=params)
        yield from r.json()
        next_url = r.links.get("next", {}).get("url")
        params = None                      # the next URL already includes query parameters

def iter_cursor_pages(client: httpx.Client, url: str) -> Iterator[dict]:
    cursor = None
    while True:
        params = {"limit": 100, **({"cursor": cursor} if cursor else {})}
        data = get_with_retries(client, url, params=params).json()
        yield from data["items"]
        cursor = data.get("next_cursor")
        if not cursor:
            break
```

Generators keep memory flat — you can process 100,000 items without holding them all at once.

```python
with httpx.Client(base_url="https://api.github.com", headers=headers, timeout=10) as client:
    stale = [
        repo["full_name"]
        for repo in iter_link_pages(client, "/orgs/acme/repos", {"per_page": 100})
        if not repo["archived"] and repo["pushed_at"] < "2025-01-01"
    ]
```

## Authentication

```python
import os

# Bearer token from the environment
client = httpx.Client(headers={"Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}"})

# Basic auth
client = httpx.Client(auth=(os.environ["API_USER"], os.environ["API_PASSWORD"]))

# Mutual TLS with a client certificate
client = httpx.Client(cert=("/etc/opsctl/client.crt", "/etc/opsctl/client.key"))

# A private certificate authority — verify against it, never disable verification
client = httpx.Client(verify="/etc/ssl/certs/internal-ca.pem")
```

!!! warning "Never use `verify=False`"
    Disabling TLS verification lets anyone on the network path read and modify the traffic, including your tokens. Point `verify` at the right CA bundle instead.

Load tokens from environment variables injected by CI or a secrets manager — never hard-code them or commit them.

## Idempotent Writes

When creating resources, make retries safe:

```python
import uuid

key = str(uuid.uuid4())
r = client.post(
    "/v1/deployments",
    json={"service": "orders-api", "version": "2.14.0"},
    headers={"Idempotency-Key": key},   # the server returns the original result for a repeated key
)
```

If the API doesn't support idempotency keys, check whether the resource already exists before creating it, and don't retry `POST` automatically.

## Async for Many Concurrent Requests

For checking hundreds of endpoints, `httpx.AsyncClient` runs requests concurrently. Always bound concurrency:

```python
import asyncio
import httpx

async def check_all(urls: list[str], concurrency: int = 20) -> dict[str, int | str]:
    sem = asyncio.Semaphore(concurrency)
    async with httpx.AsyncClient(timeout=5) as client:
        async def one(url: str) -> tuple[str, int | str]:
            async with sem:
                try:
                    r = await client.get(url)
                    return url, r.status_code
                except httpx.TransportError as exc:
                    return url, type(exc).__name__
        return dict(await asyncio.gather(*(one(u) for u in urls)))

results = asyncio.run(check_all(urls))
```

## Putting It Together: The Health Check Module

This is the module behind `opsctl check` from the [previous chapter](02-cli-tools-and-subprocess.md). Retries and backoff are parameters, so tests can turn the waiting off.

```python title="src/opsctl/health.py"
import logging
import time
from dataclasses import dataclass

import httpx
from tenacity import (
    RetryError,
    Retrying,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential_jitter,
    wait_none,
)

log = logging.getLogger(__name__)
RETRYABLE_STATUS = {429, 502, 503, 504}


@dataclass(frozen=True)
class HealthResult:
    url: str
    ok: bool
    status_code: int | None
    elapsed_ms: float


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.TransportError):
        return True
    return isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code in RETRYABLE_STATUS


def check(
    url: str, *, timeout: float = 5.0, attempts: int = 3, backoff: float = 0.5
) -> HealthResult:
    """GET a health endpoint, retrying transient failures. Never raises."""
    start = time.monotonic()
    status: int | None = None
    retrying = Retrying(
        retry=retry_if_exception(_is_retryable),
        stop=stop_after_attempt(attempts),
        wait=wait_exponential_jitter(initial=backoff, max=10) if backoff else wait_none(),
    )
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            for attempt in retrying:
                with attempt:
                    response = client.get(url)
                    status = response.status_code
                    response.raise_for_status()
        ok = True
    except (RetryError, httpx.HTTPError) as exc:
        log.warning("health check failed for %s: %s", url, exc)
        ok = False
    return HealthResult(url, ok, status, (time.monotonic() - start) * 1000)
```

## Common Mistakes

- No timeout, so a single unresponsive endpoint hangs a cron job indefinitely.
- Retrying every error, including `401` and `404`, and hammering an API that will never succeed.
- Retrying without backoff and jitter, turning a brief outage into a self-inflicted overload.
- Reading only the first page of results and silently processing incomplete data.
- `verify=False` to get past a certificate error.
- Creating a new client for every request, losing connection reuse.
- Logging full responses or headers that contain tokens.

## Interview Questions

- Which HTTP failures should an automation script retry, and which should it not?
- Why add jitter to exponential backoff?
- How do you handle an API that returns `429 Too Many Requests`?
- How would you safely retry a request that creates a resource?
- Why reuse a client object instead of calling `httpx.get` repeatedly?

## Next

Continue to [AWS Automation With boto3](04-aws-automation-with-boto3.md).
