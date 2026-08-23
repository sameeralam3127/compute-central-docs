---
title: "Fix Ansible become Sudo Password Errors"
icon: lucide/shield-alert
description: Diagnosing Ansible become and permission failures — missing sudo password, requiretty errors with pipelining, and file permission failures after a successful connection.
tags:
  - Ansible
  - Troubleshooting
---

# Become and Permission Problems

!!! info "Section status: outline"
    This page is scoped but not yet written in full prose. The sections below define what it will cover.

## Why This Exists

SSH auth succeeding and `become` succeeding are two independent checks — a task can fail here with a working connection, and the fix is entirely different from an SSH fix.

## What It Will Cover

- `Missing sudo password` — `become_ask_pass` needed, or the remote user needs passwordless sudo configured (`NOPASSWD` in sudoers) for automation use
- `sudo: a password is required` combined with pipelining enabled — the classic `requiretty` sudoers interaction, and the fix (`Defaults !requiretty` or targeted per-command)
- A task succeeding at the SSH layer but failing with `Permission denied` on a specific file — distinguishing "the become user lacks rights to this path" from "the SSH user itself lacks rights," using `-vvv` to see exactly which user each step ran as
- `become_user` targeting a non-root service account correctly, and what breaks when a task assumes root implicitly

## Interview Questions

- A task fails with `Missing sudo password` — what are the two possible fixes, and how do you choose between them?
- Why does enabling pipelining sometimes surface a previously-hidden `become` failure?

## Next

Continue to [YAML and Variable Errors](03-yaml-and-variable-errors.md).
