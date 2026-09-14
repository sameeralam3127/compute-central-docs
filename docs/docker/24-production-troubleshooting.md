---
title: "Docker Production Troubleshooting: A Systematic Workflow"
icon: lucide/stethoscope
description: "A systematic Docker troubleshooting workflow — exits and restarts, OOM kills, unreachable ports, DNS, volume permissions, and full disks."
tags:
  - Docker
  - Troubleshooting
  - Beyond Docker
---

# Troubleshooting Like a DevOps Engineer

## What You'll Learn

- A repeatable method: collect evidence, form a hypothesis, test it with the smallest change
- The commands that answer "what state is it in, and why?"
- Worked diagnoses for the failures you'll see most in production
- How to capture evidence before anyone restarts the container

## The Method

```mermaid
flowchart LR
    A["1. Scope<br>what, where, since when?"] --> B["2. Collect evidence<br>before changing anything"]
    B --> C["3. Hypothesis<br>which layer?"]
    C --> D["4. Smallest test<br>that could prove it wrong"]
    D -->|confirmed| E["5. Fix + verify"]
    D -->|disproved| C
    E --> F["6. Prevent<br>alert, test, runbook"]
```

Start with evidence, not a restart loop. A restart can destroy the one clue you needed — the previous container's logs, its exit code, or the memory state.

## Capture Evidence First

```bash
c=orders
mkdir -p "incident-$(date +%F-%H%M)" && cd "$_"
docker ps -a --filter name=$c --format '{{.Names}} {{.Image}} {{.Status}}'   > ps.txt
docker inspect $c                                                             > inspect.json
docker logs --timestamps --tail 2000 $c                                       > logs.txt 2>&1
docker stats --no-stream $c                                                   > stats.txt
docker image inspect "$(docker inspect -f '{{.Image}}' $c)" -f '{{json .RepoDigests}}' > image-digest.txt
docker events --since 1h --until 0s --filter container=$c                     > events.txt
journalctl -u docker --since "1 hour ago" --no-pager                          > docker-daemon.txt
journalctl -k --since "1 hour ago" --no-pager | grep -iE 'oom|killed'         > kernel-oom.txt
```

Now you have the image digest, configuration, timeline, logs, resource usage, and kernel evidence — even if someone "fixes" it in the next five minutes.

## Symptom Map

