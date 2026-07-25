---
description: Learn Docker bridge networking, port publishing, user-defined networks, and service discovery.
---

# 13. Docker Networking and Service Discovery

Port publishing maps a host-facing port to a container listener: browser → host port 8080 → Docker forwarding/NAT → container port 80 → Nginx.

Prefer a user-defined bridge for multi-container applications. Docker supplies DNS there, so an API should reach a database by a stable service name such as `db`, not a copied container IP. IPs may change when a container is recreated.

`docker network inspect`, `docker port`, DNS lookup, and application-level HTTP checks are the first troubleshooting tools. `--network host` removes normal network isolation and should be chosen deliberately.
