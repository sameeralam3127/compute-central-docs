---
icon: lucide/shield-check
description: Learn SonarQube code quality basics, installation flow, configuration, Jenkins integration, pipeline scanning, quality gates, and practical code review checks.
tags:
  - SonarQube
  - Code Quality
  - CI/CD
---

# Code Quality Overview

SonarQube helps teams check code quality and security issues as part of normal development and CI/CD work. It is useful when you want automated feedback on bugs, vulnerabilities, code smells, duplication, and quality gates.

SonarQube is one option in a much larger market — this section also maps the surrounding ecosystem of open-source linters, security scanners, and paid SaaS platforms so you can combine them deliberately.

## What This Section Covers

- Installing SonarQube on Ubuntu
- Connecting SonarQube to PostgreSQL
- Integrating scans into Jenkins pipelines
- [Open-source tools and libraries](code-quality-ecosystem.md) — ruff, ESLint, Checkstyle, SpotBugs, Semgrep, Gitleaks, Trivy, JaCoCo, and how to wire them into CI
- [Paid and SaaS platforms](paid-platforms.md) — SonarCloud, GitHub Advanced Security (CodeQL), Snyk, Codacy, Qlty, DeepSource, Codecov, Veracode, Checkmarx

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
