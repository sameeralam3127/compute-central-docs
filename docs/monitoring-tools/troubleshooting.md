---
title: "Monitoring Stack Troubleshooting Guide"
icon: lucide/life-buoy
description: Troubleshoot a Prometheus, Grafana, Loki, Alertmanager, and Blackbox Exporter monitoring stack with practical checks for data, targets, logs, probes, and ports.
tags:
  - Monitoring
  - Troubleshooting
---

# Monitoring Stack Troubleshooting Guide

## What You'll Learn

- A debug order that finds the broken component quickly
- Fixes for empty dashboards, down targets, missing logs, and failing probes
- How to apply configuration changes and reset the lab safely

This page collects the most common issues you may hit while running the monitoring lab locally.

## Grafana Starts but Shows No Data

Check:

- Prometheus is healthy
- Targets are up in Prometheus
- Grafana data sources loaded correctly

```bash
docker compose ps
docker compose logs -f prometheus
docker compose logs -f grafana
```

## Prometheus Targets Show Down

Check:

- Exporter container names and ports
- Docker network connectivity
- Scrape job definitions in `prometheus/prometheus.yml`

```bash
curl http://localhost:9090/api/v1/targets
docker compose logs -f prometheus
```

## Loki Runs but Logs Do Not Appear

Check:

- The collector (Grafana Alloy, or Promtail in older setups) can read the Docker socket and `/var/log`
- Loki is healthy
- Grafana has the Loki data source

```bash
docker compose logs -f alloy
docker compose logs -f loki
curl http://localhost:3100/ready
```

## Blackbox Probes Fail

Check:

- The target endpoint is reachable
- Probe target names are correct
- Docker service networking resolves correctly
- `blackbox/blackbox.yml` uses the expected module

## Host Port Conflicts

This usually happens when something else already uses `3000`, `8080`, or `9090`.

Check:

- Which local process already owns the port
- Whether the `docker-compose.yml` host mapping needs to change

## Config Changes Do Not Take Effect

Try:

```bash
docker compose down
docker compose up -d --build
```

If you need a full reset:

```bash
docker compose down -v
docker compose up -d --build
```

## Practical Debug Order

1. Check container status.
2. Review service logs.
3. Test health endpoints.
4. Review Prometheus targets.
5. Check Grafana data sources and dashboards.

## Common Mistakes

- Restarting everything before checking which component is actually failing.
- Running `docker compose down -v` to "fix" a problem and deleting all stored metrics, logs, and dashboards.
- Debugging Grafana panels before confirming Prometheus targets are up.
- Editing configuration inside running containers instead of the mounted files, then losing the change on restart.

## Interview Questions

- Grafana shows no data. What do you check, in order?
- A Prometheus target shows as down. What are the likely causes?
- Logs aren't appearing in Loki. How do you narrow down whether the collector or Loki is at fault?

## Next

Continue to [Kubernetes Observability & Health](../kubernetes/observability/index.md) to apply the same signals inside a cluster.
