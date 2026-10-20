---
title: "Python CLI Tools: Typer, argparse, and subprocess"
icon: lucide/square-terminal
description: "Build Python CLIs for operations — Typer and argparse, safe subprocess calls, logging, exit codes, environment variables, and signals."
tags:
  - Python
  - CLI
---

# CLI Tools and subprocess

## What You'll Learn

- How to build a command-line interface with Typer, or with `argparse` from the standard library
- How to run external commands safely with `subprocess`
- How to log properly and return exit codes other tools can rely on
- How to read configuration from environment variables and handle shutdown signals

## A CLI With Typer

[Typer](https://typer.tiangolo.com/) builds a full CLI — help text, types, validation, subcommands — from function signatures.

```python title="src/opsctl/cli.py"
import logging
from enum import StrEnum
from typing import Annotated

import typer

from opsctl import health, systemd

app = typer.Typer(help="Operations helpers for the platform team.", no_args_is_help=True)
log = logging.getLogger("opsctl")


class LogLevel(StrEnum):
    debug = "DEBUG"
    info = "INFO"
    warning = "WARNING"


@app.callback()
def main(
    log_level: Annotated[LogLevel, typer.Option(help="Log verbosity.")] = LogLevel.info,
) -> None:
    logging.basicConfig(
        level=log_level.value,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )


@app.command()
def check(
    urls: Annotated[list[str], typer.Argument(help="Health endpoints to check.")],
    timeout: Annotated[float, typer.Option(min=0.5, help="Seconds per request.")] = 5.0,
) -> None:
    """Check health endpoints and exit non-zero if any fail."""
    failures = 0
    for url in urls:
        result = health.check(url, timeout=timeout)
        status = "OK" if result.ok else "FAIL"
        typer.echo(f"{status:4} {result.status_code or '-':>3} {result.elapsed_ms:>6.0f}ms {url}")
        failures += not result.ok
    raise typer.Exit(code=1 if failures else 0)


@app.command()
def restart(
    service: str,
    dry_run: Annotated[bool, typer.Option("--dry-run", help="Show what would happen.")] = False,
) -> None:
    """Restart a systemd service if it isn't active."""
    if systemd.is_active(service):
        log.info("%s is active, nothing to do", service)
        return
    if dry_run:
        typer.echo(f"would restart {service}")
        return
    systemd.restart(service)
    log.info("restarted %s", service)
```

```bash
uv run opsctl --help
uv run opsctl check https://api.example.com/healthz https://shop.example.com/healthz
uv run opsctl --log-level DEBUG restart orders-api --dry-run
echo $?
```

### The same idea with `argparse`

When you can't add dependencies — a script copied onto a minimal host — use the standard library:

```python
import argparse
import sys

def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check health endpoints.")
    parser.add_argument("urls", nargs="+", help="endpoints to check")
    parser.add_argument("--timeout", type=float, default=5.0)
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args(argv)

if __name__ == "__main__":
    args = parse_args()
    sys.exit(run(args))
```

Passing `argv` explicitly makes the parser easy to test: `parse_args(["https://x", "--timeout", "2"])`.

## Running Commands With `subprocess`

```python title="src/opsctl/systemd.py"
import logging
import shutil
import subprocess

log = logging.getLogger(__name__)

# Resolve full paths once, instead of trusting whatever is first in PATH
SYSTEMCTL = shutil.which("systemctl") or "/usr/bin/systemctl"
SUDO = shutil.which("sudo") or "/usr/bin/sudo"


def is_active(service: str) -> bool:
    result = subprocess.run(  # noqa: S603 — fixed argument list, no shell
        [SYSTEMCTL, "is-active", "--quiet", service],
        check=False,  # a non-zero exit is an answer here, not an error
        timeout=10,
    )
    return result.returncode == 0


def restart(service: str) -> None:
    try:
        subprocess.run(  # noqa: S603 — fixed argument list, no shell
            [SUDO, SYSTEMCTL, "restart", service],
            check=True,  # raise CalledProcessError on non-zero exit
            capture_output=True,
            text=True,
            timeout=60,
        )
    except subprocess.CalledProcessError as exc:
        log.error("restart of %s failed (exit %s): %s", service, exc.returncode, exc.stderr.strip())
        raise
```

### The rules

| Do | Don't |
|---|---|
| Pass a **list** of arguments: `["git", "log", "-1", ref]` | Build a string and use `shell=True` |
| Set `timeout=` on every call | Let a hung command block your tool forever |
| Choose `check=True` or inspect `returncode` deliberately | Ignore failures |
| Use `capture_output=True, text=True` to read output | Parse bytes by hand |
| Use Python libraries when they exist (`shutil`, `pathlib`, boto3) | Shell out to `cp`, `rm`, or `aws` for everything |

!!! warning "`shell=True` with any input is command injection"
    `subprocess.run(f"git log {branch}", shell=True)` runs `git log main; rm -rf ~` if `branch` is `main; rm -rf ~`. With a list and no shell, the whole value is passed as one argument, however it's quoted.

If you genuinely need a shell feature such as a pipeline, quote every variable:

```python
import shlex
cmd = f"journalctl -u {shlex.quote(service)} --since today | grep -c ERROR"
out = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30, check=False)
```

### Streaming long-running output

```python
with subprocess.Popen(
    ["kubectl", "rollout", "status", "deployment/orders-api", "--timeout=300s"],
    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
) as proc:
    for line in proc.stdout:
        log.info("kubectl: %s", line.rstrip())
if proc.returncode != 0:
    raise SystemExit(f"rollout failed with exit code {proc.returncode}")
```

## Logging

```python
import logging

log = logging.getLogger(__name__)      # one logger per module

log.debug("request headers: %s", headers)          # lazy % formatting, not f-strings
log.info("deleted %d snapshots", count)
log.warning("retrying %s after %s", url, exc)
log.exception("unexpected failure")                # inside except: includes the traceback
```

- Configure logging **once**, in the entry point, not in library modules.
- Send logs to stderr (the default) and results to stdout, so `opsctl list-volumes > volumes.txt` captures only data.
- For log aggregation, emit JSON — see [Python Logging in Practice](../../monitoring-tools/python-logging.md).
- Never log secrets, tokens, or full request bodies that may contain them.

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Checks failed, or a general error |
| `2` | Usage error (Typer and argparse use this automatically) |
| Others | Document any specific codes your tool returns |

An uncaught exception exits with `1` and a traceback. For expected failures, catch them at the top level and print a clear message instead:

```python
def run() -> int:
    try:
        app()
    except PermissionError as exc:
        log.error("permission denied: %s — are you running with the right role?", exc)
        return 1
    return 0
```

## Configuration From the Environment

```python
import os

API_URL = os.environ.get("OPSCTL_API_URL", "https://api.internal.example.com")
TOKEN = os.environ["OPSCTL_TOKEN"]        # KeyError immediately if missing — fail fast
```

Typer can read options from environment variables directly:

```python
token: Annotated[str, typer.Option(envvar="OPSCTL_TOKEN", help="API token.")]
```

Precedence, from highest to lowest: command-line flag, environment variable, config file, default.

## Graceful Shutdown

`KeyboardInterrupt` (Ctrl+C) is raised automatically. For `SIGTERM` from systemd, Docker, or Kubernetes, install a handler:

```python
import signal
import threading

stop = threading.Event()
signal.signal(signal.SIGTERM, lambda signum, frame: stop.set())

while not stop.is_set():
    process_next_batch()
    stop.wait(timeout=5)           # sleeps, but wakes immediately on SIGTERM
log.info("shutting down cleanly")
```

## What Most Engineers Miss

- **A negative `returncode` means a signal.** `subprocess` reports a child killed by signal N as `-N`: `-9` is SIGKILL (often the OOM killer), `-15` SIGTERM. A shell would show the same death as 128 + N. Decode either form with the [exit status decoder](../linux/02-processes-and-signals.md#reading-an-exit-status).
- **Ctrl+C exits like a signal since Python 3.8.** An uncaught `KeyboardInterrupt` now makes the interpreter end itself with SIGINT, so a calling shell sees status 130 and a `while` loop around the script stops on one Ctrl+C.
- **Measure durations with `time.monotonic()`.** `time.time()` follows the wall clock, which NTP corrections and leap seconds can move backwards, producing negative durations and broken timeouts. `time.monotonic()` only moves forward.
- **`timeout=` kills the child, not its children.** With `shell=True`, the child is the shell; a grandchild it started can keep running. Start the child in its own process group (`start_new_session=True`) and kill the group (`os.killpg`) if you need everything stopped.

!!! incident "Real incident: Cloudflare's negative duration (2017)"
    During the leap second at midnight UTC on 1 January 2017, Cloudflare's DNS service computed a round-trip time from two wall-clock readings, got a negative number, and passed it to a function that panics on negative input. Some DNS queries failed until a fix was deployed hours later ([postmortem](https://blog.cloudflare.com/how-and-why-the-leap-second-affected-cloudflare-dns/)). The same bug is one line in Python: `elapsed = time.time() - start`. Use `time.monotonic()`.

## Common Mistakes

- `shell=True` with string formatting — command injection waiting to happen.
- `subprocess.run` without a timeout, so one hung `ssh` or `kubectl` call blocks a pipeline for hours.
- Printing everything to stdout, mixing logs with output other tools consume.
- Catching `Exception` everywhere and exiting `0`, so failures look like success.
- Calling `logging.basicConfig` in library modules, overriding the application's configuration.
- Putting all logic in `cli.py`, so nothing can be tested without invoking the CLI.

## Check Yourself

!!! quiz "Timing a retry loop"
    A retry loop stops after 30 seconds using `time.time()`. On one server it occasionally retries for a minute and a half. What's a plausible cause?

    - [ ] Python's `sleep()` is inaccurate
    - [x] The wall clock was stepped backwards by NTP during the loop
    - [ ] The GIL delayed the loop

    Deadlines and durations belong on `time.monotonic()`, which can't go backwards.

## Interview Questions

- Why is `subprocess.run(cmd, shell=True)` dangerous, and what do you use instead?
- How should a CLI tool report failure to a CI pipeline or cron?
- Why should logs go to stderr and results to stdout?
- How do you make a long-running Python worker shut down cleanly on `SIGTERM`?

## Next

Continue to [Working With HTTP APIs](03-working-with-http-apis.md).
