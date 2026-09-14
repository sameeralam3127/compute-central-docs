---
title: "What Is a Docker Container? Quick Reference and Cheat Sheet"
icon: lucide/scroll-text
description: "What a Docker container is, in plain terms, plus a cheat sheet for containers, images, builds, logs, networks, volumes, Compose, and cleanup."
tags:
  - Docker
  - Quick Reference
---

# Docker Quick Reference

## What Is a Docker Container?

A **Docker container** is an ordinary Linux process that runs in isolation. The kernel gives it its own view of the system: its own process IDs, network interfaces, hostname, and mounts, through [namespaces](04-linux-namespaces.md). [cgroups](05-cgroups.md) cap how much CPU and memory it can use. Its filesystem comes from an [image](16-container-images.md), a read-only package holding the application and everything it depends on.

- **Image vs container:** the image is the packaged template. A container is one running (or stopped) instance of it, with a thin writable layer on top. You can start many containers from one image.
- **Container vs virtual machine:** a VM boots its own kernel on virtual hardware. A container shares the host's kernel, so it starts in milliseconds and uses far less memory, at the cost of weaker isolation. See [Virtual Machines and KVM](02-virtual-machines-and-kvm.md).
- **What Docker adds:** the kernel features existed before Docker. Docker made them practical: a standard image format, a build tool (`Dockerfile`), registries for sharing images, and one CLI to run it all. See [What Docker Actually Solves](09-what-docker-solves.md).

The rest of this page is commands only, grouped by task. Every section links to the course chapter that explains it. New to containers? Start with [Docker and Linux Containers: From First Principles](index.md).

## Install and Check

```bash
docker version                       # client and server versions
docker info                          # storage driver, cgroup version, warnings
docker context ls                    # which engine the CLI talks to
docker context use <name>
sudo systemctl status docker
```

Details: [Installation and the Docker Engine](10-installation-and-engine.md)

## Containers

```bash
docker run -d --name web -p 8080:80 nginx:stable     # detached, named, port published
docker run --rm -it alpine sh                        # interactive, removed on exit
docker run -d --restart unless-stopped IMAGE         # restart policy
docker run -e KEY=value --env-file app.env IMAGE     # environment
docker run --memory 512m --cpus 1.5 IMAGE            # resource limits
docker run --user 10001:10001 --read-only IMAGE      # non-root, read-only root filesystem
docker run --init IMAGE                              # tiny init as PID 1 (signal handling)

docker ps                                            # running
docker ps -a                                         # all, including exited
docker start|stop|restart web
docker kill web                                      # SIGKILL — skips graceful shutdown
docker rm web                                        # remove stopped container
docker rm -f web                                     # stop and remove
docker update --restart on-failure:5 --memory 1g web
docker rename web web-old
```

Details: [Essential Docker Commands](11-essential-docker-commands.md)

## Logs, Exec, and Debugging

```bash
docker logs web
docker logs -f --since 10m --timestamps web
docker exec -it web sh                               # shell inside (bash may not exist)
docker exec web env
docker top web                                       # processes
docker stats --no-stream                             # CPU, memory, I/O
docker diff web                                      # files changed in the writable layer
docker cp web:/etc/nginx/nginx.conf ./
docker events --since 30m --filter container=web

# Debug a container without a shell, sharing its namespaces
docker run --rm -it --pid container:web --network container:web nicolaka/netshoot

# Start an image that exits immediately, with a shell instead
docker run --rm -it --entrypoint sh IMAGE
```

Details: [Production Troubleshooting](24-production-troubleshooting.md)

## Inspect Templates

```bash
docker inspect -f '{{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}}' web
docker inspect -f '{{.RestartCount}}' web
docker inspect -f '{{json .State.Health}}' web | jq
docker inspect -f '{{range $n, $c := .NetworkSettings.Networks}}{{$n}} {{$c.IPAddress}}{{"\n"}}{{end}}' web
docker inspect -f '{{json .Mounts}}' web | jq
docker inspect -f '{{.State.Pid}}' web               # host PID
docker port web
```

## Images

```bash
docker images
docker pull nginx:stable
docker pull nginx@sha256:<digest>                    # exact content
docker image inspect nginx:stable -f '{{index .RepoDigests 0}}'
docker image history nginx:stable
docker tag myapp:dev registry.example.com/team/myapp:1.4.0
docker rmi myapp:dev
docker save myapp:1.0 | gzip > myapp.tar.gz
gunzip -c myapp.tar.gz | docker load
docker buildx imagetools inspect nginx:stable        # platforms and digests
```

Details: [Container Images](16-container-images.md)

## Build

