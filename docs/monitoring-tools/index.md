---
title: "Monitoring Stack: Prometheus, Grafana, and Loki"
icon: lucide/activity
description: "A practical observability stack — Prometheus, Grafana, Alertmanager, Loki with Grafana Alloy, exporters, synthetic checks, and troubleshooting."
tags:
  - Monitoring
  - Overview
---

# Monitoring Stack Overview: Prometheus, Grafana, Loki, and Alertmanager

## What You'll Learn

- What each component in the stack does and how the signals connect
- The recommended order for learning and running the lab
- Where each page fits, from fundamentals to troubleshooting

This section explains a practical observability stack built with Prometheus, Grafana, Alertmanager, Loki, Grafana Alloy, OpenTelemetry, Blackbox Exporter, Node Exporter, and application instrumentation.

## What This Stack Covers

- Metrics with Prometheus
- Dashboards with Grafana
- Alert routing with Alertmanager
- Logs with Loki and Grafana Alloy (Promtail's supported successor)
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

- [Observability fundamentals: logs, events, metrics, and traces](observability-fundamentals.md)
- [Stack walkthrough](overview.md)
- [Prometheus](prometheus.md)
- [Node Exporter](node-exporter.md)
- [Grafana](grafana.md)
- [Alertmanager](alertmanager.md)
- [Logging with Loki and Grafana Alloy](logging.md)
- [Python logging in practice](python-logging.md)
- [OpenTelemetry and other platforms](opentelemetry-platforms.md)
- [Blackbox Exporter](blackbox.md)
- [Troubleshooting](troubleshooting.md)

## Common Mistakes

- Building dashboards but no alerts, so problems are only found by someone looking at the right screen.
- Alerting on causes (CPU is high) instead of symptoms users feel (errors, latency).
- Using high-cardinality values such as user IDs as metric or log labels.
- Not planning retention and storage, then losing history exactly when an incident needs it.
- Not monitoring the monitoring stack itself.

## Interview Questions

- What question does each signal — metrics, logs, traces — answer best?
- Why does Prometheus pull metrics instead of having services push them?
- Why is Alertmanager a separate component from Prometheus?

## Further Reading

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)

## Next

Continue to [Observability Fundamentals](observability-fundamentals.md). To apply these tools inside a cluster, see [Kubernetes Observability & Health](../kubernetes/observability/index.md).
