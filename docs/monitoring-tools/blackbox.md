---
title: "Blackbox Exporter: Synthetic Checks for Endpoints"
icon: lucide/scan-line
description: Use Blackbox Exporter for synthetic monitoring checks, endpoint probes, configuration validation, practical improvements, and monitoring stack health checks.
tags:
  - Monitoring
  - Synthetic Monitoring
---

# Blackbox Exporter Guide for the Monitoring Stack

## What You'll Learn

- What synthetic probes check that internal metrics can't
- How Blackbox Exporter is configured and scraped by Prometheus
- Which probe metrics to alert on

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

## Common Mistakes

- Probing only from inside the same network, missing DNS, TLS, and firewall problems users actually hit.
- Not alerting on certificate expiry with `probe_ssl_earliest_cert_expiry`.
- Confusing synthetic probes with Kubernetes liveness and readiness probes — see [Probes](../kubernetes/observability/01-probes-liveness-readiness-startup.md) for the in-cluster kind.
- Probing so often that the checks themselves become load.

## Interview Questions

- What does a synthetic check catch that application metrics miss?
- How does Prometheus pass the target URL to Blackbox Exporter?
- How would you alert two weeks before a TLS certificate expires?

## Next

Continue to [Troubleshooting](troubleshooting.md).
