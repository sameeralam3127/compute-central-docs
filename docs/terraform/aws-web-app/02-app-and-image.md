---
title: "Containerize a Python Web App and Push It to Amazon ECR"
icon: lucide/container
description: "Step 2 of the Terraform AWS project: a small Flask and PostgreSQL web app, a non-root Dockerfile, local testing with Docker Compose, and pushing an ARM64 image to Amazon ECR."
tags:
  - Terraform
  - AWS
  - Docker
  - Lab
---

# Step 2: The App and Its Image

## What You'll Learn

- What a web app needs to run well behind a load balancer: a cheap health check and configuration from the environment
- How to test the app and its database locally before touching AWS
- How to build an image for the CPU architecture you'll run on
- How to push an image to ECR with a tag you can trace back to a commit

## The Application

The app is a page counter: each request to `/` inserts a row into PostgreSQL and shows the total, plus the ID of the container that served it. That last part lets you watch the load balancer spread requests across tasks on page 5.

```bash
mkdir -p webapp/app && cd webapp/app
```

```python title="app/app.py"
"""A small web app for the Terraform AWS project: a page counter backed by PostgreSQL."""

import os
import socket

import psycopg
from flask import Flask

app = Flask(__name__)
VERSION = os.environ.get("APP_VERSION", "dev")


def connect():
    return psycopg.connect(
        host=os.environ["DB_HOST"],
        port=os.environ.get("DB_PORT", "5432"),
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        sslmode="require",  # RDS for PostgreSQL rejects unencrypted connections by default
        connect_timeout=3,
    )


@app.get("/healthz")
def healthz():
    # The load balancer calls this every few seconds. Keep it cheap and independent of the
    # database, so a database blip doesn't make every task look dead at once.
    return {"status": "ok", "version": VERSION}


@app.get("/")
def index():
    try:
        with connect() as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS visits (id bigserial PRIMARY KEY, at timestamptz DEFAULT now())")
            conn.execute("INSERT INTO visits DEFAULT VALUES")
            count = conn.execute("SELECT count(*) FROM visits").fetchone()[0]
    except (psycopg.Error, KeyError) as exc:
        app.logger.error("database error: %s", exc)
        return "<h1>Database unavailable</h1><p>Check the task logs in CloudWatch.</p>", 503
    return (
        "<h1>Hello from Terraform on AWS</h1>"
        f"<p>Visits: <strong>{count}</strong></p>"
        f"<p>Served by task <code>{socket.gethostname()}</code>, version <code>{VERSION}</code></p>"
    )
```

```text title="app/requirements.txt"
flask==3.1.3
gunicorn==26.2.0
psycopg[binary]==3.3.6
```

Three choices here make the infrastructure simpler later:

- **All configuration comes from environment variables.** The same image runs on your laptop, in dev, and in production. ECS fills in the variables on page 5.
- **`/healthz` doesn't touch the database.** The load balancer calls it every 15 seconds on every task. If it checked the database, a short database outage would mark *every* task unhealthy, and ECS would start replacing all of them at once.
- **`sslmode="require"`.** RDS for PostgreSQL 15 and later refuses unencrypted connections by default. For full protection against a spoofed server, use `sslmode="verify-full"` with the [RDS certificate bundle](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html).

## The Dockerfile

```dockerfile title="app/Dockerfile"
FROM python:3.13-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .

# Run as an unprivileged user
RUN useradd --system --uid 10001 app
USER 10001

EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--access-logfile", "-", "app:app"]
```

- **`python:3.13-slim`** keeps the image small. Pin a digest in production so rebuilds are reproducible.
- **`USER 10001`** runs the app without root. If someone finds a bug in the app, they get an unprivileged user, not root in the container.
- **Gunicorn** is the production web server. Flask's built-in server is for development only.

## Step 1: Run It Locally

Test the app with a real PostgreSQL before deploying anything. This Compose file starts both, with SSL turned on in PostgreSQL so `sslmode=require` behaves the way it will on RDS:

```yaml title="app/compose.yaml"
# Run the app and a PostgreSQL database on your laptop before deploying anything.
#   docker compose up --build
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: app_admin
      POSTGRES_PASSWORD: local-only-password
    command: ["-c", "ssl=on",
              "-c", "ssl_cert_file=/etc/ssl/certs/ssl-cert-snakeoil.pem",
              "-c", "ssl_key_file=/etc/ssl/private/ssl-cert-snakeoil.key"]
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "app_admin", "-d", "app"]
      interval: 2s
      retries: 15

  web:
    build: .
    ports:
      - "127.0.0.1:8000:8000"
    environment:
      DB_HOST: db
      DB_NAME: app
      DB_USER: app_admin
      DB_PASSWORD: local-only-password
      APP_VERSION: local
    depends_on:
      db:
        condition: service_healthy
```

