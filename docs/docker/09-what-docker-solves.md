---
title: "What Docker Actually Solves (and What It Doesn't)"
icon: lucide/puzzle
description: Map every Docker workflow to the Linux container concepts it automates, compare a manual deployment with a Docker one, and learn the problems Docker leaves to you.
tags:
  - Docker
  - Docker Workflows
---

# What Docker Actually Solves

## What You'll Learn

- The concrete problems Docker automates, mapped to the kernel features from Part II
- The same deployment done by hand and with Docker, side by side
- What Docker deliberately **doesn't** solve, so you don't expect it to

## Why This Chapter Exists

Part II showed that containers are namespaces, cgroups, and a root filesystem. You could build all of it yourself — the lab took dozens of commands, and it still lacked image distribution, security defaults, logging, and cleanup. Docker's contribution is packaging all of that into a consistent workflow a team can share.

## From Kernel Features to Commands

| Docker action | Underlying idea | Chapter |
| --- | --- | --- |
| `docker build` | Repeatable construction of image layers and config | [Dockerfiles](17-dockerfiles.md) |
| `docker push` / `docker pull` | OCI Distribution API: content-addressed layers | [Registries](19-registries-and-publishing.md) |
| `docker run` | Snapshot + namespaces + cgroups + network + process, via containerd and runc | [Architecture](08-runc-containerd-and-docker.md) |
| `-p 8080:80` | veth + bridge + NAT and port-forwarding rules | [Docker Networking](13-docker-networking.md) |
| `-v data:/var/lib/app` | Mount namespace + managed storage outside the writable layer | [Storage](15-storage.md) |
| `--memory`, `--cpus` | cgroup limits | [cgroups](05-cgroups.md) |
| `docker ps`, `docker stop` | Lifecycle tracking and signal delivery to PID 1 | [Essential Commands](11-essential-docker-commands.md) |
| `docker exec` | A new process joined to the container's existing namespaces | [Linux Namespaces](04-linux-namespaces.md) |
| `docker logs` | Captured stdout/stderr from the shim | [Essential Commands](11-essential-docker-commands.md) |
| `docker compose up` | Several containers, networks, and volumes described declaratively | [Docker Compose](18-docker-compose.md) |

## The Same Deployment, Two Ways

Goal: run a small Python API that needs Python 3.12, two libraries, and port 8000, on a server that already runs another app needing Python 3.10.

### Without containers

```bash
# On every server, in every environment, kept in sync by hand or by config management
sudo apt-get install -y python3.12 python3.12-venv
sudo useradd --system orders
sudo mkdir -p /opt/orders && sudo chown orders: /opt/orders
sudo -u orders python3.12 -m venv /opt/orders/venv
sudo -u orders /opt/orders/venv/bin/pip install fastapi==0.115.0 uvicorn==0.30.6
sudo cp -r ./app /opt/orders/
sudo cp orders.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now orders
```

Every step touches the shared host. Upgrading Python means testing against the other app too. A second server built next month may get different patch versions.

### With Docker

```dockerfile title="Dockerfile"
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
USER 10001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t registry.example.com/orders:1.4.0 .
docker push registry.example.com/orders:1.4.0

# On any Docker host
docker run -d --name orders --restart unless-stopped -p 8000:8000 registry.example.com/orders:1.4.0
```

The runtime, libraries, and code travel together in an immutable image. The host only needs Docker. The other app's Python 3.10 is untouched, because each container has its own userspace.

## What Docker Solves

- **Dependency conflicts** — each container has its own userspace libraries and runtimes.
- **Environment drift** — the same image digest runs in development, CI, and production.
- **Distribution** — registries move exactly the same bits everywhere, verified by digest.
- **Fast, cheap isolation** — no guest kernel to boot; a container starts in milliseconds to seconds.
- **Consistent operations** — one way to start, stop, inspect, log, and limit any application.
- **Reproducible builds** — the Dockerfile is reviewed and versioned like code.

## What Docker Doesn't Solve

| Still your problem | Why | Where to go next |
|---|---|---|
| **Persistent state** | Removing a container deletes its writable layer; databases need volumes, backups, and tested restores | [Storage](15-storage.md) |
| **Secrets** | Environment variables and image layers are easy to leak | [Dockerfiles](17-dockerfiles.md), [Kubernetes Secrets](../kubernetes/configuration-and-packaging/02-secrets-in-depth.md) |
| **Network design** | Publishing a port isn't TLS, authentication, or firewall policy | [Caddy Web App Lab](14-caddy-web-app-lab.md) |
| **Kernel-level security** | Containers share the host kernel; a kernel exploit affects all of them | [Production Troubleshooting](24-production-troubleshooting.md) |
| **Scheduling across many hosts** | Docker runs containers on one host; placement, failover, and scaling across a fleet need an orchestrator | [Kubernetes](../kubernetes/index.md) |
| **Application design** | A badly designed app in a container is still badly designed | [Monoliths and Microservices](23-monoliths-and-microservices.md) |
| **Observability** | `docker logs` isn't centralized logging, metrics, or tracing | [Monitoring](../monitoring-tools/index.md) |

## Common Mistakes

- Treating containers as lightweight VMs and running SSH, cron, and several services inside one.
- Assuming "it's in a container" means secure.
- Storing the only copy of a database in a container's writable layer.
- Rebuilding images per environment instead of promoting one image and changing configuration.

## Check Your Understanding

1. Which kernel features does `docker run --memory 256m -p 8080:80 nginx` rely on?
2. Why does the Docker version of the deployment avoid the Python 3.10 conflict?
3. Name three problems you still have to solve after containerizing an application.

## Next

Continue to [Installation and the Docker Engine](10-installation-and-engine.md) to set up the environment for the rest of the course.