| Symptom | First checks | Section |
| --- | --- | --- |
| Exits immediately | Exit code, logs, PID 1 command | [Exits immediately](#the-container-exits-immediately) |
| Restarts repeatedly | `RestartCount`, previous logs, health check | [Restart loop](#restart-loops) |
| Killed with 137 | `OOMKilled`, memory limit, kernel log | [OOM](#oom-kills) |
| Unreachable from outside | `docker port`, bind address, firewall | [Unreachable](#the-service-is-unreachable) |
| Can't reach another container | Network membership, DNS | [Connectivity](#container-to-container-failures) |
| Data missing or permission denied | Mounts, UIDs | [Storage](#storage-and-permission-problems) |
| Host disk full | `docker system df`, log sizes | [Disk](#the-host-disk-is-full) |
| Slow | CPU throttling, host pressure | [Slow](#slow-containers) |
| Pull fails | Auth, rate limit, architecture | [Images](#image-pull-and-start-failures) |
| Every Docker command hangs or fails | Daemon health | [Daemon](#daemon-problems) |

## The Container Exits Immediately

```bash
docker inspect -f 'exit={{.State.ExitCode}} error={{.State.Error}} oom={{.State.OOMKilled}}' orders
docker logs orders
docker inspect -f '{{json .Config.Entrypoint}} {{json .Config.Cmd}}' orders
```

| Evidence | Likely cause |
|---|---|
| Exit `0`, no errors | The main process finished — e.g. it started a daemon in the background and returned. Run the server in the **foreground** |
| Exit `127` / "executable file not found" | Wrong `CMD`/`ENTRYPOINT`, or a binary missing from the image |
| Exit `126` / "permission denied" | Script not executable, or Windows line endings in a shell script |
| `exec format error` | Wrong CPU architecture for this host |
| Exit `1` with a config error in logs | Missing environment variable or config file |

Get inside an image that won't stay up by overriding its entrypoint:

```bash
docker run --rm -it --entrypoint sh registry.example.com/orders:1.4.0
```

## Restart Loops

```bash
docker inspect -f 'restarts={{.RestartCount}} policy={{.HostConfig.RestartPolicy.Name}}' orders
docker inspect -f '{{json .State.Health}}' orders | jq '.Status, .Log[-3:]'
docker events --filter container=orders --since 30m
```

A restart policy hides crashes. Look at the **first** failure in the logs, not the latest, and check whether an unhealthy health check is what's triggering replacement in your orchestrator.

## OOM Kills

```bash
docker inspect -f 'OOMKilled={{.State.OOMKilled}} limit={{.HostConfig.Memory}}' orders
journalctl -k | grep -iE 'oom-kill|Killed process'
docker exec orders cat /sys/fs/cgroup/memory.events 2>/dev/null
```

- `OOMKilled=true` with a container memory limit: the app exceeded its cgroup limit — exactly what you triggered in the [cgroup lab](06-build-a-container-with-linux.md#step-6-put-it-all-together).
- `OOMKilled=false` but exit 137 and a kernel OOM message for the process: the **host** ran out of memory.
- Exit 137 with no OOM evidence: something sent `SIGKILL` — `docker kill`, a stop timeout, or an orchestrator.

Fix by right-sizing the limit from measured usage, fixing the leak, or configuring the runtime to respect container limits (for example JVM `-XX:MaxRAMPercentage`). Raising the limit blindly just delays the next incident.

## The Service Is Unreachable

Work from outside in:

```bash
curl -v http://SERVER:8080/healthz                          # 1. from where users are
docker port orders                                          # 2. published where you think?
sudo ss -tlnp | grep 8080                                   # 3. host listening (docker-proxy or rules)?
docker run --rm --network container:orders nicolaka/netshoot ss -tlnp   # 4. app listening inside, on 0.0.0.0?
docker run --rm --network container:orders nicolaka/netshoot curl -s localhost:8000/healthz  # 5. app answers locally?
```

The most common root causes: the app binds `127.0.0.1` inside the container ([Networking Foundations](12-networking-fundamentals.md#lab-the-127001-trap)), the port was published on `127.0.0.1` only, or a cloud security group or firewall blocks the host port.

## Container-to-Container Failures

```bash
docker inspect -f '{{json .NetworkSettings.Networks}}' orders | jq 'keys'
docker inspect -f '{{json .NetworkSettings.Networks}}' db | jq 'keys'
docker run --rm --network shop_default busybox nslookup db
docker run --rm --network shop_default busybox nc -zv db 5432
```

No shared network means no DNS name. Details in [Docker Networking](13-docker-networking.md#troubleshooting-connectivity).

## Storage and Permission Problems

```bash
docker inspect -f '{{json .Mounts}}' orders | jq
docker exec orders id
docker exec orders ls -ln /data
```

- Empty data after a redeploy: the new container isn't using the same **named volume**, or the data was in the writable layer.
- `Permission denied`: the container UID doesn't match the file owner. See [Storage](15-storage.md#permissions-the-error-everyone-hits).
- On SELinux hosts, check for denials: `sudo ausearch -m avc -ts recent`.

## The Host Disk Is Full

```bash
df -h /var/lib/docker
docker system df -v
sudo du -sh /var/lib/docker/containers/*/*-json.log 2>/dev/null | sort -h | tail
```

Usual culprits, in order: unrotated container logs, old images, build cache, stopped containers, orphaned volumes. Configure log rotation in `daemon.json` ([Installation](10-installation-and-engine.md#day-one-daemon-settings)), then prune deliberately — review volumes before deleting any.

## Slow Containers

```bash
docker stats --no-stream
docker exec orders cat /sys/fs/cgroup/cpu.stat        # nr_throttled, throttled_usec
docker inspect -f 'cpus={{.HostConfig.NanoCpus}}' orders
uptime; vmstat 1 5                                    # host-wide pressure
```

Rising `nr_throttled` means the container keeps hitting its CPU limit: latency spikes even when average CPU looks moderate. Also check host memory pressure, swap, and disk I/O wait before blaming the application.

## Image Pull and Start Failures

| Error | Cause | Fix |
|---|---|---|
| `unauthorized` / `denied` | Not logged in, wrong repository, expired token | `docker login` with the right account; check repository permissions |
| `toomanyrequests` | Docker Hub rate limit | Authenticate pulls, use a mirror or pull-through cache |
| `manifest unknown` | Tag doesn't exist (typo, or deleted by retention) | Check tags in the registry; deploy by digest |
| `no matching manifest for linux/amd64` | Image not built for this architecture | Build multi-platform — see [Dockerfiles](17-dockerfiles.md#multi-platform-builds) |
| `x509: certificate signed by unknown authority` | Private registry with an internal CA | Install the CA under `/etc/docker/certs.d/<registry>/ca.crt` |

## Daemon Problems

```bash
systemctl status docker --no-pager
journalctl -u docker -n 100 --no-pager
docker info 2>&1 | tail -20
sudo ls -l /var/run/docker.sock
docker context ls                                     # talking to the daemon you think?
```

A syntax error in `/etc/docker/daemon.json` is a frequent cause of Docker refusing to start after a configuration change: validate with `sudo dockerd --validate --config-file /etc/docker/daemon.json`.

## After the Fix

- Verify from the user's perspective, not just `docker ps`.
- Add the missing signal: an alert on restart count, OOM kills, disk usage, or health status.
- Write the runbook entry with the commands that found the cause.
- If a secret or credential appeared in logs or `docker inspect`, rotate it.

## Common Mistakes

- Restarting first and losing the previous container's logs and state.
- Reading only the latest crash in a restart loop instead of the first.
- Treating every exit 137 as a memory leak.
- Using `--network host` or `--privileged` as a "fix" that removes isolation instead of finding the cause.
- Pruning volumes to free disk space during an incident.

## Check Your Understanding

1. Why capture `docker inspect` and logs before restarting?
2. Exit code 137 with `OOMKilled=false` — what are the possibilities?
3. A published port times out from outside but works with `curl localhost` on the host. Where do you look?
4. What does a rising `nr_throttled` counter tell you?

## Next

Continue to the [Course Wrap-Up](25-course-wrap-up.md).
