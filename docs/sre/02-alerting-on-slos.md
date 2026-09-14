---
title: "Alerting on SLOs: Multi-Window, Multi-Burn-Rate Alerts"
icon: lucide/bell-ring
description: "Replace noisy alerts with SLO burn-rate alerting — multi-window, multi-burn-rate Prometheus rules, routing, and unit tests with promtool."
tags:
  - SRE
  - Alerting
  - Prometheus
---

# Alerting on SLOs

## What You'll Learn

- Why threshold alerts on causes create noise and still miss real incidents
- What burn rate is, and how it connects alerts to the error budget
- How multi-window, multi-burn-rate alerts balance fast detection with few false alarms
- How to implement, route, and test these alerts in Prometheus and Alertmanager

## What Makes a Good Page

Every page should be:

- **Urgent** — it needs a human now, not tomorrow.
- **Actionable** — there's something the responder can do.
- **User-impacting** — it reflects real or imminent harm to users.
- **Novel** — not a repeat of something already being handled.

Traditional alerts like "CPU above 80%" or "error rate above 1% for 5 minutes" fail these tests. High CPU often harms nobody. A 1% error rate might be normal for one service and catastrophic for another. And a slow, steady degradation can stay just under a threshold for days while quietly consuming the whole error budget.

## Burn Rate

**Burn rate** is how fast the service is consuming its error budget, relative to the rate that would use exactly the whole budget over the SLO window.

```text
burn rate = observed error ratio ÷ (1 − SLO)
```

For a 99.9% SLO (budget ratio 0.001):

| Observed error ratio | Burn rate | Budget exhausted after |
|---|---|---|
| 0.1% | 1 | 30 days — exactly on budget |
| 0.6% | 6 | 5 days |
| 1.44% | 14.4 | about 2 days |
| 10% | 100 | about 7 hours |

A burn rate of 1 is fine. A sustained burn rate of 14.4 means that in just **one hour**, 2% of a 30-day budget disappears.

## Multi-Window, Multi-Burn-Rate Alerts

The approach recommended in Google's SRE Workbook uses several alert conditions, each pairing a burn rate with two windows:

| Severity | Budget consumed | Long window | Short window | Burn rate | Action |
|---|---|---|---|---|---|
| **Page** | 2% | 1 hour | 5 minutes | 14.4 | Wake someone up |
| **Page** | 5% | 6 hours | 30 minutes | 6 | Wake someone up |
| **Ticket** | 10% | 3 days | 6 hours | 1 | Fix during working hours |

Why two windows per condition?

- The **long window** ensures enough budget has actually burned to matter, so a 30-second blip doesn't page.
- The **short window** ensures the problem is **still happening**, so the alert resolves quickly after recovery instead of firing for an hour after the fix.

Why several burn rates?

- A fast, severe outage trips the 14.4× condition within minutes.
- A moderate degradation that would drain the budget in days trips the 6× condition.
- A slow leak that nobody would notice for weeks becomes a ticket.

## Prometheus Rules

