---
title: "Shell Script Testing: ShellCheck, shfmt, Bats, and Debugging"
icon: lucide/bug
description: Make Bash scripts reliable — lint with ShellCheck, format with shfmt, write Bats unit tests, trace with set -x, and run all of it in pre-commit and CI.
tags:
  - Shell
  - Bash
  - Testing
---

# Testing, Linting, and Debugging Shell Scripts

## What You'll Learn

- How ShellCheck catches the bugs that break scripts in production
- How to format scripts consistently with `shfmt`
- How to write unit tests for Bash functions with Bats
- How to debug a failing script, and run all these checks in pre-commit and CI

## Why Shell Needs Tooling

Shell has no compiler to warn you. An unquoted variable, a missing `local`, or a typo in a variable name only fails when a real filename has a space, or when a variable happens to be empty — often on the one server that matters. Linting and tests find those failures on your laptop.

## ShellCheck

```bash
sudo apt install -y shellcheck     # macOS: brew install shellcheck
shellcheck deploy.sh
```

```bash title="cleanup.sh — before"
#!/usr/bin/env bash
dir=$1
cd $dir
rm -rf $TMP_DIR/*
for f in $(ls *.log); do
  gzip $f
done
```

```text
In cleanup.sh line 3:
cd $dir
^-----^ SC2164: Use 'cd ... || exit' in case cd fails.
   ^--^ SC2086: Double quote to prevent globbing and word splitting.

In cleanup.sh line 4:
rm -rf $TMP_DIR/*
       ^------^ SC2115: Use "${var:?}" to ensure this never expands to /* .

In cleanup.sh line 5:
for f in $(ls *.log); do
         ^---------^ SC2045: Iterating over ls output is fragile. Use globs.
```

Line 4 is the dangerous one: if `TMP_DIR` is unset, the command becomes `rm -rf /*`.

```bash title="cleanup.sh — after"
#!/usr/bin/env bash
set -euo pipefail

dir=${1:?usage: cleanup.sh DIR}
cd "$dir"
rm -rf "${TMP_DIR:?TMP_DIR must be set}"/*
for f in ./*.log; do
  [[ -e $f ]] || continue
  gzip "$f"
done
```

### Silencing a warning deliberately

When a warning is intentional, disable it on that line with a reason, not globally:

```bash
# Word splitting is intended: EXTRA_ARGS holds multiple flags
# shellcheck disable=SC2086
docker run $EXTRA_ARGS "$IMAGE"
```

A `.shellcheckrc` in the repository sets shared defaults:

```ini title=".shellcheckrc"
shell=bash
enable=require-variable-braces
external-sources=true
```

## shfmt

```bash
go install mvdan.cc/sh/v3/cmd/shfmt@latest     # or: brew install shfmt
shfmt -d -i 2 -ci scripts/                     # show a diff
shfmt -w -i 2 -ci scripts/                     # rewrite in place
```

Consistent formatting keeps diffs small and reviews focused on behavior.

## Unit Tests With Bats

