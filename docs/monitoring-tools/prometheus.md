---
description: Learn how Prometheus fits into a monitoring stack, including scrape targets, configuration files, alert examples, health checks, and practical improvements.
---

# Prometheus Guide for the Monitoring Stack

Prometheus is the core metrics and alerting engine in this monitoring lab.

## What It Does

- Scrapes metrics from configured targets
- Stores time-series data
- Evaluates alert rules
- Supplies metrics to Grafana

## Important Files

- `prometheus/prometheus.yml`
- `prometheus/rules/alerts.yml`

## Main Scrape Targets

- Prometheus
- Alertmanager
- Node Exporter
- cAdvisor
- Blackbox Exporter
- Blackbox HTTP probe jobs

## Why This Layout Works

It combines host metrics, container metrics, and endpoint checks in one place. That gives a more complete view than using only one exporter type.

## Example Alerts

- `TargetDown`
- `HostHighCPU`
- `HostHighMemory`
- `ContainerHighCPU`
- `ContainerHighMemory`
- `SyntheticProbeFailed`

## Practical Improvements

- Add severity labels such as `warning` and `critical`
- Add `for:` windows to reduce alert noise
- Add ownership labels for teams or services
- Add recording rules for repeated expensive queries

## Quick Check

```bash
docker compose logs -f prometheus
curl http://localhost:9090/-/healthy
curl http://localhost:9090/api/v1/targets
```

## FAQ

### What is Prometheus used for?

Prometheus collects and stores metrics as time-series data. It is commonly used for infrastructure, container, application, and service health monitoring.

### Is Prometheus the same as Grafana?

No. Prometheus stores and queries metrics. [Grafana](grafana.md) visualizes metrics and logs through dashboards and panels.

### What is a scrape target?

A scrape target is an endpoint that exposes metrics for Prometheus to collect. Common targets include Node Exporter, cAdvisor, application metrics endpoints, and Blackbox Exporter probes.

### When should I add Alertmanager?

Add [Alertmanager](alertmanager.md) when you need alert grouping, routing, silencing, deduplication, and notification delivery.

## Related Learning

- [Monitoring stack overview](index.md)
- [Grafana guide](grafana.md)
- [Monitoring troubleshooting](troubleshooting.md)
- [Observability system design](../system-design/observability.md)
