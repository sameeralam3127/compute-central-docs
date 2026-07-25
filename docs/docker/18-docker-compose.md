---
description: Learn Docker Compose services, networks, volumes, environment, healthchecks, restart policies, and troubleshooting.
---

# Docker Compose

Compose describes a local multi-service application as configuration: services, networks, volumes, environment, ports, health checks, dependencies, and restart behavior. It replaces brittle sequences of manual `docker run` commands.

Use `docker compose up`, `down`, `ps`, `logs`, `exec`, `build`, and `pull` as lifecycle commands. `depends_on` controls startup ordering, not application readiness; use health checks and retry logic where one service truly requires another to be ready.

## Small local stack

```yaml
services:
  api:
    build: .
    ports: ["8000:8000"]
    depends_on:
      db:
        condition: service_healthy
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: change-me
    volumes: ["db-data:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
volumes:
  db-data:
```

Start it with `docker compose up --build`, inspect it with `docker compose ps`, and clean it up with `docker compose down`.