[Bats](https://github.com/bats-core/bats-core) runs test files written in Bash.

Structure scripts so functions can be tested without running `main`:

```bash title="lib/disk.sh"
#!/usr/bin/env bash

# Print "OK", "WARN", or "CRIT" for a disk usage percentage.
disk_status() {
  local used=$1 warn=${2:-80} crit=${3:-90}
  if (( used >= crit )); then echo "CRIT"
  elif (( used >= warn )); then echo "WARN"
  else echo "OK"
  fi
}

main() {
  local used
  used=$(df --output=pcent / | tail -1 | tr -dc '0-9')
  disk_status "$used"
}

# Run main only when executed, not when sourced by tests
if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
  main "$@"
fi
```

```bash title="test/disk.bats"
#!/usr/bin/env bats

setup() {
  source "${BATS_TEST_DIRNAME}/../lib/disk.sh"
}

@test "below the warning threshold is OK" {
  run disk_status 42
  [ "$status" -eq 0 ]
  [ "$output" = "OK" ]
}

@test "at the warning threshold is WARN" {
  run disk_status 80
  [ "$output" = "WARN" ]
}

@test "custom thresholds are respected" {
  run disk_status 75 70 95
  [ "$output" = "WARN" ]
}

@test "at the critical threshold is CRIT" {
  run disk_status 90
  [ "$output" = "CRIT" ]
}
```

```bash
sudo apt install -y bats        # or: npm install -g bats
bats test/
```

```text
disk.bats
 ✓ below the warning threshold is OK
 ✓ at the warning threshold is WARN
 ✓ custom thresholds are respected
 ✓ at the critical threshold is CRIT

4 tests, 0 failures
```

### Testing scripts that call other commands

Put fake commands earlier in `PATH` so tests don't touch real systems:

```bash title="test/restart.bats"
setup() {
  export PATH="${BATS_TEST_TMPDIR}/bin:$PATH"
  mkdir -p "${BATS_TEST_TMPDIR}/bin"
  # Fake systemctl that records its arguments and reports the service as failed
  cat > "${BATS_TEST_TMPDIR}/bin/systemctl" <<'EOF'
#!/usr/bin/env bash
echo "$*" >> "${BATS_TEST_TMPDIR}/calls"
[[ $1 == is-active ]] && exit 3
exit 0
EOF
  chmod +x "${BATS_TEST_TMPDIR}/bin/systemctl"
}

@test "restarts a service that is not active" {
  run ./restart-if-down.sh orders-api
  [ "$status" -eq 0 ]
  grep -q "restart orders-api" "${BATS_TEST_TMPDIR}/calls"
}
```

## Debugging a Failing Script

```bash
bash -n deploy.sh                 # syntax check only, runs nothing
bash -x deploy.sh staging         # trace every command as it runs
```

Trace only the suspicious section, with file, line, and function in every line:

```bash
export PS4='+ ${BASH_SOURCE##*/}:${LINENO}:${FUNCNAME[0]:-main}: '
set -x
rollout_service "$service"
set +x
```

```text
+ deploy.sh:42:rollout_service: kubectl rollout status deployment/orders-api --timeout=120s
```

Report exactly where a strict-mode script died:

```bash
trap 'echo "error: ${BASH_SOURCE[0]}:${LINENO}: \"${BASH_COMMAND}\" exited $?" >&2' ERR
```

!!! warning "Don't trace secrets"
    `set -x` prints expanded variables, including tokens and passwords. Turn tracing off around lines that use credentials, and never enable it globally in CI jobs that handle secrets.

## Run the Checks Automatically

### pre-commit

```yaml title=".pre-commit-config.yaml"
repos:
  - repo: https://github.com/shellcheck-py/shellcheck-py
    rev: v0.11.0.1
    hooks:
      - id: shellcheck
  - repo: https://github.com/scop/pre-commit-shfmt
    rev: v3.14.1-1
    hooks:
      - id: shfmt
        args: [-i, "2", -ci]
```

```bash
pipx install pre-commit
pre-commit install
pre-commit run --all-files
```

Run `pre-commit autoupdate` to move the hooks to their latest releases.

### GitHub Actions

```yaml title=".github/workflows/shell.yml"
name: Shell scripts
on: [push, pull_request]

permissions:
  contents: read

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: Install tools
        run: sudo apt-get update && sudo apt-get install -y shellcheck bats
      - name: ShellCheck
        run: shellcheck scripts/*.sh lib/*.sh
      - name: Bats
        run: bats test/
```

## Common Mistakes

- Skipping ShellCheck because "it's just a small script" — small scripts run as root in cron too.
- Blanket `# shellcheck disable` at the top of a file instead of fixing or justifying individual lines.
- Writing scripts as one long top-level block, so nothing can be tested without running everything.
- Tests that call real `kubectl`, `aws`, or `systemctl` and change real systems.
- Leaving `set -x` on in scripts that handle secrets, leaking them into CI logs.

## Interview Questions

- What kinds of bugs does ShellCheck catch that a quick manual test misses?
- How would you structure a Bash script so its functions can be unit tested?
- How do you test a script that calls `systemctl` without touching a real system?
- A cron script fails silently every night. How do you debug it?

## Next

Continue to [Production-Ready Scripts](04-production-ready-scripts.md).
