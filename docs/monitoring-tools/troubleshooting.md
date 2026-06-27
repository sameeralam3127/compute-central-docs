---
description: Troubleshoot a Prometheus, Grafana, Loki, Alertmanager, and Blackbox Exporter monitoring stack with practical checks for data, targets, logs, probes, and ports.
---

# Monitoring Stack Troubleshooting Guide

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

- Promtail can read the configured paths
- Loki is healthy
- Grafana has the Loki data source

```bash
docker compose logs -f promtail
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
