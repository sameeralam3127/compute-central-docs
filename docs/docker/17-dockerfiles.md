---
description: Learn Dockerfile instructions, build context, caching, .dockerignore, multi-stage builds, non-root users, and reproducible images.
---

# Dockerfiles

| Instruction | Purpose |
| --- | --- |
| `FROM` | base image |
| `RUN` | build-time command |
| `COPY` | copy build-context files |
| `WORKDIR`, `ENV`, `ARG` | runtime/build settings |
| `USER` | non-root process identity |
| `CMD`, `ENTRYPOINT` | default executable and arguments |
| `EXPOSE`, `LABEL`, `HEALTHCHECK` | metadata and health behavior |

Prefer `COPY` over `ADD` unless its extra behavior is required. `CMD` provides replaceable defaults; `ENTRYPOINT` fixes the executable role. Keep the build context small with `.dockerignore`, copy dependency manifests before application source to preserve cache usefulness, use multi-stage builds when a compiler is not needed at runtime, pin meaningful base versions, and run as a non-root user when possible.

## Minimal Python example

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN useradd --system appuser
USER appuser
CMD ["python", "app.py"]
```

Build and run it with `docker build -t example-api:1.0 .` and `docker run --rm example-api:1.0`.
