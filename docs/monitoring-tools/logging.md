---
description: Learn Loki and Promtail logging flow, important configuration files, log sources, validation commands, and practical improvements for local monitoring labs.
---

# Loki and Promtail Logging Guide

This page explains the logging flow in the monitoring lab.

## Important Files

- `loki/loki-config.yml`
- `promtail/promtail-config.yml`

## How the Flow Works

1. Promtail reads logs from configured sources.
2. Promtail adds labels and forwards the logs.
3. Loki stores and indexes the log streams.
4. Grafana queries Loki for dashboards and exploration.

## Log Sources in This Setup

- Host log files from `/var/log`
- Docker container logs from `/var/lib/docker/containers`

## Why Loki Fits Well

- Works cleanly with Grafana
- Uses labels effectively
- Is lighter than some larger log platforms for small labs

## Structured Logs and Events

Make application logs queryable by emitting stable fields rather than relying only on text. A useful event includes timestamp, level, service, environment, event name, request ID, and trace ID when tracing is enabled.

```json
{"level":"ERROR","service":"orders-api","event":"payment_authorization_failed","request_id":"req-8f52","trace_id":"4bf92f..."}
```

Keep high-cardinality values such as request IDs inside the log body or parsed fields, not as Loki stream labels. Labels should be low-cardinality selectors such as service, environment, and cluster.

## What to Validate

- Promtail can read the configured paths
- Loki is healthy
- Grafana can query the Loki data source
- Labels are useful enough to filter logs clearly

## Practical Improvements

- Add better labels for service, host, and environment
- Set retention rules
- Reduce noisy low-value logs
- Parse structured logs where possible
- Correlate logs with request IDs and trace IDs
- Redact secrets and personal data before forwarding

## Quick Check

```bash
docker compose logs -f promtail
docker compose logs -f loki
curl http://localhost:3100/ready
```
