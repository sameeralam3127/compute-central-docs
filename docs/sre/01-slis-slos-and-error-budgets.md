---
title: "SLIs, SLOs, and Error Budgets Explained"
icon: lucide/target
description: "Define reliability with SLIs, SLOs, and error budgets — user-centric indicators, realistic targets, PromQL recording rules, and budget policies."
tags:
  - SRE
  - SLO
---

# SLIs, SLOs, and Error Budgets

## What You'll Learn

- The difference between SLIs, SLOs, and SLAs
- How to choose indicators that reflect what users actually experience
- How to set targets, calculate error budgets, and measure them with PromQL
- How an error budget policy turns reliability into clear engineering decisions

## Definitions

| Term | Is | Example |
|---|---|---|
| **SLI** — service level indicator | A measurement of some aspect of service, usually a ratio of good events to valid events | Proportion of checkout requests that return successfully within 500 ms |
| **SLO** — service level objective | A target for an SLI over a time window | 99.5% of checkout requests succeed within 500 ms, over 28 days |
| **SLA** — service level agreement | A contract with consequences (usually credits) if missed | 99.0% monthly availability, or customers receive a 10% credit |
| **Error budget** | The amount of unreliability the SLO allows | 0.5% of requests in the window may fail |

SLOs should be **stricter than SLAs**, so you get warned and can react before contractual penalties apply.

## Why Not 100%?

- Users can't tell the difference between 99.99% and 100%, because their own networks, devices, and ISPs fail more often than that.
- Every additional nine costs dramatically more: redundancy, slower change processes, more engineering time.
- A 100% target leaves **no room for change**. Every deploy is risky, so teams stop deploying — which makes reliability worse over time.

## Choosing SLIs

Measure from the user's point of view, as close to the user as practical.

| Service type | Good SLIs |
|---|---|
| Request-driven (APIs, websites) | **Availability**: proportion of requests that succeed. **Latency**: proportion of requests faster than a threshold. |
| Data pipelines | **Freshness**: proportion of data updated within N minutes. **Correctness**: proportion of records processed correctly. **Coverage**: proportion of expected data processed. |
| Storage | **Durability**: proportion of written data that can be read back. |
| Scheduled jobs | Proportion of runs that complete successfully and on time |

Guidelines:

- **Express SLIs as good events ÷ valid events**, so they're always between 0 and 100%.
- **Use thresholds for latency, not averages.** "95% of requests under 300 ms" captures what users feel; the mean hides the slow tail.
- **Define "valid" carefully.** Exclude health checks and, usually, client errors like `404` for nonexistent resources — but not `401`s caused by a broken auth service.
- **Measure at the load balancer or edge** when you can, so requests that never reach the application still count.
- **Cover critical user journeys**, not every endpoint: log in, search, add to cart, check out.

## Setting Targets

1. **Start from historical performance.** If checkout succeeded 99.8% of the time over the last quarter, an initial SLO of 99.5% is achievable and meaningful.
2. **Check it against user expectations.** Would users notice or complain at that level? Talk to product and support.
3. **Choose the window.** A **rolling 28 or 30 days** is common — it always reflects recent experience and spans the same number of weekends.
4. **Keep dependencies in mind.** A service can't be more reliable than the dependencies it calls synchronously without redundancy.
5. **Revisit quarterly.** Tighten targets that are always easily met and nobody notices; loosen ones that are constantly missed without user impact.

## Error Budgets

```text
error budget = 1 − SLO
```

| SLO | Allowed failure | Downtime equivalent over 30 days |
|---|---|---|
| 99% | 1% | 7.2 hours |
| 99.5% | 0.5% | 3.6 hours |
| 99.9% | 0.1% | 43.2 minutes |
| 99.95% | 0.05% | 21.6 minutes |
| 99.99% | 0.01% | 4.3 minutes |

For request-based SLIs, the budget is a number of **bad requests**, not minutes. At 99.9% with 50 million requests in 30 days, the budget is 50,000 failed requests — which a total outage at peak traffic might consume in minutes, and a small elevated error rate might consume over weeks.

## Measuring SLIs With Prometheus

Given a histogram metric from the application or ingress controller:

```promql
# Availability SLI over 28 days: non-5xx responses ÷ all responses
sum(rate(http_requests_total{job="checkout", code!~"5.."}[28d]))
/
sum(rate(http_requests_total{job="checkout"}[28d]))
```

