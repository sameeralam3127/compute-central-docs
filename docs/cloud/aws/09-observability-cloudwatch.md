---
title: "AWS Observability: CloudWatch, Logs Insights, CloudTrail, Config"
icon: lucide/activity
description: "Observe AWS with CloudWatch metrics, alarms, and Logs Insights, OpenTelemetry tracing, CloudTrail auditing, EventBridge, and AWS Config."
tags:
  - AWS
  - CloudWatch
  - Observability
---

# Observability

## What You'll Learn

- How CloudWatch metrics, alarms, and dashboards work, and which alarms every service needs
- How to query logs quickly with CloudWatch Logs Insights, and control log costs
- How tracing works on AWS with OpenTelemetry
- How CloudTrail, EventBridge, and AWS Config answer "who changed what" and automate responses

## CloudWatch Metrics

Every AWS service publishes metrics to CloudWatch in a **namespace** (`AWS/ApplicationELB`, `AWS/RDS`), identified by **dimensions** (`LoadBalancer`, `DBInstanceIdentifier`).

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB --metric-name TargetResponseTime \
  --dimensions Name=LoadBalancer,Value=app/public-web/50dc6c495c0c9188 \
  --start-time 2026-09-14T09:00:00Z --end-time 2026-09-14T10:00:00Z \
  --period 60 --statistics Average --extended-statistics p99
```

- Standard resolution is 1 minute (many services publish every 1 or 5 minutes); custom metrics can be high resolution (1 second).
- Use **percentiles** (`p99`) for latency, never only the average.
- Publish application metrics with the **CloudWatch agent**, the **embedded metric format** in structured logs, or OpenTelemetry. Alternatively, send everything to **Amazon Managed Service for Prometheus** and use the [Prometheus stack](../../monitoring-tools/index.md) you already know.

## Alarms

```hcl title="Terraform"
resource "aws_cloudwatch_metric_alarm" "alb_5xx_rate" {
  alarm_name          = "orders-api-5xx-rate-high"
  alarm_description   = "More than 2% of requests are failing. Runbook: https://wiki.example.com/runbooks/orders-5xx"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 2
  evaluation_periods  = 5
  datapoints_to_alarm = 3                    # 3 of the last 5 minutes — tolerates one noisy datapoint
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "error_rate"
    expression  = "100 * errors / MAX([errors, requests])"
    label       = "5xx error rate (%)"
    return_data = true
  }
  metric_query {
    id = "errors"
    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "HTTPCode_Target_5XX_Count"
      dimensions  = { LoadBalancer = aws_lb.public.arn_suffix, TargetGroup = aws_lb_target_group.orders.arn_suffix }
      period      = 60
      stat        = "Sum"
    }
  }
  metric_query {
    id = "requests"
    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "RequestCount"
      dimensions  = { LoadBalancer = aws_lb.public.arn_suffix, TargetGroup = aws_lb_target_group.orders.arn_suffix }
      period      = 60
      stat        = "Sum"
    }
  }

  alarm_actions = [aws_sns_topic.pager.arn]
  ok_actions    = [aws_sns_topic.pager.arn]
}
```

Alarm on **rates and symptoms users feel** rather than raw counts: a 5xx count of 50 means nothing without the request volume. Put the runbook link in the description so the page is actionable. See [Alerting on SLOs](../../sre/02-alerting-on-slos.md) for burn-rate alerts.

### Baseline alarms by service

| Service | Alarm on |
|---|---|
| ALB | 5xx rate (ELB and target), `TargetResponseTime` p99, `UnHealthyHostCount` |
| ECS / EKS | Running task or pod count below desired, CPU and memory near limits |
| EC2 / ASG | `StatusCheckFailed`, in-service instances below minimum |
| RDS / Aurora | `FreeStorageSpace`, CPU, `FreeableMemory`, connections, `ReplicaLag` |
| SQS | `ApproximateAgeOfOldestMessage` (work is falling behind), dead-letter queue depth above 0 |
| Lambda | `Errors` rate, `Throttles`, duration near timeout |
| NAT gateway | `ErrorPortAllocation`, `PacketsDropCount` |

**Composite alarms** combine alarms with `AND`/`OR` logic, so one page fires for an incident instead of twenty.

## CloudWatch Logs

- Logs are organized into **log groups** (one per application or component) and **log streams**.
- **Set a retention period on every log group.** The default is to keep logs forever, which becomes a large, silent cost.
- Emit **JSON logs** so fields can be queried directly.

```hcl
resource "aws_cloudwatch_log_group" "orders" {
  name              = "/ecs/orders-api"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.logs.arn
}
```

### Logs Insights

```text
fields @timestamp, level, message, request_id, duration_ms
| filter service = "orders-api" and level = "ERROR"
| sort @timestamp desc
| limit 50
```

```text
# p50/p95/p99 latency per endpoint in 5-minute buckets
filter ispresent(duration_ms)
| stats pct(duration_ms, 50) as p50, pct(duration_ms, 95) as p95, pct(duration_ms, 99) as p99 by bin(5m), path
```

```text
# Top error messages in the last hour
filter level = "ERROR"
| stats count() as errors by message
| sort errors desc
| limit 10
```

Logs Insights charges by data scanned: narrow the time range and log groups before running wide queries. **Metric filters** turn log patterns into metrics you can alarm on, and **subscription filters** stream logs to Firehose, OpenSearch, or a third-party platform. Long-term, cheap retention belongs in S3.

## Tracing With OpenTelemetry

Traces show where time goes across services in a single request. On AWS, instrument applications with **OpenTelemetry** (the AWS Distro for OpenTelemetry, ADOT, packages the collector and SDKs) and send traces to **AWS X-Ray** through CloudWatch, or to any OpenTelemetry-compatible backend.

**CloudWatch Application Signals** uses this instrumentation to build service maps, per-operation latency and error metrics, and SLOs automatically for EKS, ECS, EC2, and Lambda services.

See [OpenTelemetry and Other Platforms](../../monitoring-tools/opentelemetry-platforms.md) for instrumentation details.

## CloudTrail: Who Did What

CloudTrail records API calls across your accounts: who, what, when, from where, and whether it succeeded.

- **Event history** shows the last 90 days of management events for free, per region.
- Create an **organization trail** that delivers all accounts' events to a central, locked-down S3 bucket in the log-archive account, with log file validation.
- **Data events** (S3 object reads and writes, Lambda invocations) are off by default and can be high volume — enable them selectively.

```bash
# Who deleted this security group rule?
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=RevokeSecurityGroupIngress \
  --start-time 2026-09-14T00:00:00Z \
  --query 'Events[].[EventTime, Username, CloudTrailEvent]' --output text | head
