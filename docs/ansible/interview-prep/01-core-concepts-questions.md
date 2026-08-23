---
icon: lucide/message-circle-question
description: Leveled Ansible interview questions on idempotency, variable precedence, modules, and command vs. shell — with detailed answers, common misconceptions, and senior follow-ups.
tags:
  - Ansible
  - Interview Preparation
---

# Interview Prep: Core Concepts

## What is idempotency, and why does it matter operationally?

**Short answer:** Running the same operation multiple times produces the same end state as running it once — no duplicated side effects on repeat runs.

**Detailed:** Ansible modules follow a check-then-act pattern: compare current state to desired state, and only change what actually differs. This is what makes "just run the playbook again" a safe default in production instead of a gamble. Full mental model: [Idempotency](../core-concepts/11-idempotency.md).

**Common misconception:** That playbooks are idempotent. They're not — **modules** are (or aren't); a playbook is only as idempotent as the modules its tasks call. A `shell` task inside an otherwise-idempotent playbook is still not idempotent.

**Senior follow-up:** "How would you audit an existing 300-task playbook for non-idempotent tasks without reading every line by hand?" — run it twice and diff the `changed` counts in the recap; any task reporting `changed` on the second run of an unmodified target is a candidate.

## What is Ansible's variable precedence order, from highest to lowest?

**Short answer:** `-e` (extra vars) highest, role `defaults/main.yml` lowest, with task vars, block vars, role vars, `set_fact`/registered, play vars, `host_vars`, `group_vars`, inventory vars, and facts in between.

**Detailed:** Full order and the reasoning behind it (broad/overridable at the bottom, narrow/deliberate at the top): [Variable Precedence](../variables-and-data/02-variable-precedence.md).

**Common misconception:** That `group_vars` beats role `vars/main.yml` — it's the opposite; role `vars` (not `defaults`) outranks `group_vars`.

**Senior follow-up:** "Two roles are included in the same play and each defines a `defaults/main.yml` value for a same-named variable — which wins, and why is that a design smell?" — the *last*-included role's default typically applies in practice due to load order, but the real answer is that unnamespaced role variables colliding at all is the actual problem; see [Role Variables and Interfaces](../roles/02-role-variables-and-interfaces.md).

## What is the check-then-act pattern, and which layer implements it — the playbook or the module?

**Short answer:** The **module**. A playbook just calls modules in order; whether a given call is safe to re-run depends entirely on whether that module checks state before acting.

**Detailed:** See [Modules](../core-concepts/04-modules.md) for the mechanism, and [Build a Custom Module](../build-your-own/01-build-a-custom-module.md) for what implementing it actually looks like in code.

**Senior follow-up:** "You've written a custom module — what specifically makes it check-mode-safe, beyond declaring `supports_check_mode=True`?" — the code must explicitly branch on `module.check_mode` and skip the actual write; declaring support without honoring it is worse than not supporting it, because it looks safe and isn't.

## What's the practical difference between `command` and `shell`?

**Short answer:** `command` runs a program directly with no shell involved — no pipes, redirects, or injection risk from shell metacharacters. `shell` runs the argument through `/bin/sh`, enabling shell features at the cost of injection risk.

**Detailed:** Full comparison, including `raw` and `script`, and a decision tree: [Command vs. Shell vs. Raw vs. Script](../modules/01-command-vs-shell-vs-raw-vs-script.md).

**Common misconception:** That either one is idempotent because it's "inside a playbook." Neither is, by default — both need `creates`/`removes`/`changed_when` to behave safely on a re-run.

**Senior follow-up:** "A `shell` task builds its command string from a variable that ultimately traces back to user input somewhere upstream — what's the actual risk, and how do you eliminate it, not just mitigate it?" — command injection; eliminate it by switching to `command` (no shell) or a real module, not by trying to sanitize the string.

## Next

Continue to [Architecture & Performance](02-architecture-and-performance-questions.md).
