---
description: Learn Docker bridge networking, port publishing, user-defined networks, and service discovery.
---

# Docker Networking and Service Discovery

Port publishing maps a host-facing port to a container listener: browser → host port 8080 → Docker forwarding/NAT → container port 80 → Nginx.

Prefer a user-defined bridge for multi-container applications. Docker supplies DNS there, so an API should reach a database by a stable service name such as `db`, not a copied container IP. IPs may change when a container is recreated.

`docker network inspect`, `docker port`, DNS lookup, and application-level HTTP checks are the first troubleshooting tools. `--network host` removes normal network isolation and should be chosen deliberately.

## Practice

```bash
docker network create app-net
docker run -d --name db --network app-net postgres:16
docker run --rm --network app-net busybox nslookup db
docker network inspect app-net
```

The `nslookup` command checks Docker-provided DNS resolution inside the same network. It does not prove that PostgreSQL is healthy or accepting the credentials your application uses.
