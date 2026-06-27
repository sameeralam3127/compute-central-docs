---
description: Design development, staging, and production environments with promotion flows, configuration isolation, release controls, access boundaries, and deployment safety.
---

# Multi-Environment Deployment System Design

This page covers how to think about development, staging, and production environments in a practical way.

## Why It Matters

Teams need safe places to test changes before production. Good environment design reduces release risk and makes deployments more predictable.

## Common Environments

- Development
- Test or QA
- Staging
- Production

## Basic Design Approach

1. Keep environment purpose clear.
2. Use the same deployment method across environments.
3. Promote the same artifact forward instead of rebuilding it each time.
4. Keep configuration separate from application code.

## Important Questions

- How similar is staging to production?
- How are secrets managed per environment?
- What approvals are required before production?
- How is rollback handled in each environment?

## Common Risks

- Staging too different from production
- Manual production-only steps
- Shared credentials across environments
- Different artifact versions in each stage

## Practical Advice

- Promote one tested artifact through the pipeline
- Keep environment-specific configuration external
- Use naming and tagging conventions that stay consistent
