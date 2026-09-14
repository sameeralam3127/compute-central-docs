---
title: "Production-Ready Bash Scripts: Arguments, Locking, and Retries"
icon: lucide/shield-check
description: "Write Bash scripts that are safe unattended — getopts, logging, exit codes, flock locking, dry-run mode, idempotency, retries, and cleanup."
tags:
  - Shell
  - Bash
  - Automation
---

# Production-Ready Scripts

## What You'll Learn

- How to parse options and print useful help with `getopts`
- How to log with timestamps and levels, and use exit codes callers can rely on
- How to prevent overlapping runs with `flock`
- How to add dry-run mode, idempotency, retries with backoff, and guaranteed cleanup

## What "Production-Ready" Means

A production script can be run by someone who didn't write it, at 3 a.m., by cron, or by a pipeline, and it:

- Explains how to use it, and fails fast with a clear message on bad input
- Logs what it did, with timestamps, to somewhere you can find later
- Is safe to run twice, and refuses to run twice **at the same time**
- Can show what it would do without doing it
- Cleans up after itself, even when it fails
- Returns exit codes that monitoring and callers can act on

## The Complete Template

```bash title="rotate-backups.sh"
#!/usr/bin/env bash
#
# rotate-backups.sh — keep the newest N backups in a directory and delete the rest.
#
set -Eeuo pipefail
shopt -s nullglob

readonly SCRIPT_NAME=${0##*/}
readonly LOCK_FILE=/run/lock/${SCRIPT_NAME%.sh}.lock

# Exit codes
readonly E_USAGE=2
readonly E_LOCKED=3
readonly E_PRECONDITION=4

# Defaults, overridable by options or environment
KEEP=${KEEP:-7}
DRY_RUN=false
VERBOSE=false
BACKUP_DIR=""

usage() {
  cat <<EOF
Usage: $SCRIPT_NAME [-n] [-v] [-k COUNT] -d DIRECTORY

Keep the newest COUNT backup files (*.tar.gz) in DIRECTORY and delete older ones.

Options:
  -d DIRECTORY  Backup directory (required)
  -k COUNT      Number of backups to keep (default: $KEEP)
  -n            Dry run: show what would be deleted
  -v            Verbose logging
  -h            Show this help

Exit codes: 0 success, $E_USAGE usage error, $E_LOCKED already running, $E_PRECONDITION precondition failed
EOF
}

log() {
  local level=$1; shift
  [[ $level == DEBUG && $VERBOSE != true ]] && return 0
  printf '%s %-5s %s: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$level" "$SCRIPT_NAME" "$*" >&2
}

die() {
  local code=$1; shift
  log ERROR "$*"
  exit "$code"
}

# Run a command, or print it in dry-run mode
run() {
  if [[ $DRY_RUN == true ]]; then
    log INFO "dry-run: $*"
  else
    log DEBUG "running: $*"
    "$@"
  fi
}

parse_args() {
  while getopts ":d:k:nvh" opt; do
    case $opt in
      d) BACKUP_DIR=$OPTARG ;;
      k) KEEP=$OPTARG ;;
      n) DRY_RUN=true ;;
      v) VERBOSE=true ;;
      h) usage; exit 0 ;;
      :) usage >&2; die "$E_USAGE" "option -$OPTARG requires an argument" ;;
      \?) usage >&2; die "$E_USAGE" "unknown option -$OPTARG" ;;
    esac
  done
  shift $((OPTIND - 1))

  [[ -n $BACKUP_DIR ]] || { usage >&2; die "$E_USAGE" "-d DIRECTORY is required"; }
  [[ $KEEP =~ ^[0-9]+$ && $KEEP -ge 1 ]] || die "$E_USAGE" "-k must be a positive integer, got '$KEEP'"
}

cleanup() {
  local rc=$?
  [[ -n ${TMP_DIR:-} && -d $TMP_DIR ]] && rm -rf -- "$TMP_DIR"
  if (( rc == 0 )); then
    log INFO "finished"
  else
    log ERROR "failed with exit code $rc"
  fi
}

main() {
  parse_args "$@"

  # Refuse to run concurrently
  exec 9>"$LOCK_FILE"
  flock -n 9 || die "$E_LOCKED" "another instance is running (lock: $LOCK_FILE)"

  trap cleanup EXIT
  TMP_DIR=$(mktemp -d)

  [[ -d $BACKUP_DIR ]] || die "$E_PRECONDITION" "directory not found: $BACKUP_DIR"

  # Newest first; filenames are timestamped so a reverse sort is chronological
  local files=("$BACKUP_DIR"/*.tar.gz)
  mapfile -t files < <(printf '%s\n' "${files[@]}" | sort -r)

  log INFO "found ${#files[@]} backups in $BACKUP_DIR, keeping $KEEP"

  if (( ${#files[@]} <= KEEP )); then
    log INFO "nothing to delete"
    return 0
  fi

  local f
  for f in "${files[@]:KEEP}"; do
    run rm -f -- "$f"
    log INFO "deleted $f"
  done
}

main "$@"
```

```bash
./rotate-backups.sh -d /backup/db -k 14 -n     # preview
./rotate-backups.sh -d /backup/db -k 14        # do it
echo $?                                          # 0
```

