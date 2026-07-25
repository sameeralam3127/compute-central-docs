---
description: A systematic Docker troubleshooting workflow for startup failures, exits, networking, DNS, volumes, limits, logs, and image problems.
---

# 24. Troubleshooting Like a DevOps Engineer

Start with evidence, not a restart loop.

| Symptom | First checks |
| --- | --- |
| does not start | `docker ps -a`, logs, inspect, exit code |
| exits immediately | PID 1, command, CMD/ENTRYPOINT, foreground process |
| unreachable | published port, listener, curl, network inspection |
| DNS fails | network membership, service name, resolver |
| data missing | volume/bind mount, ownership, backup/restore path |
| OOM or slow | limits, `docker stats`, host pressure, kernel evidence |

Collect the image reference/digest, container configuration, timestamps, logs, exit code, network settings, mount configuration, and host context before modifying the workload. Reproduce in a safe environment and make the smallest falsifiable change.
