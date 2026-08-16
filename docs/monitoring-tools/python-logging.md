---
description: Implement practical Python logging with levels, structured JSON, handlers, exception logging, correlation IDs, and safe production defaults.
---

# Python Logging in Practice

Python's built-in `logging` module is enough for many production services when it is configured deliberately. The goals are consistent levels, machine-readable fields, one log record per event, and useful correlation with metrics and traces.

## Levels and When to Use Them

| Level | Use it for |
| --- | --- |
| `DEBUG` | Diagnostic detail, normally disabled in production |
| `INFO` | Normal lifecycle and important successful operations |
| `WARNING` | Unexpected condition that the service recovered from |
| `ERROR` | A request or operation failed and needs investigation |
| `CRITICAL` | The process cannot safely continue or immediate action is required |

Avoid logging the same failure at every layer. Log an exception with stack trace at the boundary that handles it, then attach context such as operation name or request ID.

## Production-Friendly Configuration

This example writes JSON to standard output. Containers should normally log to stdout/stderr, leaving collection to Docker, Kubernetes, Promtail, Fluent Bit, or an OpenTelemetry Collector.

```python
import json
import logging
import os
import sys
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    def format(self, record):
        event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "service": os.getenv("SERVICE_NAME", "orders-api"),
            "environment": os.getenv("ENVIRONMENT", "development"),
        }
        for name in ("request_id", "trace_id", "user_id"):
            value = getattr(record, name, None)
            if value:
                event[name] = value
        if record.exc_info:
            event["exception"] = self.formatException(record.exc_info)
        return json.dumps(event)


handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JsonFormatter())
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), handlers=[handler])
logger = logging.getLogger("orders")

logger.info("order accepted", extra={"request_id": "req-8f52"})
try:
    raise RuntimeError("payment provider timed out")
except RuntimeError:
    logger.exception("payment authorization failed", extra={"request_id": "req-8f52"})
```

## Request and Trace Correlation

Generate or accept a request ID at the HTTP edge, then add it to every log record for that request. If the service uses OpenTelemetry, include the current trace ID as well. Do not use a global variable for this in concurrent applications; use `contextvars` or framework middleware so values remain isolated per request.

```python
from contextvars import ContextVar

request_id = ContextVar("request_id", default="-")

class RequestContextFilter(logging.Filter):
    def filter(self, record):
        record.request_id = request_id.get()
        return True
```

Attach this filter to the handler, set `request_id` in middleware, and reset the context in a `finally` block. This lets Grafana/Loki queries move directly from a request ID to all related records.

## Logging, Metrics, and Traces Are Different

Do not try to use logs as a substitute for every metric. Increment a Prometheus counter for stable operational counts, use a histogram for request duration, and log the detail when an operation is unusual or fails. Traces then connect the operation across service boundaries.

## Safe Defaults Checklist

- Use UTC timestamps and structured logs.
- Keep log messages stable; put variable values in fields.
- Redact secrets, authorization headers, session tokens, and personal data.
- Rotate files only if the process must log to disk; prefer stdout in containers.
- Sample verbose success logs under high traffic, but preserve errors.
- Test a failure path and verify the records are searchable in Loki.

## Loki Queries to Try

```logql
{service="orders-api", environment="production"} |= "payment authorization failed"

{service="orders-api"} | json | request_id="req-8f52"
```

## Related Learning

- [Loki and Promtail logging](logging.md)
- [Observability fundamentals](observability-fundamentals.md)
- [OpenTelemetry and platforms](opentelemetry-platforms.md)
