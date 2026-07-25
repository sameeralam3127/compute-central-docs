---
description: Learn Docker Compose services, networks, volumes, environment, healthchecks, restart policies, and troubleshooting.
---

# 18. Docker Compose

Compose describes a local multi-service application as configuration: services, networks, volumes, environment, ports, health checks, dependencies, and restart behavior. It replaces brittle sequences of manual `docker run` commands.

Use `docker compose up`, `down`, `ps`, `logs`, `exec`, `build`, and `pull` as lifecycle commands. `depends_on` controls startup ordering, not application readiness; use health checks and retry logic where one service truly requires another to be ready.
