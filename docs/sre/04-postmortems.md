---
title: "Blameless Postmortems: Timelines and Action Items"
icon: lucide/notebook-pen
description: "Write blameless postmortems — timelines, contributing factors beyond one root cause, action items that get done, a template, and reviews."
tags:
  - SRE
  - Postmortems
  - Incident Response
---

# Blameless Postmortems

## What You'll Learn

- What a blameless postmortem is, and why blame makes systems less reliable
- When a postmortem is required
- How to build a timeline and analyze contributing factors beyond a single "root cause"
- How to write action items that actually get completed
- A complete postmortem template and a review process

## Why Blameless?

People make mistakes in every complex system. If an engineer ran a command that deleted a production table, the useful questions are **why the system allowed it** and **why it seemed reasonable at the time**: no confirmation, identical-looking prompts for staging and production, credentials with far more access than needed, and no tested restore.

When postmortems assign blame, people hide mistakes, stop volunteering information, and avoid risky-but-necessary changes. Blameless doesn't mean nobody is accountable — it means accountability is expressed as **improving the system**, and the people closest to the incident are the most valuable source of information.

## When to Write One

Define triggers so it isn't a judgment call during a tense moment:

- Every SEV1 and SEV2 incident
- Any data loss, security incident, or customer-visible outage
- An incident that consumed more than a set share of an error budget (for example 20%)
- A near miss that could have been serious
- Any incident where someone asks for one

## Building the Timeline

Reconstruct from the incident channel, alerts, deploy logs, dashboards, and interviews. Use UTC and be specific.

| Time (UTC) | Event |
|---|---|
| 09:58 | `orders-api` 2.14.0 deployed to eu-west-1; canary analysis passed at 5% traffic |
| 10:00 | Rollout proceeds to 100% |
| 10:02 | Error ratio rises to 30% for checkout requests that include saved cards |
| 10:09 | `CheckoutErrorBudgetBurnFast` pages the payments on-call |
| 10:12 | Incident declared SEV2; Maria is IC |
| 10:16 | Team identifies correlation with the 10:00 rollout |
| 10:22 | Rollback started |
| 10:31 | Error ratio returns to baseline |
| 11:00 | Incident resolved after 30 minutes of stable metrics |

Two durations matter most: **time to detect** (10:02 → 10:09) and **time to mitigate** (10:09 → 10:31).

## Analyzing Contributing Factors

Complex failures rarely have a single root cause. Asking "why?" repeatedly helps, but stopping at the first human action ("the engineer deployed a bad change") explains nothing useful. Look across several dimensions:

| Question | Example findings |
|---|---|
| **What triggered it?** | A change to card tokenization in 2.14.0 |
| **Why did it cause impact?** | Saved-card requests call a code path that wasn't exercised by tests |
| **Why wasn't it caught earlier?** | Canary traffic at 5% for 2 minutes contained no saved-card checkouts; no synthetic test covers saved cards |
| **Why did detection take 7 minutes?** | Burn-rate windows need several minutes of data; acceptable, but a canary-specific SLO check would catch it before 100% |
| **Why did mitigation take 22 minutes?** | The rollback command wasn't in the runbook; the on-call engineer had to look up the deploy tooling |
| **What went well?** | Clear IC handoff; status page updated within 10 minutes; rollback was clean |

Recording **what went well** matters too — it tells you which practices to protect.

## Action Items That Get Done

Most postmortems fail at this step: action items are vague, unowned, and forgotten.

| Weak | Strong |
|---|---|
| "Improve testing" | "Add an integration test for saved-card checkout to the orders-api CI suite — owner: Priya — due 2026-09-28 — OPS-231" |
| "Be more careful with deploys" | "Extend canary analysis to require at least 200 checkout requests including 20 saved-card requests before promotion — owner: Dev — due 2026-10-05 — OPS-232" |
| "Update runbook" | "Add rollback command and deploy dashboard link to the checkout runbook — owner: Maria — due 2026-09-19 — OPS-233" |

Rules:

- **Specific and verifiable** — anyone can tell whether it's done.
- **One owner** (a person, not a team) and a **due date**.
- **Tracked in the normal backlog** with a link, not only in the document.
- **Prioritized**: which actions prevent recurrence, which improve detection, and which speed up mitigation.
- Prefer changes that **remove the possibility of failure** (guardrails, automation) over changes that rely on people remembering.

Review open postmortem action items in a regular reliability meeting, and track the completion rate.

## Postmortem Template

```markdown title="postmortem-template.md"
# Postmortem: <short, descriptive title>

**Incident:** INC-1042 · **Severity:** SEV2 · **Status:** Draft / In review / Final
**Date:** 2026-09-14 · **Authors:** · **Reviewers:**

## Summary
Two or three sentences: what happened, the impact, and how it was resolved.

## Impact
- **Users affected:** ~30% of EU checkout attempts using saved cards
- **Duration:** 29 minutes of user impact (10:02–10:31 UTC)
- **Error budget:** 18% of the 28-day checkout availability budget consumed
- **Business impact:** ~1,900 failed checkouts; support tickets: 42
- **Data loss:** None

## Timeline
| Time (UTC) | Event |
|---|---|

## Detection
How was it detected? How long did it take? Would we have detected it without the alert?

## Response and Mitigation
What was done, by whom, and what worked or didn't.

## Contributing Factors
What made this possible, and why it wasn't caught earlier. No names, no blame.

## What Went Well

## Where We Got Lucky

## Action Items
| Action | Type (prevent / detect / mitigate) | Owner | Due | Ticket |
|---|---|---|---|---|

## Lessons Learned

## Supporting Material
Links to dashboards, logs, incident channel, deploy records.
```

The **"Where we got lucky"** section surfaces risks that didn't cause harm this time: "the database failover worked, but nobody had tested it in a year".

## The Review Meeting

- Share the draft in advance; the meeting discusses, not reads.
- A facilitator who wasn't directly involved keeps the discussion blameless.
- Invite the responders, the owning team, and teams that own contributing systems.
- Focus the time on contributing factors and action items.
- Publish the final version widely. Other teams learn from your incidents — and often have the same weaknesses.

## Learning Across Incidents

Individual postmortems fix individual failures. Every quarter, look across them:

- Which contributing factors recur (config changes, missing tests, untested failover)?
- Where does time go — detection, diagnosis, or mitigation?
- Which services generate the most incidents relative to their traffic?
- What share of action items are completed on time?

These trends are strong input for planning reliability work.

## Common Mistakes

- Naming individuals as the cause, or using language like "failed to" and "should have".
- Stopping at a single root cause, usually the last human action.
- Action items like "be more careful" or "improve monitoring".
- Action items that live only in the document and are never tracked or completed.
- Writing postmortems weeks later, when details are forgotten.
- Skipping postmortems for near misses, which are the cheapest lessons available.

## Interview Questions

- What does "blameless" mean in a postmortem, and why does it matter?
- How do you analyze an incident beyond a single root cause?
- What makes a postmortem action item effective?
- Which incidents should have a postmortem?
- How would you use postmortems to improve reliability across an organization, not just one service?

## Next

Continue to [Sustainable On-Call](05-on-call.md).
