---
title: "Linux Performance Troubleshooting: USE Method and Triage"
icon: lucide/gauge
description: "Diagnose slow Linux servers with the USE method — load average, CPU steal, memory and OOM kills, disk I/O, and network saturation."
tags:
  - Linux
  - Performance
  - Troubleshooting
---

# Performance Troubleshooting

## What You'll Learn

- A repeatable method for "the server is slow" instead of guessing
- A 60-second command checklist that covers every major resource
- How to read load average, CPU steal and iowait, memory pressure, and OOM kills
- How to find disk and network bottlenecks and the process responsible

## The USE Method

For every resource — CPU, memory, disk, network — check three things:

| | Question | Example signal |
|---|---|---|
| **U**tilization | How busy is it? | CPU at 95%, disk busy 100% of the time |
| **S**aturation | Is work queuing? | Run queue longer than CPU count, I/O wait, swap activity |
| **E**rrors | Is anything failing? | OOM kills, disk errors, dropped packets |

Checking saturation and errors — not just utilization — catches problems that "CPU looks fine" misses.

## The 60-Second Triage

Run these in order on a slow host. Each takes a few seconds.

```bash
uptime                          # 1. load averages and how long it's been up
dmesg -T | tail -20             # 2. kernel errors: OOM kills, disk, network
vmstat 1 5                      # 3. run queue, memory, swap, CPU split
mpstat -P ALL 1 3               # 4. per-CPU usage: one hot core?
pidstat 1 3                     # 5. which processes use CPU
iostat -xz 1 3                  # 6. disk latency and saturation
free -m                         # 7. memory and swap
sar -n DEV 1 3                  # 8. network throughput per interface
ss -s                           # 9. socket summary: connection counts, TIME-WAIT
top                             # 10. confirm the overall picture
```

`mpstat`, `pidstat`, `iostat`, and `sar` come from the `sysstat` package: `sudo apt install -y sysstat`.

## Load Average

```bash
$ uptime
 10:42:01 up 21 days,  3:12,  2 users,  load average: 12.40, 8.10, 3.05
$ nproc
4
```

Load is the average number of processes **running, waiting for CPU, or in uninterruptible I/O wait** over 1, 5, and 15 minutes.

- Compare it to the CPU count. A load of 12 on 4 CPUs means work is queuing.
- The three numbers show the trend: `12.40, 8.10, 3.05` is getting worse fast.
- On Linux, high load with low CPU usage usually means processes stuck waiting on disk or NFS (state `D`).

## CPU

```bash
$ vmstat 1 5
procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
 9  0      0 812344  60212 2203120    0    0     4    40 2210 4100 88 10  2  0  0
```

| Column | Meaning | Worry when |
|---|---|---|
| `r` | Runnable processes | Consistently above the CPU count |
| `b` | Blocked on I/O | Consistently above 0 |
| `us` / `sy` | User / kernel CPU | `sy` high: syscalls, context switching, or kernel work |
| `wa` | Waiting on I/O | Above ~10–20%: look at disks |
| `st` | Steal — time the hypervisor gave to other VMs | Above a few percent on cloud VMs: noisy neighbors or burstable credits exhausted |

```bash
pidstat -u 1 5                      # per-process CPU over time
top -H -p <pid>                     # per-thread CPU inside one process
```

On burstable cloud instances (for example AWS `t` families), a sudden jump in `st` often means CPU credits ran out.

## Memory

```bash
$ free -m
               total        used        free      shared  buff/cache   available
Mem:            7940        6120         210          45        1610        1480
Swap:           2047        1900         147
```

- Read **`available`**, not `free`. Linux uses spare memory for page cache and gives it back on demand, so low `free` is normal.
- Heavy swap use plus nonzero `si`/`so` in `vmstat` means the system is actively paging, which destroys performance.

### OOM kills

When memory runs out, the kernel's OOM killer terminates a process:

