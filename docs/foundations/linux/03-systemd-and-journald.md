---
title: "systemd and journald: Services, Timers, and Logs on Linux"
icon: lucide/power
description: "Manage services with systemd — unit files, drop-in overrides, restart policies, timers instead of cron, sandboxing, and journalctl queries."
tags:
  - Linux
  - systemd
---

# systemd and journald

## What You'll Learn

- What systemd manages, and the unit types you'll meet most often
- How to write a production-ready service unit for your own application
- How to change a packaged unit safely with drop-in overrides
- How to replace cron jobs with timers, sandbox a service, and query logs with `journalctl`

## Mental Model

> systemd is PID 1. It starts everything else, tracks every process a service creates in a cgroup, restarts services that fail, and collects their output in the journal. You describe **what** should run in unit files; systemd works out the **order** from dependencies.

| Unit type | Describes | Example |
|---|---|---|
| `.service` | A process to run | `nginx.service` |
| `.timer` | A schedule that activates another unit | `logrotate.timer` |
| `.socket` | A socket that starts a service on first connection | `ssh.socket` |
| `.target` | A group of units, like a runlevel | `multi-user.target` |
| `.mount` | A filesystem mount | `srv-data.mount` |

Unit files live in `/usr/lib/systemd/system/` (from packages — don't edit) and `/etc/systemd/system/` (yours — takes precedence).

## Everyday Commands

```bash
systemctl status nginx                  # state, main PID, recent log lines
sudo systemctl start|stop|restart nginx
sudo systemctl reload nginx             # reload config without dropping connections, if supported
sudo systemctl enable --now nginx       # start now and at boot
systemctl is-active nginx; systemctl is-enabled nginx
systemctl list-units --type=service --state=failed
systemctl cat nginx                     # the unit file plus any overrides, exactly as systemd sees it
systemctl show nginx -p MainPID,Restart,LimitNOFILE
```

## Write a Service for Your Application

```ini title="/etc/systemd/system/orders-api.service"
[Unit]
Description=Orders API
Documentation=https://wiki.example.com/orders-api
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=orders
Group=orders
WorkingDirectory=/opt/orders-api
EnvironmentFile=/etc/orders-api/env
ExecStart=/opt/orders-api/.venv/bin/gunicorn --bind 127.0.0.1:8000 app:app
ExecReload=/bin/kill -HUP $MAINPID

# Restart on crashes, but stop retrying if it fails 5 times in 2 minutes
Restart=on-failure
RestartSec=5
StartLimitIntervalSec=120
StartLimitBurst=5

# Graceful shutdown: SIGTERM, then SIGKILL after 30 seconds
KillSignal=SIGTERM
TimeoutStopSec=30

LimitNOFILE=65536
UMask=0027

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload            # required after creating or editing unit files
sudo systemctl enable --now orders-api
systemctl status orders-api
```

### Choosing `Type=`

| Type | Use when the program… |
|---|---|
| `simple` / `exec` | Runs in the foreground (most modern apps). `exec` reports failure if the binary can't start. |
| `notify` | Tells systemd it's ready via `sd_notify` (for example, some databases) |
| `forking` | Daemonizes itself and the parent exits (older software, like SonarQube's `sonar.sh`) |
| `oneshot` | Runs a task and exits — used with timers |

## Change a Packaged Unit With an Override

Never edit files under `/usr/lib/systemd/system` — a package upgrade overwrites them. Use a drop-in:

```bash
sudo systemctl edit nginx
```

```ini title="/etc/systemd/system/nginx.service.d/override.conf"
[Service]
LimitNOFILE=131072
Restart=on-failure
```

```bash
systemctl cat nginx          # confirm the override is merged
sudo systemctl restart nginx
```

To replace a list setting such as `ExecStart=`, clear it first with an empty assignment, then set the new value:

```ini
[Service]
ExecStart=
ExecStart=/usr/sbin/nginx -g 'daemon off;' -c /etc/nginx/custom.conf
```

## Timers Instead of Cron

Timers log to the journal, don't run twice if a job overlaps, can catch up after downtime, and are visible with `systemctl`.

```ini title="/etc/systemd/system/db-backup.service"
[Unit]
Description=Nightly database backup

[Service]
Type=oneshot
User=backup
ExecStart=/usr/local/bin/db-backup.sh
Nice=10
IOSchedulingClass=idle
```

```ini title="/etc/systemd/system/db-backup.timer"
[Unit]
Description=Run the database backup nightly

[Timer]
OnCalendar=*-*-* 02:30:00
RandomizedDelaySec=15m
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now db-backup.timer
systemctl list-timers db-backup.timer
systemd-analyze calendar '*-*-* 02:30:00'   # check the schedule expression
sudo systemctl start db-backup.service       # run once now to test
```

`Persistent=true` runs a missed job at boot if the machine was off at 02:30. `RandomizedDelaySec` stops a fleet of servers from all hitting the database at the same second.

## Sandbox a Service

systemd can remove privileges a service doesn't need, with no code changes:

```ini
[Service]
NoNewPrivileges=true
ProtectSystem=strict          # the whole filesystem is read-only...
ReadWritePaths=/var/lib/orders-api /var/log/orders-api   # ...except these
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
CapabilityBoundingSet=
```

```bash
systemd-analyze security orders-api     # scores exposure and lists what's still allowed
```

Add options one or two at a time and test — a too-strict sandbox shows up as `EACCES` or "Read-only file system" errors in the logs.

## Query Logs With `journalctl`

```bash
journalctl -u orders-api -f                        # follow one service
journalctl -u orders-api --since "1 hour ago"
journalctl -u orders-api -b                        # since the last boot
journalctl -u orders-api -b -1                     # the previous boot — what happened before the crash?
journalctl -p err -b                               # errors and worse, all units
journalctl -k | grep -i -E 'oom|killed process'    # kernel messages, including OOM kills
journalctl -u orders-api -o json-pretty -n 1       # structured fields
journalctl --disk-usage
```

### Keep the journal from filling the disk

```ini title="/etc/systemd/journald.conf.d/size.conf"
[Journal]
Storage=persistent
SystemMaxUse=1G
MaxRetentionSec=14day
```

```bash
sudo systemctl restart systemd-journald
sudo journalctl --vacuum-size=500M      # one-off cleanup
```

## Boot and Failure Analysis

```bash
systemd-analyze blame | head            # slowest units at boot
systemd-analyze critical-chain          # what the boot waited on
systemctl list-dependencies orders-api
systemctl reset-failed orders-api       # clear the start limit after fixing the cause
```

## Common Mistakes

- Editing a unit file and forgetting `systemctl daemon-reload`, so systemd keeps running the old definition.
- Editing packaged units in `/usr/lib/systemd/system` instead of using `systemctl edit`, and losing changes on upgrade.
- Using `Restart=always` without a start limit, so a broken service restarts in a tight loop and floods logs.
- Setting `After=network.target` and expecting the network to be usable — use `network-online.target` with `Wants=`.
- Keeping cron jobs that fail silently instead of timers whose failures show up in `systemctl list-units --failed` and the journal.
- Leaving journald without size limits on small disks.

## Interview Questions

- What happens between `systemctl start` and your application accepting traffic?
- How do you change a setting on a service installed by a package, safely?
- Why might a timer be better than a cron job?
- A service keeps restarting. Which commands do you run, in what order?
- What does `ProtectSystem=strict` do, and how do you let the service write its data?

## Next

Continue to [Storage, Disks, and LVM](04-storage-disks-and-lvm.md).
