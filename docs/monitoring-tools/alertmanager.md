---
description: Understand Alertmanager routing, grouping, silences, notification flow, practical routing models, health checks, and alerting improvements for monitoring stacks.
---

# Alertmanager Guide for the Monitoring Stack

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
