---
description: Practice essential Docker commands as lifecycle tools with common mistakes and troubleshooting checks.
---

# Essential Docker Commands

| Goal | Command | Common mistake |
| --- | --- | --- |
| pull | `docker pull nginx:stable` | assuming `latest` is fixed |
| run | `docker run --name web -d -p 8080:80 nginx:stable` | publishing wrong ports |
| state | `docker ps -a` | looking only at running containers |
| logs | `docker logs -f web` | expecting application log files |
| debug | `docker exec -it web sh` | assuming Bash exists |
| metadata | `docker inspect web` | ignoring application logs |
| metrics | `docker stats`, `docker top web` | confusing host/container metrics |
| files | `docker cp`, `docker diff` | deploying mutable changes |

Practice: run Nginx, browse port 8080, inspect `docker port web`, follow its logs, then stop and remove it. If it fails, use `docker ps -a`, `docker logs`, and `docker inspect` before changing anything.