```bash
docker build -t myapp:1.0 .
docker build -f Dockerfile.prod -t myapp:1.0 .
docker build --target build -t myapp:build .         # stop at one stage
docker build --build-arg APP_VERSION=1.0 -t myapp:1.0 .
docker build --secret id=npmrc,src=$HOME/.npmrc -t web:1.0 .
docker build --no-cache -t myapp:1.0 .
docker build --check .                               # lint the Dockerfile
docker buildx build --platform linux/amd64,linux/arm64 -t REGISTRY/myapp:1.0 --push .
```

Minimal production Dockerfile skeleton:

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
USER 10001:10001
EXPOSE 8000
CMD ["python", "app.py"]
```

Details: [Dockerfiles](17-dockerfiles.md)

## Networks

```bash
docker network ls
docker network create app-net
docker network create --internal backend             # no outbound route
docker run -d --name api --network app-net IMAGE
docker network connect frontend api
docker network disconnect frontend api
docker network inspect app-net
docker run --rm --network app-net busybox nslookup api
docker run -p 127.0.0.1:5432:5432 postgres:16        # publish on loopback only
docker run --add-host=host.docker.internal:host-gateway IMAGE   # reach the host on Linux
```

Details: [Networking Foundations](12-networking-fundamentals.md), [Docker Networking](13-docker-networking.md)

## Volumes and Mounts

```bash
docker volume ls
docker volume create pgdata
docker volume inspect pgdata
docker run -v pgdata:/var/lib/postgresql/data postgres:16
docker run --mount type=bind,source="$PWD/conf",target=/etc/app,readonly IMAGE
docker run --mount type=tmpfs,target=/tmp/work IMAGE

# Back up and restore a (stopped) volume
docker run --rm -v pgdata:/src:ro -v "$PWD":/backup alpine tar czf /backup/pgdata.tgz -C /src .
docker run --rm -v pgdata:/dst -v "$PWD":/backup alpine tar xzf /backup/pgdata.tgz -C /dst
```

Details: [Storage and Persistent Data](15-storage.md)

## Compose

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f api
docker compose exec db psql -U postgres
docker compose run --rm api pytest
docker compose config                                # fully resolved file
docker compose --profile tools up -d
docker compose -f compose.yaml -f compose.prod.yaml up -d
docker compose watch
docker compose down                                  # keep volumes
docker compose down -v                               # delete named volumes too
```

Details: [Docker Compose](18-docker-compose.md)

## Registries

```bash
echo "$TOKEN" | docker login ghcr.io -u USER --password-stdin
docker push ghcr.io/team/myapp:1.4.0
docker buildx imagetools create --tag REPO:1.4.0 REPO:sha-3f7a2c1   # retag without pulling
docker logout ghcr.io
```

Details: [Registries and Publishing](19-registries-and-publishing.md)

## Cleanup

```bash
docker system df                                     # what's using space
docker container prune
docker image prune                                   # dangling images
docker image prune -a --filter "until=168h"
docker builder prune
docker volume ls -f dangling=true                    # REVIEW before deleting volumes
docker system prune                                  # containers, networks, dangling images, cache
```

!!! warning "Volumes hold data"
    `docker volume prune` and `docker system prune --volumes` delete volumes not attached to a container — including a database volume whose container you just removed.

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | Process finished successfully |
| `1` | Application error — read the logs |
| `125` | Docker couldn't create the container |
| `126` | Command not executable |
| `127` | Command not found |
| `137` | SIGKILL — `docker kill`, stop timeout, or OOM (check `OOMKilled`) |
| `143` | SIGTERM — normal `docker stop` |

## Troubleshooting One-Liners

| Problem | Command |
|---|---|
| Why did it exit? | `docker inspect -f '{{.State.ExitCode}} {{.State.OOMKilled}}' NAME; docker logs NAME` |
| Port unreachable | `docker port NAME` then check the app binds `0.0.0.0` inside |
| Port already allocated | `sudo ss -tlnp \| grep :8080` |
| Name doesn't resolve | Are both containers on the same **user-defined** network? |
| Permission denied on a mount | `docker exec NAME id` and `ls -ln` on the host path |
| Disk full | `docker system df -v` and container log sizes |
| Daemon down | `systemctl status docker; journalctl -u docker -n 50` |
| `exec format error` | Image architecture doesn't match the host |

## FAQ

**What's the difference between an image and a container?** An image is the packaged, read-only template. A container is a process started from it, with its own writable layer. See [Container Images](16-container-images.md).

**Should I learn Docker before Kubernetes?** Yes. Images, ports, volumes, logs, and runtime behavior carry straight over to [Kubernetes core concepts](../kubernetes/core-concepts/index.md).

**When should I use Docker Compose?** For several services together on one host — local development, CI test environments, and simple deployments. For multi-host production, continue to [Kubernetes](../kubernetes/index.md).

## Related Learning

- [Docker course index](index.md)
- [Kubernetes with Docker Desktop lab](../kubernetes/labs/03-docker-desktop-lab.md)
- [Shell scripting for DevOps automation](../foundations/shell-scripting/01-bash-fundamentals.md)
