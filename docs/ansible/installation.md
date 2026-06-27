---
icon: lucide/download
description: Install Ansible, verify the command-line tools, prepare a control node, and confirm your first automation environment is ready for practice.
tags:
  - Setup
  - Installation
---

# Ansible Installation Guide

This page gives the quickest practical ways to install Ansible on common platforms.

## Linux with `pip`

```bash
pip install ansible
```

## Ubuntu and Debian

```bash
sudo apt update
sudo apt install ansible
```

## macOS with Homebrew

```bash
brew install ansible
```

## Windows

Use Ansible inside WSL with Ubuntu or Debian. That is the most practical and widely supported setup.

## Verify the Installation

```bash
ansible --version
```

## Practical Advice

- Use one installation method per environment
- Prefer package manager installs for simple lab systems
- Prefer a controlled Python environment if you need version-specific behavior

!!! warning
Do not mix `pip` and OS package installs in the same environment unless you know exactly why.