```promql
# Latency SLI: requests faster than 500 ms ÷ all requests
sum(rate(http_request_duration_seconds_bucket{job="checkout", le="0.5"}[28d]))
/
sum(rate(http_request_duration_seconds_count{job="checkout"}[28d]))
```

The latency threshold must match a histogram bucket boundary (`le="0.5"`), so choose buckets with your SLO thresholds in mind.

Queries over 28 days are expensive. Record short-window ratios continuously with **recording rules**, and aggregate those:

```yaml title="prometheus/rules/slo-checkout.yml"
groups:
  - name: slo-checkout-availability
    interval: 30s
    rules:
      - record: slo:sli_error:ratio_rate5m
        labels: { service: checkout, slo: availability }
        expr: |
          sum(rate(http_requests_total{job="checkout", code=~"5.."}[5m]))
          /
          sum(rate(http_requests_total{job="checkout"}[5m]))

      - record: slo:sli_error:ratio_rate1h
        labels: { service: checkout, slo: availability }
        expr: |
          sum(rate(http_requests_total{job="checkout", code=~"5.."}[1h]))
          /
          sum(rate(http_requests_total{job="checkout"}[1h]))

      # ...the same for 30m, 6h, 1d, 3d — used by burn-rate alerts

      - record: slo:error_budget_remaining:ratio
        labels: { service: checkout, slo: availability }
        expr: |
          1 - (
            (1 - (
              sum(increase(http_requests_total{job="checkout", code!~"5.."}[28d]))
              /
              sum(increase(http_requests_total{job="checkout"}[28d]))
            ))
            / (1 - 0.995)
          )
```

Tools like [Sloth](https://sloth.dev/) and [Pyrra](https://github.com/pyrra-dev/pyrra) generate these rules and burn-rate alerts from a short SLO definition, which avoids hand-writing error-prone PromQL:

```yaml title="slos/checkout.yaml (Sloth)"
version: prometheus/v1
service: checkout
slos:
  - name: requests-availability
    objective: 99.5
    sli:
      events:
        error_query: sum(rate(http_requests_total{job="checkout",code=~"5.."}[{{.window}}]))
        total_query: sum(rate(http_requests_total{job="checkout"}[{{.window}}]))
    alerting:
      name: CheckoutAvailability
      page_alert:
        labels: { severity: critical }
      ticket_alert:
        labels: { severity: warning }
```

## Error Budget Policies

The budget is only useful if it changes decisions. Agree on a written policy **before** you need it, signed off by engineering and product leadership:

```markdown title="Checkout error budget policy (example)"
**SLO:** 99.5% of checkout requests succeed, rolling 28 days.

**While budget remains:** the team ships normally. Planned risk (migrations, experiments) is acceptable.

**When less than 25% of the budget remains:**
- Deploys require an additional reviewer from the owning team.
- Reliability work already in the backlog is prioritized next.

**When the budget is exhausted:**
- Feature releases pause, except urgent security and bug fixes.
- The team works on reliability items from recent postmortems until the SLI
  has been back above the SLO for 7 consecutive days.

**Single incident consuming more than 20% of the budget:** requires a postmortem
with at least one P1 action item.

**Exceptions:** outages caused entirely by a dependency covered by its own SLO are
reviewed with that team; the budget is still counted, but the freeze decision is
made jointly.
```

## Reporting

A simple SLO dashboard per service:

- Current SLI over the window versus the target
- Error budget remaining, as a percentage and a trend line
- Burn rate over the last hour and day
- Incidents annotated on the timeline

Review SLOs in a regular operations meeting. Missing a target should trigger a conversation, not blame; meeting it effortlessly every month should trigger the question of whether the target is useful.

## Common Mistakes

- Choosing SLIs that are easy to measure (CPU, pod restarts) instead of what users experience.
- Setting targets aspirationally ("five nines") with no link to history, cost, or user expectations.
- Averaging latency instead of counting requests under a threshold.
- An error budget with no policy, so running out changes nothing.
- An SLO for every endpoint, producing dashboards nobody reads — start with a few critical journeys.
- Counting health-check traffic as valid requests, inflating availability.

## Interview Questions

- Explain the difference between an SLI, an SLO, and an SLA.
- Why shouldn't a service aim for 100% availability?
- What SLIs would you choose for a payments API? For a nightly data pipeline?
- A service has a 99.9% SLO and handles 10 million requests a month. What's its error budget?
- What should happen when a team exhausts its error budget?

## Next

Continue to [Alerting on SLOs](02-alerting-on-slos.md).
