---
title: "Git for DevOps: Internals, Workflows, Branching, and Recovery"
icon: lucide/git-branch
description: "Git the way DevOps teams use it — how Git stores history, daily workflows, branching strategies, safe recovery, and repository hygiene."
tags:
  - Git
  - Overview
---

# Git and Branching

Git is the front door to modern delivery. A push triggers CI, a merge deploys through GitOps, and a revert is often the fastest rollback you have. This track builds a mental model of how Git stores history, so commands stop feeling like magic, and then covers the workflows and recovery skills teams rely on.

## What You'll Learn

- How commits, trees, blobs, branches, and `HEAD` actually work
- A clean daily workflow with rebasing, pushing, and pull requests
- How to choose a branching strategy that fits your delivery model
- How to undo almost anything — and recover "lost" work with the reflog
- How to keep repositories healthy: commit conventions, hooks, protected branches, and secrets

## Read in This Order

1. [How Git Works](01-how-git-works.md) — objects, the staging area, refs, `HEAD`, and what a branch really is
2. [Everyday Workflow](02-everyday-workflow.md) — configuration, branching, committing, rebasing vs merging, and pushing safely
3. [Branching Strategies](03-branching-strategies.md) — trunk-based development, GitHub flow, GitFlow, release branches, and merge methods
4. [Undo and Recovery](04-undo-and-recovery.md) — `restore`, `reset`, `revert`, `reflog`, `cherry-pick`, `stash`, and `bisect`
5. [Collaboration and Repository Hygiene](05-collaboration-and-repository-hygiene.md) — commit messages, signed commits, pre-commit hooks, rulesets, large files, and leaked secrets

## Commands by Situation

| I want to… | Command |
|---|---|
| See what changed | `git status`, `git diff`, `git diff --staged` |
| Start new work | `git switch -c feature/login main` |
| Update my branch with main | `git fetch && git rebase origin/main` |
| Undo uncommitted changes to a file | `git restore path/to/file` |
| Fix the last commit | `git commit --amend` |
| Undo a pushed commit | `git revert <sha>` |
| Find a lost commit | `git reflog` |
| Find which commit broke something | `git bisect` |

## How Git Connects to the Rest of the Site

- [CI/CD Pipelines](../../cicd/index.md) run on pushes and pull requests.
- [ArgoCD and GitOps](../../cicd/argocd.md) deploy whatever is committed to a config repository.
- [Terraform in CI](../../terraform/testing-and-ci.md) plans on pull requests and applies on merge.

## Next

Start with [How Git Works](01-how-git-works.md).
