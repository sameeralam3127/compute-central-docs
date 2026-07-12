---
icon: lucide/git-compare
description: Imperative vs. declarative vs. procedural automation, desired state, idempotency, and state reconciliation — compared across shell scripts, Terraform, Ansible, and Kubernetes.
tags:
  - Ansible
  - Volume 1
  - Idempotency
---

# Part 5 — Declarative vs. Imperative

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

This is the single most important mental model in the entire series. Idempotency, reconciliation, and "safe to re-run" all trace back to the declarative/imperative distinction covered here.

## Why This Exists

- Almost every confusing Ansible behavior a beginner hits ("why didn't this task change anything the second time?") is really a declarative-model question in disguise.

## Problem Statement

- **Imperative**: "do these steps, in this order" — the script doesn't know or care about the current state, it just executes.
- **Declarative**: "make the system look like this" — the tool figures out what needs to change to get there.
- **Procedural**: a related but distinct axis (control flow — loops, conditionals, functions) that can exist inside either style.
- **Desired state**: the declarative target description itself (e.g., "package X is present, version Y").
- **Idempotency**: running the same operation multiple times produces the same end state as running it once, with no unwanted side effects on repeat runs.
- **State reconciliation**: the loop of compare-current-state-to-desired-state, then act only on the difference — the mechanism that makes idempotency possible.

## History / Context

- Imperative shell scripting was the default because it's how programming already worked (sequential commands) — declarative configuration management (starting with CFEngine's promise theory) was a deliberate departure that took years to become mainstream operational practice.

## Internal Architecture

- How Ansible modules implement this in practice: most modules check current state first (e.g., `package` checks if it's already installed) and only act if there's a difference — this is why modules, not playbooks, are where idempotency is actually implemented.
- Contrast with **Terraform**: state file + plan/apply diffing against a provider API is a stronger, more explicit reconciliation model than Ansible's per-task, stateless checks.
- Contrast with **Kubernetes**: continuous reconciliation via controllers/operators watching a desired-state object (a Deployment spec) and constantly correcting drift — declarative *and* continuously enforced, unlike Ansible's run-on-demand model.

## Workflow

- Side-by-side worked example: "ensure nginx is installed and running" implemented as (a) a raw shell script, (b) a Terraform resource (where applicable), (c) an Ansible playbook, (d) a Kubernetes Deployment — showing what happens when each is run twice.

## Step-by-Step Explanation

- Walk through what "changed" vs. "ok" actually means in Ansible task output, and how that maps to the check-then-act pattern inside a module.

## Production Best Practices

- Writing playbooks so they are safe to re-run in production (avoiding `command`/`shell` tasks that aren't naturally idempotent, using `creates`/`removes` guards or `changed_when` when you must use them).

## Common Mistakes

- Assuming `shell`/`command` module tasks are automatically idempotent (they are not — they run every time unless guarded).
- Writing playbooks that only work correctly the *first* time they're run.

## Performance Considerations

- Declarative reconciliation with real state diffing (Terraform, Kubernetes) can be more efficient at scale than Ansible's approach of re-checking every task's state on every run — a tradeoff explored further in Volume 6's performance chapter.

## Security Considerations

- Idempotent, declarative automation reduces the risk of "run it again to fix it" habits that can mask underlying drift or unauthorized manual changes going undetected.

## Interview Questions

- "What does idempotency mean in the context of configuration management, and why does it matter operationally?"
- "How does Ansible's approach to state reconciliation differ from Terraform's or Kubernetes'?"
- "Give an example of a non-idempotent Ansible task and how you'd fix it."

## Hands-On Lab

- Write a `shell`-module task that appends a line to a config file, run the playbook twice, and observe the file grows each time. Then rewrite it using `lineinfile` and observe the second run reports "ok" with no change.

## Summary

- Declarative, idempotent automation is what makes "just run the playbook again" a safe default instead of a gamble — this principle underlies almost every design choice covered in the rest of this series.

## Next

Continue to [Part 6 — Installing Ansible](06-installing-ansible.md).
