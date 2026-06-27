---
description: Learn how Grafana provides dashboards and log views for a monitoring lab, including provisioning files, data sources, dashboard checks, and practical improvements.
---

# Grafana Guide for the Monitoring Stack

Grafana provides the dashboards and log views for the monitoring lab.

## Important Files

- `grafana/provisioning/datasources/datasources.yml`
- `grafana/provisioning/dashboards/dashboards.yml`
- `grafana/dashboards/advanced-monitoring-dashboard.json`

## What Happens Automatically

Grafana is provisioned on startup, so you do not need to create data sources and dashboards by hand every time.

That usually gives you:

- A Prometheus data source
- A Loki data source
- A ready-made dashboard for the stack

## Why Provisioning Matters

- Keeps dashboards reproducible
- Prevents manual drift
- Makes reviews easier because changes live in Git

## What to Validate

- Prometheus data source is healthy
- Loki data source is healthy
- Dashboards load without broken panels
- Panels show useful host, container, and probe metrics

## Good Dashboard Areas

- CPU, memory, disk, and network
- Container resource trends
- Prometheus target health
- Probe success rate
- Recent logs from Loki
- Alert summary

## Quick Check

```bash
docker compose logs -f grafana
curl http://localhost:3000/api/health
```

Default login:

- Username: `admin`
- Password: `admin`

## FAQ

### What is Grafana used for?

Grafana is used to build dashboards, explore metrics and logs, and make system health easier to understand during normal operations and incidents.

### Does Grafana store metrics?

Grafana usually visualizes data from other systems. In this stack, metrics come from [Prometheus](prometheus.md) and logs come from [Loki](logging.md).

### Why provision Grafana dashboards?

Provisioning keeps data sources and dashboards reproducible. It also lets teams review dashboard changes in Git instead of relying on manual UI edits.

### What should a good monitoring dashboard show?

A useful dashboard shows service health, latency or probe success, resource usage, error signals, recent logs, and alert context without overwhelming the operator.

## Related Learning

- [Prometheus guide](prometheus.md)
- [Loki and Promtail logging](logging.md)
- [Monitoring stack troubleshooting](troubleshooting.md)
- [Observability system design](../system-design/observability.md)
