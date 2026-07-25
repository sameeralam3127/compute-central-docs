---
icon: lucide/scan-search
description: Ansible facts — the setup module, ansible_facts, gather_subset, fact caching, custom facts, and how auto-discovered host data feeds into variables and conditionals.
tags:
  - Ansible
  - Volume 2
  - Facts
---

# Part 37 — Facts

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

Every play, by default, starts by asking each host a question: "what are you?" This chapter covers the answer — facts — from a usage standpoint. The internals of *how* the answer is gathered are covered separately in Volume 3.

## Why This Exists

- Facts are the lowest-effort source of real, live host data a playbook can use — no inventory maintenance required — and nearly every conditional or template in a real playbook eventually reads one. This chapter existed only as a forward-reference from [Part 9 — Variables and Precedence](03-variables-and-precedence.md) until now; it closes that gap.

## Problem Statement

- Beginners either don't know facts exist (and hardcode values a fact would have given them for free) or over-rely on them (gathering facts on every run of every play, even when nothing in the play actually reads one, adding needless latency).

## Internal Architecture

- Facts are gathered by an implicit run of the `ansible.builtin.setup` module at the start of a play, unless `gather_facts: false` is set — full mechanical trace of this in [Volume 3, Part 16](../volume-3-core-internals/02-how-ansible-executes.md).
- Gathered data lands in the `ansible_facts` namespace (and, for backward compatibility, as flattened top-level `ansible_*` variables) — both forms are shown side by side.

## Step-by-Step Explanation

- **`gather_facts`**: `true` (default), `false` to skip entirely, or `smart` at the play level to skip if facts were already gathered this run.
- **`gather_subset`**: narrowing what `setup` collects (`all`, `min`, `network`, `hardware`, `virtual`, `!all` exclusions) to cut gathering time on large fleets.
- **Common facts used in real playbooks**: `ansible_distribution`/`ansible_distribution_version` (OS branching), `ansible_default_ipv4`, `ansible_memtotal_mb`, `ansible_hostname` vs. `inventory_hostname`.
- **Custom facts**: `.fact` files or executable scripts under `/etc/ansible/facts.d/` on the managed node, surfaced automatically under `ansible_local`.
- **`set_fact`**: defining a fact-like variable at runtime from within a play, and how its precedence differs from a gathered fact (cross-reference to the [Part 9](03-variables-and-precedence.md) pyramid).
- **Fact caching**: backing `gather_facts` with a cache plugin (Redis, JSON file, Memcached) so repeated runs against the same host don't re-gather every time — previewed here, quantified in [Volume 6, Part 32](../volume-6-production-and-performance/02-performance-and-scaling.md).

## Production Best Practices

- Setting `gather_subset` to only what a play actually reads, instead of gathering everything by default, once a play's real dependencies are known.
- Using fact caching for any inventory large enough that fact-gathering latency is a measurable fraction of total run time.

## Common Mistakes

- Assuming `ansible_hostname` and `inventory_hostname` are always the same value — they diverge whenever a host's real hostname doesn't match its inventory name.
- Reading a fact inside a `when:` before confirming `gather_facts` wasn't disabled for that play, and getting a confusing "undefined variable" error instead of a clear fact-related one.
- Re-gathering facts on every play in a multi-play book when nothing changed on the host between plays.

## Performance Considerations

- Fact gathering is a real remote execution step with real cost (Volume 3, Part 16) — `gather_subset` scoping and fact caching are the two levers that matter, fully quantified in Volume 6.

## Security Considerations

- `setup` output can include sensitive-adjacent data (network configuration, mounted filesystems); treat verbose (`-vvv`) output containing facts with the same log-handling care as any other host data.

## Interview Questions

- "What triggers Ansible's implicit fact-gathering step, and how would you disable or scope it?"
- "What's the difference between a gathered fact and a variable set with `set_fact`?"
- "How would you speed up fact gathering across a fleet of a thousand hosts?"

## Hands-On Lab

- Run `ansible all -m setup` against a test host and find `ansible_distribution` and `ansible_default_ipv4.address` in the output; then write a one-task playbook that prints a different message depending on `ansible_distribution` using `when:`.

## Summary

- Facts are auto-discovered host data gathered by the `setup` module at the start of a play — usable directly, cacheable for performance, and extensible via custom facts — and they follow the same precedence rules as any other variable once gathered.

## Next

Continue to [Part 10 — ansible.cfg](05-ansible-cfg.md).
