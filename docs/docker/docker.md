---
description: Learn Docker containers from installation and core commands to Dockerfiles, volumes, networking, Compose, registries, best practices, and troubleshooting.
---

# Docker Container Guide: From Basics to Advanced

!!! note "Looking for the beginner course?"
    Start with [Docker and Linux Containers: From First Principles](index.md). This page remains a practical Docker overview and reference for readers who already understand the foundations.

Docker helps you package applications and their dependencies into portable units called containers. Those containers run the same way across laptops, test servers, and production systems, which reduces "it works on my machine" problems and makes delivery more predictable.

!!! info "What Docker gives you"
    - Consistent runtime environments across development, testing, and production
    - Faster startup and lower overhead than traditional virtual machines
    - Repeatable builds through `Dockerfile`
    - Easy multi-service orchestration with `docker compose`
    - Better isolation for apps, tools, and dependencies

---

## Core Concepts

Before jumping into commands, it helps to separate a few Docker terms:

- **Image**: A read-only packaged blueprint for an application
- **Container**: A running instance of an image
- **Dockerfile**: A text file that defines how an image is built
- **Volume**: Persistent storage managed by Docker
- **Network**: A communication layer for containers
- **Registry**: A place to store and distribute images, such as Docker Hub

!!! tip "Container vs virtual machine"
    A container shares the host operating system kernel, while a virtual machine includes a full guest OS. That is why containers are usually lighter and faster to start.

---

## Installation

### Linux

On Ubuntu or Debian-based systems, install Docker Engine with:

```bash
sudo apt update
sudo apt install ca-certificates curl gnupg -y
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y
```

Verify the installation:

```bash
docker --version
docker compose version
```

### macOS