First, recording rules for the error ratio over each window (as introduced in [SLIs, SLOs, and Error Budgets](01-slis-slos-and-error-budgets.md#measuring-slis-with-prometheus)):

```yaml title="prometheus/rules/slo-checkout-recording.yml"
groups:
  - name: slo-checkout-error-ratios
    interval: 30s
    rules:
      - record: slo:sli_error:ratio_rate5m
        labels: { service: checkout }
        expr: sum(rate(http_requests_total{job="checkout",code=~"5.."}[5m])) / sum(rate(http_requests_total{job="checkout"}[5m]))
      - record: slo:sli_error:ratio_rate30m
        labels: { service: checkout }
        expr: sum(rate(http_requests_total{job="checkout",code=~"5.."}[30m])) / sum(rate(http_requests_total{job="checkout"}[30m]))
      - record: slo:sli_error:ratio_rate1h
        labels: { service: checkout }
        expr: sum(rate(http_requests_total{job="checkout",code=~"5.."}[1h])) / sum(rate(http_requests_total{job="checkout"}[1h]))
      - record: slo:sli_error:ratio_rate6h
        labels: { service: checkout }
        expr: sum(rate(http_requests_total{job="checkout",code=~"5.."}[6h])) / sum(rate(http_requests_total{job="checkout"}[6h]))
      - record: slo:sli_error:ratio_rate3d
        labels: { service: checkout }
        expr: sum(rate(http_requests_total{job="checkout",code=~"5.."}[3d])) / sum(rate(http_requests_total{job="checkout"}[3d]))
```

Then the alerts, for a **99.9%** SLO (budget ratio `0.001`):

```yaml title="prometheus/rules/slo-checkout-alerts.yml"
groups:
  - name: slo-checkout-burn-rate
    rules:
      - alert: CheckoutErrorBudgetBurnFast
        expr: |
          (
            slo:sli_error:ratio_rate1h{service="checkout"} > (14.4 * 0.001)
            and
            slo:sli_error:ratio_rate5m{service="checkout"} > (14.4 * 0.001)
          )
          or
          (
            slo:sli_error:ratio_rate6h{service="checkout"} > (6 * 0.001)
            and
            slo:sli_error:ratio_rate30m{service="checkout"} > (6 * 0.001)
          )
        labels:
          severity: page
          service: checkout
          team: payments
        annotations:
          summary: "Checkout is burning its error budget fast"
          description: >-
            Error ratio is {{ $value | humanizePercentage }} over the alert window,
            which exhausts the 30-day error budget in days or hours.
          runbook_url: https://wiki.example.com/runbooks/checkout-availability
          dashboard_url: https://grafana.example.com/d/checkout-slo

      - alert: CheckoutErrorBudgetBurnSlow
        expr: |
          slo:sli_error:ratio_rate3d{service="checkout"} > (1 * 0.001)
          and
          slo:sli_error:ratio_rate6h{service="checkout"} > (1 * 0.001)
        labels:
          severity: ticket
          service: checkout
          team: payments
        annotations:
          summary: "Checkout is steadily consuming its error budget"
          runbook_url: https://wiki.example.com/runbooks/checkout-availability
```

No `for:` clause is needed — the windows already provide the smoothing.

!!! note "Low-traffic services"
    With only a few requests per hour, a single failure produces a huge error ratio. For low-traffic services, add a minimum request count to the conditions (for example `and sum(rate(http_requests_total{job="checkout"}[1h])) > 0.1`), use longer windows, or supplement real traffic with synthetic probes.

## Route Pages and Tickets

```yaml title="alertmanager/alertmanager.yml (excerpt)"
route:
  receiver: default-slack
  group_by: [alertname, service]
  routes:
    - matchers: [severity="page"]
      receiver: pagerduty-payments
      group_wait: 30s
      repeat_interval: 1h
    - matchers: [severity="ticket"]
      receiver: jira-payments
      group_wait: 10m
      repeat_interval: 24h

receivers:
  - name: pagerduty-payments
    pagerduty_configs:
      - routing_key_file: /etc/alertmanager/secrets/pagerduty-payments
  - name: jira-payments
    webhook_configs:
      - url: http://jira-bridge.monitoring.svc:8080/alerts
  - name: default-slack
    slack_configs:
      - api_url_file: /etc/alertmanager/secrets/slack-webhook
        channel: "#alerts-payments"
```

See [Alertmanager](../monitoring-tools/alertmanager.md) for grouping, inhibition, and silences.

## What About Cause-Based Alerts?

SLO alerts should be the primary **pages**. Cause-based signals still matter, in the right place:

| Signal | Where it belongs |
|---|---|
| SLO burn rate | Page |
| Imminent resource exhaustion that will cause an outage (disk full in 4 hours, certificate expiring in 7 days) | Page or ticket, depending on time to impact |
| High CPU, memory, restarts, queue depth | Dashboards and tickets — they help diagnose, but rarely justify waking someone |
| Every individual component failure behind redundancy | Tickets |

## Testing Alerts

Test rule logic with `promtool` before deploying:

```yaml title="prometheus/tests/slo-checkout-test.yml"
rule_files:
  - ../rules/slo-checkout-alerts.yml

evaluation_interval: 1m

tests:
  - interval: 1m
    input_series:
      # 2% errors for 70 minutes — burn rate 20 on a 99.9% SLO
      - series: 'slo:sli_error:ratio_rate1h{service="checkout"}'
        values: '0.02x70'
      - series: 'slo:sli_error:ratio_rate5m{service="checkout"}'
        values: '0.02x70'
      - series: 'slo:sli_error:ratio_rate6h{service="checkout"}'
        values: '0.005x70'
      - series: 'slo:sli_error:ratio_rate30m{service="checkout"}'
        values: '0.02x70'
    alert_rule_test:
      - eval_time: 10m
        alertname: CheckoutErrorBudgetBurnFast
        exp_alerts:
          - exp_labels:
              severity: page
              service: checkout
              team: payments
            exp_annotations:
              summary: "Checkout is burning its error budget fast"
              description: "Error ratio is 2% over the alert window, which exhausts the 30-day error budget in days or hours."
              runbook_url: https://wiki.example.com/runbooks/checkout-availability
              dashboard_url: https://grafana.example.com/d/checkout-slo
```

```bash
promtool test rules prometheus/tests/slo-checkout-test.yml
```

`promtool` compares every annotation exactly, including rendered templates — here `$value` is the 1-hour error ratio, `0.02`, shown as `2%`.

Then run a **game day**: inject errors in staging (fault injection, a bad deploy, a blocked dependency) and confirm the page arrives, reaches the right person, and links to a runbook that helps.

## Common Mistakes

- Paging on causes such as CPU or pod restarts, and training responders to ignore pages.
- A single threshold with a `for: 5m`, which pages on short blips and misses slow burns.
- Burn-rate alerts on low-traffic services without a minimum request volume, paging on one failed request.
- Pages without runbook and dashboard links.
- Sending tickets and pages to the same channel, so urgent alerts get lost.
- Never testing alert rules, and discovering a typo in a label matcher during an outage.

## Interview Questions

- What is an error budget burn rate?
- Why use two windows for each burn-rate alert?
- Explain the page and ticket conditions for a multi-window, multi-burn-rate setup.
- How would you handle SLO alerting for a service that gets only a few requests per hour?
- Which alerts should page, and which should become tickets?

## Next

Continue to [Incident Response](03-incident-response.md).
