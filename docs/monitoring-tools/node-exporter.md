---
description: Learn Node Exporter installation, Prometheus scrape configuration, core host metrics, PromQL examples, and safe alerting practices.
---

# Node Exporter Guide: Host Metrics for Prometheus

Node Exporter exposes Linux host metrics in Prometheus format. It answers questions about CPU, memory, disks, filesystems, network interfaces, and the operating system; it does not replace application instrumentation or container-level metrics from cAdvisor.

## Start Node Exporter in Docker

```yaml
node-exporter:
  image: prom/node-exporter:latest
  command:
    - --path.rootfs=/host
  pid: host
  volumes:
    - /:/host:ro,rslave
```

For a direct Linux installation, run the released binary as a dedicated non-login user and expose port `9100` only to Prometheus or a protected monitoring network.

## Add the Prometheus Job

```yaml
scrape_configs:
  - job_name: node
    static_configs:
      - targets: ["node-exporter:9100"]
```

After reloading Prometheus, open **Status → Targets** and confirm the target is `UP`. A target being reachable does not mean the host is healthy; it only proves Prometheus can scrape it.

## Core Queries

```promql
# CPU busy percentage, averaged across CPU cores
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory available percentage
100 * node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes

# Filesystem free percentage, excluding virtual filesystems
100 * node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"}
  / node_filesystem_size_bytes{fstype!~"tmpfs|overlay"}

# Network receive rate in bytes per second
sum by (instance) (rate(node_network_receive_bytes_total{device!="lo"}[5m]))
```

## Practical Alerts

Start with these conditions, tune them to the workload, and include `instance`, `mountpoint`, and an owner in the alert labels or annotations.

- Host down: `up{job="node"} == 0` for 5 minutes.
- Disk nearly full: free space below 10% and predicted to fill soon.
- High CPU: sustained busy CPU, not a momentary burst.
- Memory pressure: low available memory combined with swapping or OOM events.

## Common Pitfalls

- Do not alert on every mount; exclude temporary and container filesystems.
- Account for ephemeral nodes and autoscaling when defining `instance`-based alerts.
- Do not expose the exporter openly on the internet.
- Use cAdvisor or Kubernetes metrics for container and pod detail; Node Exporter only sees the host view.

## Quick Check

```bash
curl http://localhost:9100/metrics | head
curl 'http://localhost:9090/api/v1/query?query=up%7Bjob%3D%22node%22%7D'
```

## Related Learning

- [Prometheus guide](prometheus.md)
- [Grafana guide](grafana.md)
- [Monitoring troubleshooting](troubleshooting.md)