The sections below explain each technique.

## Argument Parsing With `getopts`

- The leading `:` in `":d:k:nvh"` enables silent error handling, so the script prints its own message for `:` (missing value) and `\?` (unknown option).
- A letter followed by `:` takes a value (`-d DIR`).
- Validate values after parsing: required options, numbers, paths that must exist.

`getopts` handles short options only. For long options (`--dry-run`), write a `while` / `case` loop over `"$@"`, or move the tool to Python.

## Logging and Exit Codes

- Log to **stderr** so stdout stays clean for data other tools may consume.
- Use UTC ISO-8601 timestamps so logs line up across servers and time zones.
- Under systemd or cron, stderr lands in the journal or mail. For file logs, redirect in the caller: `./rotate-backups.sh ... 2>>/var/log/rotate-backups.log`.

Define exit codes explicitly and document them in `--help`. Monitoring can then treat "already running" (`3`) differently from "precondition failed" (`4`).

## Locking With `flock`

Cron doesn't know whether yesterday's run is still going. Without a lock, a slow backup and the next one overlap and fight over the same files.

```bash
exec 9>"$LOCK_FILE"     # open file descriptor 9 on the lock file
flock -n 9 || exit 3    # -n: fail immediately if someone else holds the lock
```

The lock is released automatically when the script exits — even on a crash — because the file descriptor closes. There's no stale lock file to clean up by hand.

You can also wrap any command without changing it:

```bash
flock -n /run/lock/report.lock /usr/local/bin/generate-report.sh
```

## Dry-Run Mode

Route every state-changing command through one function:

```bash
run() {
  if [[ $DRY_RUN == true ]]; then log INFO "dry-run: $*"; else "$@"; fi
}

run rm -f -- "$f"
run systemctl restart orders-api
```

Read-only commands (listing files, checking status) run normally in dry-run mode, so the preview reflects the real state.

## Idempotency

Running the script twice should produce the same result as running it once.

```bash
# Not idempotent: appends a duplicate line every run
echo "vm.max_map_count=524288" >> /etc/sysctl.d/99-app.conf

# Idempotent: check, then act
grep -qxF "vm.max_map_count=524288" /etc/sysctl.d/99-app.conf 2>/dev/null \
  || echo "vm.max_map_count=524288" | sudo tee -a /etc/sysctl.d/99-app.conf >/dev/null

mkdir -p /var/lib/app                          # no error if it exists
id orders &>/dev/null || useradd --system orders
ln -sfn /opt/app/releases/v42 /opt/app/current # replace the symlink atomically
```

When most of a script is "ensure this state exists", that's a sign to use [Ansible](../../ansible/index.md) instead.

## Retries With Backoff

```bash
retry() {
  local attempts=$1; shift
  local delay=2 n
  for (( n = 1; n <= attempts; n++ )); do
    if "$@"; then
      return 0
    fi
    (( n == attempts )) && break
    log WARN "attempt $n/$attempts failed: $*; retrying in ${delay}s"
    sleep "$delay"
    delay=$(( delay * 2 ))
  done
  log ERROR "giving up after $attempts attempts: $*"
  return 1
}

retry 5 curl -fsS --max-time 10 https://registry.example.com/v2/
```

Retry only operations that are safe to repeat, and always bound the number of attempts and the per-attempt timeout.

## Cleanup With Traps

```bash
trap cleanup EXIT                 # runs on normal exit, errors under set -e, and most signals
TMP_DIR=$(mktemp -d)              # unique, private temporary directory
```

- Use `mktemp`, never fixed paths like `/tmp/work`, which collide between runs and can be abused by other users.
- `trap ... EXIT` covers the error paths that manual cleanup at the end of a script misses.
- Use `--` before filenames in `rm`, `mv`, and `cp`, so a filename starting with `-` isn't read as an option.

## Scheduling It

Prefer a systemd timer so runs, failures, and logs are visible — see [systemd timers](../linux/03-systemd-and-journald.md#timers-instead-of-cron). With cron, capture output and use the lock:

```text title="/etc/cron.d/rotate-backups"
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
15 3 * * * backup /usr/local/bin/rotate-backups.sh -d /backup/db -k 14 >>/var/log/rotate-backups.log 2>&1
```

## Common Mistakes

- No locking, so cron starts a second copy while the first is still running.
- `rm -rf "$DIR/"*` without validating `DIR`, turning an empty variable into a disaster.
- Logging to stdout in scripts whose stdout is piped into another tool.
- Returning `0` from every failure path, so callers and monitoring think everything worked.
- Retrying non-idempotent operations, such as creating a resource or charging a payment, blindly.
- Fixed temporary file paths shared between runs and users.

## Interview Questions

- How do you stop two copies of a cron script from running at the same time?
- What makes a script idempotent? Give an example of a non-idempotent line and fix it.
- Why should a script log to stderr?
- How would you add a dry-run mode to an existing script?
- When would you stop writing Bash and switch to Python or Ansible?

## Next

You've finished Shell Scripting. Continue to [Networking](../networking/index.md), or move on to [Python Automation](../python/index.md) for tasks that outgrow shell.