```

For repeated investigations, query CloudTrail with **CloudTrail Lake** or Athena using SQL.

## EventBridge: React to Events

EventBridge routes events from AWS services, your applications, and SaaS partners to targets such as Lambda, SQS, Step Functions, and SNS.

```json title="Rule pattern: notify when anyone disables a CloudTrail trail"
{
  "source": ["aws.cloudtrail"],
  "detail-type": ["AWS API Call via CloudTrail"],
  "detail": {
    "eventSource": ["cloudtrail.amazonaws.com"],
    "eventName": ["StopLogging", "DeleteTrail", "UpdateTrail"]
  }
}
```

Other useful rules: ECS task stopped unexpectedly, EC2 Spot interruption warning, GuardDuty finding of high severity, and AWS Health events for scheduled maintenance affecting your resources. **EventBridge Scheduler** replaces cron jobs on servers for invoking AWS targets on a schedule.

## AWS Config: What Does It Look Like Now?

AWS Config records the **configuration history** of resources and evaluates them against **rules**.

- "What did this security group look like last Tuesday, and what changed?"
- Managed rules detect drift from policy: unencrypted EBS volumes, S3 buckets without Block Public Access, security groups open to `0.0.0.0/0` on SSH, root user without MFA.
- **Conformance packs** deploy sets of rules mapped to frameworks such as CIS AWS Foundations.
- **Remediation actions** can fix some findings automatically through SSM Automation.

Aggregate Config data across the organization into the security account.

## Common Mistakes

- Log groups with no retention setting, silently growing storage costs forever.
- Alarms on averages and raw counts instead of percentiles and error rates.
- Alarms without runbook links, sent to an email list nobody reads.
- Relying on CloudTrail event history instead of an organization trail stored in a separate account.
- Enabling S3 data events for every bucket and paying for billions of events.
- Wide, unfiltered Logs Insights queries over months of data during an incident.
- Monitoring every AWS service except the ones that signal backlog, such as SQS message age.

## Interview Questions

- What alarms would you create for a service behind an ALB with an RDS database?
- How would you find the top error messages for a service in the last hour using CloudWatch?
- Someone deleted a production security group rule. How do you find out who and when?
- What's the difference between CloudTrail and AWS Config?
- How would you get notified automatically when CloudTrail logging is disabled in any account?

## Next

Continue to [Security and Secrets](10-security-and-secrets.md).
