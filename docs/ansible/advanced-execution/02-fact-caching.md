---
title: "Ansible Fact Caching Explained"
icon: lucide/database-zap
description: Ansible fact caching — jsonfile and redis backends, cache timeout, and avoiding repeated fact gathering across runs.
tags:
  - Ansible
  - Advanced Execution
  - Performance
---

# Fact Caching

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

Fact gathering is a real remote execution step (the implicit `setup` module call) with real cost, repeated at the start of nearly every play — fact caching lets a run reuse facts gathered recently instead of re-gathering them every single time.

## What It Will Cover

```ini title="ansible.cfg"
[defaults]
fact_caching = jsonfile
fact_caching_connection = /tmp/ansible_fact_cache
fact_caching_timeout = 86400
```

- Backends: `jsonfile` (local disk, simplest), `redis`/`memcached` (shared across multiple control nodes or CI runners)
- `fact_caching_timeout` — how long a cached fact is trusted before re-gathering
- `gather_facts: smart` — gather only if the cache doesn't already have fresh facts for this host
- `set_fact ... cacheable: true` — persisting a computed value into the fact cache, not just the current run
- The tradeoff: stale cached facts (a host's IP changed, cache didn't expire yet) vs. gathering cost — when each backend makes sense

## Common Mistakes

- Enabling fact caching with a long timeout on hosts whose facts genuinely change often (autoscaled infrastructure), then debugging "wrong" values that are actually just stale.
- Using `jsonfile` caching across multiple CI runners that don't share a filesystem — each runner gets its own cache, defeating the point.

## Interview Questions

- What problem does fact caching solve, and what's the tradeoff against always gathering fresh?
- Why would a team choose `redis` fact caching over `jsonfile`?

## Next

Continue to [Connection Plugins](03-connection-plugins.md).
