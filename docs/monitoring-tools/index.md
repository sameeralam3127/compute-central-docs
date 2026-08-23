---
description: Learn a practical monitoring stack with Prometheus, Grafana, Alertmanager, Loki, Promtail, Blackbox Exporter, exporters, dashboards, alerts, and troubleshooting.
---

# Monitoring Stack Overview: Prometheus, Grafana, Loki, and Alertmanager

This section explains a practical observability stack built with Prometheus, Grafana, Alertmanager, Loki, Promtail, OpenTelemetry, Blackbox Exporter, Node Exporter, and application instrumentation.

## What This Stack Covers

- Metrics with Prometheus
- Dashboards with Grafana
- Alert routing with Alertmanager
- Logs with Loki and Promtail
- Events and traces with OpenTelemetry
- Synthetic checks with Blackbox Exporter

## Why This Setup Is Useful

Many examples stop at metrics only. This stack is more practical because it combines the main observability layers in one place:

- Metrics
- Logs
- Events and traces
- Alerts
- Endpoint reachability checks

That makes it a solid learning setup for DevOps and SRE work.

## Recommended Flow

1. Learn the observability signals and how they answer different questions.
2. Start the lab and verify the services.
3. Review Prometheus, Node Exporter, and Grafana.
4. Add alerting, structured application logs, traces, and blackbox checks.
5. Use the troubleshooting page when a service does not behave as expected.

## Pages in This Section

- [Stack walkthrough](overview.md)
- [Observability fundamentals: logs, events, metrics, and traces](observability-fundamentals.md)
- [Prometheus](prometheus.md)
- [Node Exporter](node-exporter.md)
- [Grafana](grafana.md)
- [Alertmanager](alertmanager.md)
- [Logging with Loki and Promtail](logging.md)
- [Python logging in practice](python-logging.md)
- [OpenTelemetry and other platforms](opentelemetry-platforms.md)
- [Blackbox Exporter](blackbox.md)
- [Troubleshooting](troubleshooting.md)