Install Docker Desktop from [Docker's official website](https://www.docker.com/products/docker-desktop/), move it to `Applications`, and complete the first-run setup.

### Windows

Install Docker Desktop from [Docker's official website](https://www.docker.com/products/docker-desktop/). On Windows, Docker Desktop typically uses WSL 2 for Linux containers, so make sure WSL is enabled if prompted during setup.

!!! note "Docker Desktop vs Docker Engine"
    - **Docker Desktop** is commonly used on macOS and Windows and includes a GUI, Compose, and local Kubernetes support.
    - **Docker Engine** is the lightweight server-side runtime commonly used on Linux.

### Enable non-root Docker access on Linux

If you want to run Docker without `sudo`:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

Test with:

```bash
docker run hello-world
```

---

## Common Docker Commands

These are the commands you will use most often:

### Inspect Docker

```bash
docker --version
docker info
docker help
```

### Work with images

```bash
docker images
docker pull nginx:latest
docker build -t myapp:1.0 .
docker rmi myapp:1.0
```

### Work with containers

```bash
docker ps
docker ps -a
docker run nginx
docker run -d -p 8080:80 --name web nginx
docker stop web
docker start web
docker restart web
docker rm web
```

### Inspect logs and processes

```bash
docker logs web
docker logs -f web
docker exec -it web /bin/sh
docker top web
docker inspect web
```

!!! tip "Interactive debugging"
    Use `docker exec -it <container> /bin/sh` or `/bin/bash` to inspect a running container. Minimal images often include `/bin/sh` but not `/bin/bash`.

---

## Understanding `docker run`

The `docker run` command creates and starts a container.

```bash
docker run [OPTIONS] IMAGE [COMMAND] [ARG...]
```

Example:

```bash
docker run -d --name mynginx -p 8080:80 nginx:latest
```

What this does:

- `-d` runs the container in detached mode
- `--name mynginx` assigns a friendly container name
- `-p 8080:80` maps host port `8080` to container port `80`
- `nginx:latest` is the image to start

Other useful flags:

- `-e KEY=value` to pass environment variables
- `-v host_path:container_path` to mount storage
- `--rm` to remove the container automatically after it exits
- `--network` to attach the container to a custom network

---

## Building Images with a Dockerfile

A `Dockerfile` defines how Docker should build your image.

Example:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["python", "app.py"]
```

Build the image:

```bash
docker build -t flask-demo:1.0 .
```

Run it:

```bash
docker run -d -p 5000:5000 --name flask-demo flask-demo:1.0
```

### Important Dockerfile instructions

- `FROM` sets the base image
- `WORKDIR` sets the working directory inside the container
- `COPY` copies files into the image
- `RUN` executes commands during build
- `ENV` defines environment variables
- `EXPOSE` documents the port the app listens on
- `CMD` sets the default runtime command

!!! warning "Keep images small"
    Use slim base images when practical, combine related steps, and avoid copying unnecessary files into the image.

### Add a `.dockerignore`

Just like `.gitignore`, a `.dockerignore` file prevents unwanted files from being sent into the build context.

Example:

```text
.git
node_modules
venv
__pycache__
*.log
```

This keeps builds faster and images cleaner.

---

## Volumes and Persistent Data

Containers are ephemeral by design. If a container is removed, its internal writable layer is lost unless data is stored externally.

Create a managed volume:

```bash
docker volume create postgres_data
```

Use it with a container:

```bash
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=secret \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:16
```

List volumes:

```bash
docker volume ls
```

Inspect a volume:

```bash
docker volume inspect postgres_data
```

---

## Docker Networking

Docker can attach containers to networks so they can communicate securely and predictably.

Create a custom network:

```bash
docker network create app-network
```

Run containers on that network:

```bash
docker run -d --name db --network app-network postgres:16
docker run -d --name api --network app-network myapi:1.0
```

Now the `api` container can usually reach the database by the container name `db`.

List networks:

```bash
docker network ls
```

Inspect a network:

```bash
docker network inspect app-network
```

---

## Docker Compose

When an application needs multiple services, `docker compose` is much easier than running many `docker run` commands manually.

Example `compose.yaml`:

```yaml
services:
  web:
    build: .
    ports:
      - "8000:8000"
    depends_on:
      - redis

  redis:
    image: redis:7
```

Start the stack:

```bash
docker compose up
```

Start in detached mode:

```bash
docker compose up -d
```

Stop and remove services:

```bash
docker compose down
```

View status and logs:

```bash
docker compose ps
docker compose logs
docker compose logs -f web
```

Rebuild after code changes:

```bash
docker compose up -d --build
```

!!! note "Prefer `docker compose`"
    Modern Docker installations use `docker compose` with a space. The older `docker-compose` command may still work on some systems, but the plugin-based `docker compose` form is now the standard.

---

## Registries and Image Sharing

After building an image locally, you can push it to a registry so others or your deployment pipeline can pull it.

Log in:

```bash
docker login
```

Tag an image for Docker Hub:

```bash
docker tag myapp:1.0 your-dockerhub-user/myapp:1.0
```

Push it:

```bash
docker push your-dockerhub-user/myapp:1.0
```

Pull it on another machine:

```bash
docker pull your-dockerhub-user/myapp:1.0
```

---

## Practical Workflow

A common day-to-day Docker workflow looks like this:

1. Write or update the application
2. Define the image in a `Dockerfile`
3. Build the image with `docker build`
4. Run and test it locally with `docker run` or `docker compose`
5. Inspect logs and fix issues
6. Tag the final image
7. Push it to a registry
8. Deploy it in staging or production

---

## Best Practices

- Use specific image tags instead of relying only on `latest`
- Keep images small and focused on a single responsibility
- Prefer official or trusted base images
- Store secrets outside images whenever possible
- Use `.dockerignore` to reduce build context size
- Avoid running as root inside containers when the image can be hardened
- Persist important state with volumes, not container filesystems
- Use `docker compose` for multi-container development environments

!!! warning "Containers are not full security boundaries"
    Docker improves isolation, but containers still share the host kernel. For sensitive workloads, combine Docker with OS hardening, image scanning, least privilege, and good secret management.

---

## Troubleshooting

### Container exits immediately

Symptom:

- The container starts and stops right away

Checks:

```bash
docker ps -a
docker logs <container>
```

Typical causes:

- The main process finished successfully and exited
- The startup command is incorrect
- A required file or environment variable is missing

### Port already in use

Symptom:

- Docker reports that a host port is already allocated

Checks:

```bash
lsof -i :8080
docker ps
```

Fixes:

- Stop the conflicting process
- Change the host-side port mapping

Example:

```bash
docker run -p 8081:80 nginx
```

### Build fails

Symptom:

- `docker build` returns an error during image creation

Checks:

```bash
docker build -t myapp:1.0 .
docker build --no-cache -t myapp:1.0 .
```

Typical causes:

- Syntax issues in the `Dockerfile`
- Missing files in the build context
- Dependency installation failures
- Cached layers hiding recent changes

### Cannot remove image or container

Symptom:

- Docker says the object is still in use

Checks:

```bash
docker ps -a
docker images
```

Fixes:

```bash
docker stop <container>
docker rm <container>
docker rmi <image>
```

If needed, force removal:

```bash
docker rm -f <container>
docker rmi -f <image>
```

### Docker daemon is not running

Symptom:

- Commands fail with a message that Docker cannot connect to the daemon

Checks:

```bash
docker info
```

Fixes:

- Start Docker Desktop on macOS or Windows
- Start the Docker service on Linux:

```bash
sudo systemctl start docker
sudo systemctl enable docker
```

---

## Quick Reference

```bash
docker pull nginx:latest
docker build -t myapp:1.0 .
docker run -d -p 8080:80 --name web nginx
docker exec -it web /bin/sh
docker logs -f web
docker compose up -d --build
docker compose ps
docker compose down
docker volume ls
docker network ls
docker system prune
```

!!! tip "Use cleanup carefully"
    `docker system prune` removes unused objects such as stopped containers and dangling images. Review what it will delete before running it on a machine you care about.

## FAQ

### What is Docker used for?

Docker packages applications and dependencies into containers so they can run consistently across laptops, test servers, and production-style environments.

### What is the difference between an image and a container?

An image is the packaged template. A container is a running instance of that image. You build and pull images, then run containers from them.

### Should I learn Docker before Kubernetes?

Yes. Docker teaches container images, ports, volumes, logs, and runtime behavior. Those concepts make [Kubernetes core concepts](../kubernetes/core-concepts/index.md) much easier to understand.

### When should I use Docker Compose?

Use Docker Compose when you need several local services together, such as an app, database, cache, and monitoring container. For cluster scheduling and production-style orchestration, continue to [Kubernetes](../kubernetes/index.md).

## Related Learning

- [Basic Docker commands](basic.md)
- [Kubernetes with Docker Desktop lab](../kubernetes/labs/03-docker-desktop-lab.md)
- [Shell scripting for DevOps automation](../shell-scripts/scripts.md)
- [Terraform overview](../terraform/overview.md)
