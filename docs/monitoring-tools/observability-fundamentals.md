---
description: Understand observability theory and use logs, events, metrics, and traces together for practical monitoring and incident response.
---

# Observability Fundamentals: Logs, Events, Metrics, and Traces

Monitoring tells you that a known condition is unhealthy. Observability gives you enough evidence to ask new questions about a system you did not anticipate. In production, use both: dashboards and alerts for known risks, then logs and traces to investigate the unknowns.

## The Four Operational Signals

| Signal | Best for | Example question | Common store |
| --- | --- | --- | --- |
| Metrics | Trends, rates, capacity, alerts | Is error rate above 1%? | Prometheus |
| Logs | Detailed discrete records | Why did this request fail? | Loki, Elasticsearch |
| Traces | Request paths and latency | Which dependency made checkout slow? | Tempo, Jaeger |
| Events | Important state changes | Did a deploy begin before the incident? | Log/event backend or vendor platform |

### Metrics

Metrics are numeric time series identified by a metric name and labels. They are efficient for aggregation and alerting. Good examples are request count, active jobs, latency histogram buckets, CPU time, and free disk bytes.

Use counters for values that only increase, gauges for values that rise and fall, and histograms for distributions such as request duration. Avoid labels with unbounded values such as user ID, request ID, email address, or full URL: they create high cardinality and make queries and storage expensive.

### Logs

Logs are individual records. Prefer structured JSON logs over prose-only messages so that fields such as `service`, `environment`, `level`, `request_id`, `trace_id`, and `status_code` can be filtered. Log enough context to reproduce a failure, but never write passwords, tokens, full payment data, or other secrets.

### Traces

A trace follows one request through one or more services. Each operation is a span; parent-child span relationships show the execution path. Trace IDs let an operator pivot from a slow dashboard panel to the exact request and its correlated logs.

### Events

Events are business or operational facts: deployments, feature-flag changes, queue failovers, a user signup, or a payment failure. Events become far more useful when they have a timestamp, owner, environment, correlation ID, and a stable event name.

## Practical Incident Flow

1. Start with an alert or dashboard: identify impact, start time, and affected service.
2. Check recent events: deploys, configuration changes, feature flags, or traffic spikes.
3. Narrow metrics by service, endpoint, region, and status code.
4. Open a representative trace to find the slow or failing span.
5. Search correlated logs using the trace ID or request ID.
6. Record the cause, mitigation, and an action that prevents recurrence.

## Alerting Theory That Works in Practice

Alert on user impact and actionable conditions, not every interesting metric. A useful alert says what is wrong, who owns it, how severe it is, and where to start.

- Use a `for:` duration to avoid paging on short spikes.
- Define `warning` and `critical` consistently.
- Include runbook and dashboard links in alert annotations.
- Alert on symptoms such as availability, errors, and latency before causes such as CPU.
- Review noisy alerts; an ignored page is an operational defect.

## A Small Service-Level Objective Example

For a service with a 99.9% monthly availability objective, the error budget is 0.1% of eligible requests. An error-budget burn alert detects when failures consume that budget too quickly. This is often more meaningful than a fixed CPU threshold because it connects the alert to user experience.

## Correlation Fields

Use the same fields across telemetry where possible:

```text
service.name=checkout-api
deployment.environment=production
service.version=2026.08.16
trace_id=4bf92f3577b34da6a3ce929d0e0e4736
request_id=req-8f52
```

These fields make Grafana links, Loki queries, and trace searches practical instead of manual detective work.

## Related Learning

- [Stack walkthrough](overview.md)
- [Prometheus guide](prometheus.md)
- [Python logging in practice](python-logging.md)
- [OpenTelemetry and platforms](opentelemetry-platforms.md)
