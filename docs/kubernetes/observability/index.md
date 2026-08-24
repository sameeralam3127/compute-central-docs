---
title: "Kubernetes Observability: Probes, Logs, Metrics, and Debugging"
icon: lucide/activity
description: Start here for Kubernetes observability — health probes, container logging architecture, metrics-server, and a repeatable debugging methodology.
tags:
  - Kubernetes
  - Observability & Health
---

# Observability & Health

A cluster you can't see into is a cluster you can only guess about. This section covers the layers Kubernetes gives you out of the box — health probes that decide whether a container is alive and ready, the logging and metrics pipelines built into every cluster, and the `kubectl` workflow for turning "something's wrong" into "here's exactly what's wrong" — before you ever reach for a dedicated monitoring stack.

## Read in this order

1. [Probes: Liveness, Readiness, and Startup](01-probes-liveness-readiness-startup.md) — what each probe type actually controls, and the misconfiguration that causes restart-loop death spirals
2. [Logging](02-logging.md) — how container output becomes something `kubectl logs` can show you, node-level rotation, and cluster-wide logging patterns
3. [Metrics and Metrics Server](03-metrics-and-metrics-server.md) — installing metrics-server, `kubectl top`, and what the Resource Metrics API can and can't feed into autoscaling
4. [Events and Debugging](04-events-and-debugging.md) — a repeatable methodology for going from a broken pod to a root cause, using tools built into every cluster

!!! tip "Build the habit before you need it"
    The debugging methodology in the last page of this section — status, describe, events, logs, exec, in that order — is worth memorizing before you're paged at 2am. [Troubleshooting](../troubleshooting/index.md) applies exactly this sequence to specific failure symptoms.

## Next

With health, logs, and metrics covered, continue to [Cluster Administration](../cluster-administration/index.md) to see how these signals feed into running the cluster itself.
