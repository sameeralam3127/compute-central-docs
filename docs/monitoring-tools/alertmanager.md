---
title: "Alertmanager: Routing, Grouping, Silences, and Inhibition"
icon: lucide/bell-ring
description: "Alertmanager for the monitoring stack — grouping, routing, silences, inhibition, and receivers that keep alerts actionable instead of noisy."
tags:
  - Monitoring
  - Alerting
---

# Alertmanager Guide for the Monitoring Stack

## What You'll Learn

- What Alertmanager does after Prometheus fires an alert
- How routing trees send alerts to the right team
- How grouping, silences, and inhibition reduce noise

Alertmanager receives alerts from Prometheus and decides how they should be grouped, routed, silenced, and repeated.

## What It Handles

- Grouping related alerts
- Routing alerts to the right destination
- Silencing planned maintenance noise
- Preventing duplicate or unnecessary notifications

## A Practical Routing Model

- Group alerts by service, team, or severity
- Send critical alerts immediately
- Batch warning alerts to reduce noise
- Silence known maintenance windows

## Good Routing Ideas

- Infrastructure alerts to the platform team
- Probe failures to the owning service team
- Low-severity alerts to email or chat summaries
- High-severity alerts to paging tools

## Useful Concepts to Add Over Time

- `group_by`
- `group_wait`
- `group_interval`
- `repeat_interval`
- Inhibition rules
- Receiver-specific routes

## Practical Advice

- Avoid paging for every single alert
- Keep severity labels consistent in Prometheus rules
- Test routes before relying on them in incidents

## Quick Check

```bash
docker compose logs -f alertmanager
curl http://localhost:9093/-/healthy
```

## Common Mistakes

- Sending every alert to one channel, so important pages drown in noise.
- No grouping, so one outage produces hundreds of notifications.
- Creating silences with no expiry or no comment explaining why.
- Not using inhibition, so a node-down alert is followed by every service alert on that node.
- Never testing routing — use `amtool config routes test` before an incident does it for you.

## Interview Questions

- What's the difference between grouping, inhibition, and silencing?
- How does Alertmanager avoid duplicate notifications when Prometheus runs in high availability?
- How would you design routing for a platform team and three product teams?

## Next

Continue to [Loki Logging With Grafana Alloy](logging.md). To page on user impact instead of thresholds, see [Alerting on SLOs](../sre/02-alerting-on-slos.md).
