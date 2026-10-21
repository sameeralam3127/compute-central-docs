---
title: "Python for DevOps Automation: CLIs, APIs, AWS, and Testing"
icon: lucide/code-xml
description: Learn Python for DevOps and SRE automation — project setup with uv, CLI tools and subprocess, HTTP APIs with retries, AWS with boto3, config files, and testing.
tags:
  - Python
  - Automation
  - Overview
---

# Python Automation

Shell is the right tool for gluing commands together. When a task needs to call APIs, paginate, retry, parse structured data, or be tested properly, Python is usually the next step. This track teaches Python the way operations teams use it: small, reliable tools that run unattended in cron jobs, CI pipelines, and Lambda functions.

## What You'll Learn

- How to set up a Python project with reproducible dependencies using `uv`
- How to build command-line tools that run other programs safely
- How to call HTTP APIs with timeouts, retries, and pagination
- How to automate AWS with boto3, safely and at scale
- How to read and write YAML, JSON, and templated config files
- How to lint, type-check, test, and package your tools

## Prerequisites

Basic Python syntax — variables, functions, loops, dictionaries, and exceptions. If you're new to Python, work through the official [Python tutorial](https://docs.python.org/3/tutorial/) first. Examples use **Python 3.14** and work on 3.12 and newer.

## Read in This Order

1. [Project Setup](01-project-setup.md) — installing Python with `uv`, virtual environments, `pyproject.toml`, lock files, and project layout
2. [CLI Tools and subprocess](02-cli-tools-and-subprocess.md) — Typer and argparse, running commands safely, logging, and exit codes
3. [Working With HTTP APIs](03-working-with-http-apis.md) — `httpx`, timeouts, retries with backoff, pagination, authentication, and rate limits
4. [AWS Automation With boto3](04-aws-automation-with-boto3.md) — sessions and credentials, paginators, waiters, error handling, and real cleanup scripts
5. [Files, Config, and Templates](05-files-config-and-templates.md) — `pathlib`, JSON, YAML, TOML, Jinja2, and atomic writes
6. [Testing, Linting, and Packaging](06-testing-linting-and-packaging.md) — pytest, mocking HTTP and AWS, Ruff, mypy, CI, and installable tools

## What You'll Build

By the end of the track you'll have an `opsctl` command-line tool that:

- Checks service health endpoints with retries and a clear exit code
- Finds unattached EBS volumes and old snapshots across AWS regions, with a dry-run mode
- Renders environment-specific configuration from YAML and a template
- Has tests that run without network access or an AWS account

## Next

Start with [Project Setup](01-project-setup.md).
