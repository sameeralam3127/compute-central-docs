---
description: Use Blackbox Exporter for synthetic monitoring checks, endpoint probes, configuration validation, practical improvements, and monitoring stack health checks.
---

# Blackbox Exporter Guide for the Monitoring Stack

Blackbox Exporter adds synthetic checks to the monitoring lab. Instead of reading host metrics, it probes endpoints to see whether they are actually reachable.

## Important File

- `blackbox/blackbox.yml`

## What It Checks

- HTTP reachability
- Response success or failure
- Basic latency visibility

## How It Is Used Here

The stack uses blackbox probes for internal targets such as:

- Grafana
- Prometheus
- cAdvisor
- Alertmanager
- Loki

## Why It Matters

Metrics tell you whether a service is running. Synthetic checks tell you whether something can really reach and use that service. Both views are useful.

## Good Metrics to Watch

- Probe success
- Probe duration
- HTTP status result
- Failure trends over time

## Practical Improvements

- Add external URL probes
- Add HTTPS validation
- Add DNS and TCP modules
- Label probe targets by service and environment

## Quick Check

```bash
docker compose logs -f blackbox
curl http://localhost:9115
```
