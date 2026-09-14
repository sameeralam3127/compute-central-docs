---
title: "Dockerfiles: Caching, Multi-Stage Builds, and Secure Images"
icon: lucide/file-code
description: "Write better Dockerfiles — build context, layer caching, multi-stage builds, BuildKit secret mounts, non-root users, signals, and health checks."
tags:
  - Docker
  - Dockerfile
  - Docker Workflows
---

# Dockerfiles

## What You'll Learn

- What each instruction does, and which ones create layers
- How build context and caching work, and how to order a Dockerfile for fast rebuilds
- Multi-stage builds that ship only what runs
- BuildKit cache mounts and build secrets
- `CMD` vs. `ENTRYPOINT`, signals and PID 1, non-root users, and health checks
- Multi-platform builds and linting

## Instructions at a Glance

| Instruction | Purpose | Creates a filesystem layer |
| --- | --- | --- |
| `FROM` | Base image, starts a build stage | — |
| `RUN` | Run a command at build time | Yes |
| `COPY` | Copy files from the build context or another stage | Yes |
| `ADD` | Like `COPY`, plus URL download and archive extraction | Yes |
| `WORKDIR` | Set (and create) the working directory | Yes, if created |
| `ENV` | Environment variable for build and runtime | No |
| `ARG` | Build-time variable, not present at runtime | No |
| `USER` | User for later instructions and the container process | No |
| `EXPOSE` | Document a listening port (doesn't publish it) | No |
| `CMD` | Default command or arguments | No |
| `ENTRYPOINT` | Fixed executable | No |
| `HEALTHCHECK` | How Docker checks the container is healthy | No |
| `LABEL` | Metadata such as source and version | No |

Prefer `COPY` over `ADD` unless you need `ADD`'s extra behavior — implicit extraction and downloads make builds harder to reason about.

## Build Context and .dockerignore

`docker build .` sends the **context** (the `.` directory) to the builder. `COPY` can only read from it.

```text title=".dockerignore"
.git
.venv
node_modules
__pycache__
*.log
.env
dist/
coverage/
Dockerfile*
compose*.yaml
```

A missing `.dockerignore` makes builds slow, busts the cache whenever any file changes, and can copy `.env` or `.git` into images.

## Caching: Order Matters

Docker reuses a layer when the instruction and its inputs haven't changed. Once one layer changes, **every layer after it** is rebuilt.

```dockerfile
# Slow: any code change reinstalls every dependency
COPY . .
RUN pip install -r requirements.txt
```

```dockerfile
# Fast: dependencies are reinstalled only when requirements.txt changes
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
```

Rule of thumb: copy what changes **least** first.

## A Production-Ready Python Image

```dockerfile title="Dockerfile"
# syntax=docker/dockerfile:1

FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app

FROM base AS deps
RUN --mount=type=cache,target=/root/.cache/pip \
    --mount=type=bind,source=requirements.txt,target=requirements.txt \
    pip install --prefix=/install -r requirements.txt

FROM base AS runtime
RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid app --no-create-home app
COPY --from=deps /install /usr/local
COPY --chown=app:app app/ ./app/
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=2)"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t orders-api:1.4.0 .
docker run -d --name orders -p 8000:8000 orders-api:1.4.0
docker inspect -f '{{.State.Health.Status}}' orders        # starting → healthy
```

What each choice buys you:

- `# syntax=docker/dockerfile:1` enables current BuildKit Dockerfile features.
- `--mount=type=cache` keeps pip's download cache **between builds** without putting it in the image.
- `--mount=type=bind` reads `requirements.txt` without creating a `COPY` layer.
- A **numeric** `USER` works even with orchestrators that verify the user isn't root.
- `HEALTHCHECK` lets Docker and Compose know the app is actually serving, not just running.

## Multi-Stage Builds

Build tools belong in a build stage; only the result ships. A Go service:

```dockerfile title="Dockerfile"
# syntax=docker/dockerfile:1
FROM golang:1.25 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/server /server
USER nonroot:nonroot
ENTRYPOINT ["/server"]
```

The final image contains one static binary and minimal OS files: no shell, no package manager, no compiler — a few megabytes instead of hundreds, and far less to patch. Build just one stage with `docker build --target build .` when debugging.

## Build Secrets

Never pass credentials with `ARG` or `ENV` — they're recorded in the image history.

```dockerfile
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci --omit=dev
```

```bash
docker build --secret id=npmrc,src="$HOME/.npmrc" -t web:2.0 .
```

The secret is available to that one `RUN` step and never written to a layer.

## CMD, ENTRYPOINT, and the Exec Form

```dockerfile
ENTRYPOINT ["python", "-m", "orders.cli"]
CMD ["--help"]
```

| You run | Executed |
|---|---|
| `docker run orders` | `python -m orders.cli --help` |
| `docker run orders migrate --to 42` | `python -m orders.cli migrate --to 42` |

`CMD` supplies replaceable defaults; `ENTRYPOINT` fixes the executable.

Always use the **exec form** (JSON array). The shell form (`CMD uvicorn app:app`) runs `/bin/sh -c`, so the shell is PID 1, doesn't forward `SIGTERM`, and `docker stop` waits 10 seconds and then kills your app ungracefully.

## PID 1 and Signals

The main process is PID 1 in its namespace. PID 1 doesn't get default signal handling and must reap orphaned child processes. If your app spawns children or doesn't handle `SIGTERM`, add a tiny init:

```bash
docker run --init myapp:1.0          # Docker injects tini as PID 1
```

Or install `tini` in the image and use `ENTRYPOINT ["tini", "--", "myapp"]`.

## ARG vs. ENV

```dockerfile
ARG APP_VERSION=dev                 # build time only
ENV APP_VERSION=${APP_VERSION}      # copy into runtime if the app needs it
LABEL org.opencontainers.image.version=${APP_VERSION}
```

```bash
docker build --build-arg APP_VERSION=1.4.0 -t orders-api:1.4.0 .
```

## Pinning the Base Image

```dockerfile
FROM python:3.12-slim@sha256:<digest>
```

A digest makes builds reproducible. Pair it with automated update pull requests (Renovate or Dependabot), so pins don't silently go stale and miss security fixes.

## Multi-Platform Builds

```bash
docker buildx create --name multi --use
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t registry.example.com/team/orders-api:1.4.0 \
  --push .
```

Multi-platform images are pushed as an index, so each server pulls its own architecture. See [Container Images](16-container-images.md#multi-architecture-images).

## Linting the Dockerfile

```bash
docker build --check .               # BuildKit's built-in build checks
docker run --rm -i hadolint/hadolint < Dockerfile
```

## Common Mistakes

- `COPY . .` before installing dependencies, rebuilding everything on every code change.
- No `.dockerignore`, shipping `.git`, `.env`, or `node_modules` into the image.
- Shell-form `CMD`, so the app never receives `SIGTERM`.
- Running as root because nothing set `USER`.
- Passing tokens via `ARG`, where `docker history` reveals them.
- Installing and cleaning package caches in separate `RUN` steps, so the cache stays in an earlier layer.
- `apt-get update` in one `RUN` and `apt-get install` in another, reusing a stale cached package index.

## Check Your Understanding

1. Why does copying `requirements.txt` before the source code speed up rebuilds?
2. What does a multi-stage build remove from the final image?
3. Why is `CMD ["uvicorn", ...]` better than `CMD uvicorn ...`?
4. How do you give a build step a credential without leaving it in the image?

## Next

Continue to [Docker Compose](18-docker-compose.md).
