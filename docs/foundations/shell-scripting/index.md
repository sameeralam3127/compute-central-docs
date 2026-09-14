---
title: "Shell Scripting for DevOps: Bash, Text Processing, and Testing"
icon: lucide/terminal
description: Learn Bash scripting for DevOps and SRE work — safe script structure, grep, sed, awk, and jq, testing with ShellCheck and Bats, and production-ready automation.
tags:
  - Shell
  - Bash
  - Overview
---

# Shell Scripting

Shell scripts turn the commands from the [Linux track](../linux/index.md) into repeatable automation: health checks, backups, deployment helpers, log scans, and the glue steps inside CI pipelines. This track goes from safe Bash structure to scripts you can trust to run unattended on production systems.

## What You'll Learn

- How to structure Bash scripts safely with strict mode, functions, and traps
- How to slice logs, config files, and API output with `grep`, `sed`, `awk`, and `jq`
- How to lint, test, and debug scripts before they reach production
- How to add argument parsing, logging, locking, dry-run mode, and idempotency

## Read in This Order

1. [Bash Fundamentals and Practical Scripts](01-bash-fundamentals.md) — shebang and strict mode, variables, conditionals, loops, functions, traps, and six real operations scripts
2. [Text Processing](02-text-processing.md) — pipelines, `grep`, `sed`, `awk`, `sort`/`uniq`, and `jq` for JSON
3. [Testing, Linting, and Debugging](03-testing-linting-and-debugging.md) — ShellCheck, `shfmt`, Bats tests, `set -x` tracing, and scripts in CI
4. [Production-Ready Scripts](04-production-ready-scripts.md) — `getopts`, logging, exit codes, locking with `flock`, dry-run, idempotency, and retries

## Shell or Python?

| Use shell when… | Switch to Python when… |
|---|---|
| You're mostly running other commands and checking their exit codes | You parse structured data beyond a quick `jq` filter |
| The script is under ~150 lines | You need data structures, classes, or real error handling |
| It runs on minimal hosts or containers with only a shell | You call HTTP APIs, paginate, and retry |
| It's a CI step or an entrypoint wrapper | It needs unit tests with mocks, or a proper CLI |

The [Python Automation](../python/index.md) track picks up where shell stops.

## Next

Start with [Bash Fundamentals and Practical Scripts](01-bash-fundamentals.md).