```bash
dmesg -T | grep -i -E 'out of memory|killed process'
journalctl -k --since "2 hours ago" | grep -i oom
```

```text
Out of memory: Killed process 23145 (java) total-vm:9123456kB, anon-rss:6012340kB
```

In containers, the limit is the cgroup's memory limit, not the host's RAM. A container killed for exceeding its limit shows `OOMKilled` in `docker inspect` or `kubectl describe pod`.

```bash
ps aux --sort=-rss | head           # biggest resident memory users
sudo smem -tk 2>/dev/null | tail    # proportional memory including shared pages, if installed
```

## Disk I/O

```bash
$ iostat -xz 1 3
Device   r/s    w/s   rkB/s   wkB/s  r_await  w_await  aqu-sz  %util
nvme0n1  12.0  850.0   96.0  54400.0    0.40    38.50   32.10  100.00
```

| Column | Meaning | Worry when |
|---|---|---|
| `r_await` / `w_await` | Average latency per I/O in ms, including queueing | Well above the device's normal (SSD: low single-digit ms) |
| `aqu-sz` | Average queue length | Consistently above 1 |
| `%util` | Time the device was busy | Near 100% on a single-queue device; less meaningful on NVMe and cloud volumes |

Then find who's writing:

```bash
sudo iotop -oPa                     # processes doing I/O, accumulated
pidstat -d 1 5
```

Cloud volumes have provisioned IOPS and throughput limits. Latency that rises sharply at a round number of IOPS usually means you've hit the volume's limit, not a hardware fault.

## Network

```bash
sar -n DEV 1 3                      # throughput per interface
sar -n EDEV 1 3                     # errors and drops
ss -s                               # totals by state
ss -tan state time-wait | wc -l     # connections in TIME-WAIT
ss -tnp '( sport = :443 )' | head   # connections to a local service, with process
nstat -az | grep -i -E 'retrans|overflow|drop'
ip -s link show eth0                # RX/TX errors and drops
```

- Rising TCP retransmits point at packet loss or congestion.
- `ListenOverflows` or `ListenDrops` mean the application isn't accepting connections fast enough.
- Thousands of `TIME-WAIT` sockets on a client making many short connections suggest missing connection reuse.

[Networking Troubleshooting](../networking/05-network-troubleshooting-toolkit.md) goes deeper on DNS, TLS, and latency.

## Worked Example

A web API's p99 latency jumps from 80 ms to 2 s.

1. `uptime` — load 14 on an 8-CPU host, rising.
2. `vmstat 1` — `r` around 3, `b` around 10, `wa` 40%. CPU isn't the bottleneck; processes are blocked on I/O.
3. `iostat -xz 1` — the data volume shows `w_await` of 120 ms and a long queue.
4. `pidstat -d 1` — a log shipper is writing 60 MB/s after its buffer backed up.
5. Fix now: throttle or restart the shipper. Fix properly: move logs to a separate volume, set `ionice` for the shipper, and alert on disk latency — not only disk space.

## Common Mistakes

- Looking only at CPU percentage and missing I/O wait, steal, or memory pressure.
- Reading `free` memory instead of `available`, and "fixing" normal page cache usage.
- Restarting the service first, and destroying the evidence you needed to find the cause.
- Treating high load average as a CPU problem when processes are blocked on disk.
- Ignoring `dmesg`, where OOM kills and disk errors are recorded.
- Troubleshooting one sample instead of watching a few seconds of `vmstat` or `iostat` output.

## Interview Questions

- Explain the USE method and apply it to a slow database server.
- What does load average actually measure on Linux?
- `free` shows 200 MB free on an 8 GB server. Is that a problem?
- How do you find out whether a process was OOM-killed?
- CPU usage is 30% but the server is slow. Where do you look next?
- What does CPU steal time tell you on a cloud VM?

## Next

You've finished Linux. Continue to [Networking](../networking/index.md), or put these commands into scripts with [Shell Scripting](../shell-scripting/index.md).
