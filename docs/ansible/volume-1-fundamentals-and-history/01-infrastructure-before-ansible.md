---
icon: lucide/history
description: What server automation looked like before Ansible — shell scripts, Perl and Python automation, Puppet, Chef, CFEngine, Salt, Fabric — and why each one wasn't enough on its own.
tags:
  - Ansible
  - Volume 1
  - History
---

# Part 1 — Infrastructure Before Ansible

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

Before you can appreciate why Ansible is designed the way it is, you have to understand the pain it was responding to. This chapter is a tour of server automation from the 1990s through the early 2010s — not as trivia, but as the set of design lessons Ansible's creators inherited.

## Why This Exists

- This chapter exists to establish the *baseline* the rest of the series keeps comparing against — every later "why Ansible does X" answer eventually traces back to a tool described here.

## Problem Statement

- What happens when a company has 5 servers configured by hand. What happens at 50. What happens at 5,000.
- The core failure modes to name explicitly: **configuration drift** (servers that were once identical slowly diverging), **snowflake servers** (a server so hand-tuned nobody can safely rebuild it), and **manual deployment problems** (deploys that only work because one engineer remembers the undocumented steps).

## History / Context

- **Shell scripts**: the first form of automation — fast to write, fragile to maintain, no idempotency, no state model, painful error handling (`set -e`, trap handling, silent partial failures).
- **Perl automation**: why Perl (CPAN, text processing, ubiquity on Unix admin boxes in the 1990s–2000s) was the sysadmin's language before Python took over; tools like cfengine's early competitors and ad hoc Perl toolchains.
- **Python automation**: Fabric and hand-rolled `paramiko`/`subprocess` scripts — powerful but bespoke; every team reinvented SSH orchestration.
- **CFEngine** (1993, Mark Burgess): the first tool to introduce *convergence* and promise theory — the intellectual ancestor of "desired state." Agent-based, C-based, extremely fast but with a steep learning curve.
- **Puppet** (2005): declarative, resource-graph model, Ruby DSL, client-server with certificates, pull-based agents. Explain the resource/catalog/agent-run model and why it required an agent and a master.
- **Chef** (2009): "infrastructure as code" taken further into a full Ruby DSL (recipes/cookbooks), more imperative-feeling despite convergence underneath, also agent-based with a server (Chef Server) or masterless (chef-solo).
- **Salt** (2011): ZeroMQ-based, very fast pub/sub agent architecture, remote execution *and* configuration management in one tool — closest ideological cousin to Ansible but still agent-first by default.
- **Fabric** (2009): Python + SSH task runner — no state model at all, essentially "SSH for-loops with nice syntax." Important because it's the direct ancestor of Ansible's "just SSH there and run something" instinct, minus idempotency.

## Internal Architecture (compare-and-contrast table)

- A comparison table across CFEngine / Puppet / Chef / Salt / Fabric on: agent vs. agentless, push vs. pull, language (DSL/Ruby/Python), transport, state model, learning curve.

## Workflow

- Walk through "add a new web server" under a pure shell-script world vs. a Puppet-agent world, to make the operational pain (and the agent-management burden) concrete.

## Production Best Practices (of that era)

- Why teams built elaborate shell-script libraries and internal "cookbooks" of institutional knowledge to survive without any of this tooling.

## Common Mistakes

- Treating shell scripts as if they were idempotent (running them twice and getting different results).
- Manually patching a "special" server and never writing down what was done — the snowflake-server trap.

## Performance Considerations

- Agent-based tools (Puppet, Chef, CFEngine, Salt) needed constant agent processes/daemons running on every node, plus a master/server tier to scale — real infrastructure cost before a single line of automation logic runs.

## Security Considerations

- Certificate management overhead in Puppet/Chef master-agent trust models; the attack surface of an always-on agent daemon versus an on-demand SSH connection.

## Interview Questions

- "What is configuration drift, and how did tools before Ansible try to prevent it?"
- "Compare push-based and pull-based configuration management."
- "Why is an agent-based architecture harder to bootstrap than an agentless one?"

## Hands-On Lab

- A short guided exercise: write a plain shell script that installs and configures nginx on two servers, run it twice, and observe that it is not actually idempotent (e.g., it appends to a config file twice). Sets up the idempotency discussion in later chapters.

## Summary

- Every pre-Ansible tool solved *part* of the problem — state modeling, or remote execution, or speed — but each added its own operational cost (an agent, a master, a DSL to learn). That gap is exactly what Ansible was built to close.

## Next

Continue to [Part 2 — Michael DeHaan and the Birth of Ansible](02-michael-dehaan-and-the-birth-of-ansible.md).