```bash
docker compose up --build -d
curl -s localhost:8000/healthz
curl -s localhost:8000/
curl -s localhost:8000/
```

```text
{"status":"ok","version":"local"}
<h1>Hello from Terraform on AWS</h1><p>Visits: <strong>1</strong></p><p>Served by task <code>bb7191a610c0</code>, version <code>local</code></p>
<h1>Hello from Terraform on AWS</h1><p>Visits: <strong>2</strong></p><p>Served by task <code>bb7191a610c0</code>, version <code>local</code></p>
```

Now break the database and watch what happens:

```bash
docker compose stop db
curl -s -o /dev/null -w '%{http_code}\n' localhost:8000/          # 503
curl -s -o /dev/null -w '%{http_code}\n' localhost:8000/healthz   # 200
docker compose down -v
```

The page fails cleanly with a 503, and the health check keeps passing. That's the behaviour you want behind a load balancer.

## Step 2: Build and Push to ECR

Log Docker in to your registry. Use the `ecr_repository_url` output from step 1:

```bash
export REPO=123456789012.dkr.ecr.us-east-1.amazonaws.com/webapp
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin "${REPO%%/*}"
```

Put the project under Git at the `webapp/` root, so every image can be tagged with the commit it came from. Add a `.gitignore` first, so provider downloads and state files never get committed:

```text title=".gitignore"
# Terraform: provider downloads and any local state. Commit .terraform.lock.hcl.
.terraform/
*.tfstate
*.tfstate.*
*.tfplan

# Python
__pycache__/
.venv/
```

```bash
cd ..                                  # webapp/
git init -q && git add -A && git commit -qm "App and bootstrap stack"
cd app
export TAG=$(git rev-parse HEAD)       # the full commit SHA, as CI will use
```

Build for ARM64 and push:

```bash
docker buildx build --platform linux/arm64 -t "$REPO:$TAG" --push .
```

```bash
aws ecr describe-images --repository-name webapp \
  --query 'imageDetails[].{tag:imageTags[0],pushed:imagePushedAt,MB:imageSizeInBytes}' --output table
```

Keep `$TAG`: the next pages deploy it.

!!! warning "Match the image to the task's CPU"
    The ECS task definition on page 5 runs on `ARM64`. On an Apple silicon Mac, a plain `docker build` already produces ARM64. On an Intel machine, `--platform linux/arm64` builds through emulation, which is slower but works. An architecture mismatch shows up later as tasks that stop immediately with `exec format error` in their logs.

## What Most Engineers Miss

- **The health check endpoint is part of your availability design.** What it checks decides what the load balancer does during a partial outage. Liveness checks should be cheap and local.
- **Image tags are your deploy history.** A commit SHA tag answers "what's running?" with one lookup. `latest` answers nothing.
- **Build once, promote the same image.** Dev, staging, and production should run the same image digest, with different configuration. Never rebuild for production.
- **Scan on push catches known vulnerabilities in the base image**, not in your code. Look at the findings: `aws ecr describe-image-scan-findings --repository-name webapp --image-id imageTag=$TAG`.

!!! quiz "Health checks"
    The `/healthz` endpoint runs `SELECT 1` against the database. The database fails over and is unreachable for 40 seconds. What happens?

    - [ ] Nothing, health checks ignore short outages
    - [x] Every task fails its health check, and ECS replaces all of them at once
    - [ ] Only the tasks that were connected to the database are replaced

    A dependency in a liveness check turns a short dependency outage into a full restart of your service.

## Common Mistakes

- Testing the image for the first time in AWS, where every failed attempt costs a deploy cycle.
- Building on an Intel laptop or CI runner and deploying to ARM64 tasks without `--platform`.
- Running containers as root because the base image does.
- Baking configuration such as database hosts into the image.
- Using Flask's development server in production.

## Interview Questions

- What should a load balancer health check verify, and what shouldn't it?
- How do you make sure the image running in production is the one you tested?
- Why might you choose ARM64 for containers on AWS, and what changes in your build?
- How would you give a container its database password?

## Next

Continue to [Step 3: Network and Security Groups](03-network-and-security.md).
