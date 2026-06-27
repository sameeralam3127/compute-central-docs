---
description: Review basic Docker commands for running containers, starting and stopping workloads, building images, pulling and pushing images, inspecting containers, and reading logs.
---

# Basic Docker Commands

## Running Containers

### `docker run`

Run a command in a new container.

```bash
docker run <image> <command>
```

### `docker start`

Start a stopped container.

```bash
docker start <container>
```

### `docker stop`

Stop a running container.

```bash
docker stop <container>
```

## Managing Images

### `docker build`

Build an image from a Dockerfile.

```bash
docker build -t <image> .
```

### `docker pull`

Pull an image from a registry.

```bash
docker pull <image>
```

### `docker push`

Push an image to a registry.

```bash
docker push <image>
```

## Managing Containers

### `docker ps`

List running containers.

```bash
docker ps
```

### `docker inspect`

Get detailed information about a container.

```bash
docker inspect <container>
```

### `docker logs`

Fetch the logs of a container.

```bash
docker logs <container>
```
