---
icon: lucide/book-open
description: Volume 1 of the Ansible book series — infrastructure history, Michael DeHaan and the origin of Ansible, what Ansible actually is, YAML, declarative thinking, and installation.
tags:
  - Ansible
  - Volume 1
---

# Volume 1: Fundamentals & History

!!! info "Volume status"
    This volume is at the outline stage. Each chapter below has its structure and scope defined; full prose is being written chapter by chapter.

## Who This Volume Is For

Readers who have never used Ansible, and possibly have limited Linux/SSH experience. No prior automation knowledge is assumed. By the end of this volume you will understand *why* Ansible looks and behaves the way it does — not just how to type the commands.

## Prerequisites

None. This is the entry point to the series. Basic comfort with a terminal helps but is not required — Chapter 6 covers installation from scratch on Linux, macOS, and Windows/WSL.

## Chapters

1. [Infrastructure Before Ansible](01-infrastructure-before-ansible.md) — shell scripts, Perl, Puppet, Chef, CFEngine, Salt, Fabric, configuration drift, and snowflake servers
2. [Michael DeHaan and the Birth of Ansible](02-michael-dehaan-and-the-birth-of-ansible.md) — who created Ansible, why, and how it evolved into Red Hat Ansible Automation Platform
3. [What Exactly Is Ansible?](03-what-exactly-is-ansible.md) — automation vs. orchestration vs. provisioning vs. configuration management vs. deployment
4. [Why YAML?](04-why-yaml.md) — YAML's history and why Ansible chose it over JSON, XML, and TOML
5. [Declarative vs. Imperative](05-declarative-vs-imperative.md) — desired state, idempotency, and reconciliation, compared across shell, Terraform, Ansible, and Kubernetes
6. [Installing Ansible](06-installing-ansible.md) — Linux, macOS, Windows/WSL, pip, pipx, virtualenv, and package managers

## What You Will Be Able to Do After This Volume

- Explain, in an interview or a design review, why Ansible is agentless and SSH-based rather than agent-based
- Read a YAML playbook fragment without being confused by indentation or anchors
- Distinguish declarative from imperative automation and say why idempotency matters operationally
- Install Ansible correctly for your platform and understand what `ansible-core` vs. the `ansible` package actually means

## Next

Continue to [Volume 2: Playbooks, Roles & Collections](../volume-2-playbooks-roles-and-collections/index.md).
