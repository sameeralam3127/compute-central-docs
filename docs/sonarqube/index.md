---
icon: lucide/shield-check
description: Learn SonarQube code quality basics, installation flow, configuration, Jenkins integration, pipeline scanning, quality gates, and practical code review checks.
tags:
  - SonarQube
  - Code Quality
  - CI/CD
---

# SonarQube Code Quality Overview

SonarQube helps teams check code quality and security issues as part of normal development and CI/CD work. It is useful when you want automated feedback on bugs, vulnerabilities, code smells, duplication, and quality gates.

## What This Section Covers

- Installing SonarQube on Ubuntu
- Connecting SonarQube to PostgreSQL
- Integrating scans into Jenkins pipelines

## Why Teams Use SonarQube

- Finds quality and security issues early
- Supports many programming languages
- Adds quality gates to pull request and pipeline workflows
- Makes technical debt easier to track over time

## Recommended Flow

1. Install SonarQube
2. Configure the database and service
3. Connect Jenkins
4. Add analysis to a pipeline
5. Enforce a quality gate

## Useful Links

- [SonarQube documentation](https://docs.sonarsource.com/sonarqube/latest/)
- [SonarQube downloads](https://www.sonarsource.com/products/sonarqube/downloads/)

!!! tip
For production use, plan for enough memory, persistent storage, backups, and proper access control from the start.
