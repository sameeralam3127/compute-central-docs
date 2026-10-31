---
title: "Build an AI Incident Triage Agent With Structured Reports"
icon: lucide/siren
description: "A hands-on lab: build an AI agent that investigates a production incident with read-only tools and returns a structured triage report through a strict tool schema. Least privilege, red herrings, and evidence."
tags:
  - AI
  - Agents
  - SRE
  - Lab
---

# Lab 6: Incident Triage Agent

## What You'll Learn

- How to get a structured final answer from an agent, instead of parsing prose
- How a task prompt that asks the agent to rule things out improves the result
- How to apply least privilege to an agent that runs during an incident
- How to read a triage report critically

## Why This Matters

During an incident, a paragraph of confident text is hard to use. You want the same fields every time: what happened, the likely cause, how sure the agent is, and the evidence, with file and line, so a human can check it in seconds. You also want to be certain the agent didn't change anything while it looked.

## Step 1: A Report Tool as the Final Answer

Save this as `triage.py`, next to `agent.py` and `tools.py` from Lab 2:

```python title="triage.py"
"""Incident triage: investigate, then hand back a structured report."""

import json
import sys

from agent import run_agent
from tools import TOOLS

REPORT_TOOL = {
    "name": "submit_report",
    "description": "Submit the final triage report. Call this exactly once, when the investigation is done. "
    "Every claim in the report must be backed by an evidence entry.",
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {
            "summary": {"type": "string", "description": "Two sentences an incident commander can read aloud"},
            "root_cause": {"type": "string", "description": "The most likely root cause, or 'unknown'"},
            "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
            "evidence": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": "string"},
                        "line": {"type": "integer"},
                        "observation": {"type": "string"},
                    },
                    "required": ["file", "line", "observation"],
                    "additionalProperties": False,
                },
            },
            "next_steps": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["summary", "root_cause", "confidence", "evidence", "next_steps"],
        "additionalProperties": False,
    },
}

TASK = """The alert in ALERT.txt just fired. Investigate the checkout service and find the root cause.
Check what changed recently, and rule out at least one other explanation before you decide.
Do not restart anything. When you are done, call submit_report."""


def triage(task=TASK, approve=lambda name, args: False, log=print):
    # In triage the agent may only look. Any change request is declined automatically.
    return run_agent(task, tools=TOOLS + [REPORT_TOOL], approve=approve, stop_on="submit_report", log=log)


if __name__ == "__main__":
    result = triage()
    print(f"\n--- {result['status']} after {result['steps']} steps, {result['tokens']:,} tokens ---")
    if result["report"] is None:
        print("No report. The agent stopped with:", result["answer"] or result["status"])
        sys.exit(1)
    print(json.dumps(result["report"], indent=2))
```

Three decisions in this file:

**The final answer is a tool call.** The agent finishes by calling `submit_report`, and the loop stops there (`stop_on="submit_report"`). With `"strict": True`, the report always matches the schema: `confidence` is one of three values, and every evidence entry has a file, a line, and an observation. Your code reads `result["report"]` as a dict, with no regex over prose.

**The task asks for disconfirmation.** "Rule out at least one other explanation" is the most useful sentence in the prompt. Without it, agents tend to stop at the first plausible cause. Here, the first plausible cause is a trap: a "slow call to payments-api" warning appears both before and after the incident.

**Changes are declined, but the tool stays.** `approve=lambda name, args: False` declines every `restart_service` call automatically. The tool stays in the list on purpose. An agent that *tries* to restart something during triage is behaving wrongly, and Lab 7 counts those attempts. In production you'd remove the tool entirely. Lab 8 makes that change.

## Step 2: Run It

```bash
python make_workspace.py
python triage.py
```

A typical run, with the `->` tool output lines removed:

```text
[step 1] list_files {'path': '.'}
[step 2] read_file {'path': 'ALERT.txt', 'start_line': 1, 'max_lines': 50}
[step 2] search_files {'pattern': 'error|warn|timed out', 'path': 'logs'}
[step 3] read_file {'path': 'deploys.json', 'start_line': 1, 'max_lines': 50}
[step 3] read_file {'path': 'config/checkout.env', 'start_line': 1, 'max_lines': 50}
[step 3] read_file {'path': 'metrics.json', 'start_line': 1, 'max_lines': 100}
[step 4] submit_report {...}

--- reported after 4 steps, 31,870 tokens ---
{
  "summary": "Checkout has returned 503s since 14:04 because requests time out waiting for a database connection. Release 2.14.0 at 14:02 cut the connection pool from 20 to 5.",
  "root_cause": "Release 2.14.0 reduced DB_POOL_SIZE from 20 to 5, exhausting the pool under normal load.",
  "confidence": "high",
  "evidence": [
    {
      "file": "deploys.json",
      "line": 10,
      "observation": "2.14.0 changed DB_POOL_SIZE 20 -> 5 at 14:02"
    },
    {
      "file": "logs/checkout.log",
      "line": 9,
      "observation": "acquire connection timed out (in_use=5 size=5)"
    },
    {
      "file": "metrics.json",
      "line": 19,
      "observation": "postgres connections in use dropped from 15 to 5 at 14:03"
    },
    {
      "file": "logs/checkout.log",
      "line": 3,
      "observation": "slow payments-api calls appear before the incident too, so they are not the cause"
    }
  ],
  "next_steps": [
    "Roll back 2.14.0 or set DB_POOL_SIZE=20",
    "Add an alert on pool wait time"
  ]
}
```

Check the evidence yourself. Open each cited file at each cited line. A report you can't verify in a minute is a report you shouldn't act on.

## Step 3: A Different Incident

The same agent, a different root cause:

```bash
python make_workspace.py --scenario disk-full
python triage.py
```

This time there's no recent deploy, the database metrics are flat, and the logs say `no space left on device`. A good run says so, and its evidence includes `metrics.json` showing the disk at 100%.

Run each scenario three times. Do the reports agree? Is `confidence` ever `high` when the evidence is thin? That's the question Lab 7 turns into numbers.

## Step 4: Swap in Real Tools

The workspace is a stand-in. To point the agent at real systems, replace the tool functions and keep everything else:

| Lab tool | Real equivalent | Keep it read-only with |
|---|---|---|
| `search_files` on `logs/` | Loki, Elasticsearch, or CloudWatch Logs query | A query-only API token |
| `read_file` on `deploys.json` | Deploy history from Argo CD, GitHub, or Spinnaker | A token without deploy permissions |
| `read_file` on `metrics.json` | A PromQL range query | Read access to Prometheus only |
| `read_file` on `config/` | `kubectl get configmap -o yaml` | A ServiceAccount bound to a `view` role |

Keep the same output caps, error results, and path or namespace checks from Lab 2. Real systems return far more data than the lab files.

## What Most Engineers Miss

- **Confidence is self-reported.** The model's `"high"` is a claim, not a probability. Check it against outcomes in Lab 7 before anyone relies on it.
- **The agent is fastest at ruling things out.** In real incidents, "it's not the database, not DNS, not the last deploy" saves more time than a guessed root cause. Ask for that explicitly.
- **Triage and remediation are different jobs.** Give them different agents, different credentials, and different approval rules. A triage agent that can also restart pods turns every confusing log line into a potential outage.
- **Write the report for the incident channel.** The summary field gets pasted into Slack at 3 a.m. Two sentences, no hedging, and a pointer to the evidence.

!!! quiz "Structured output"
    Why end the run with a `submit_report` tool call instead of asking for JSON in the final message?

    - [ ] Tool calls are cheaper than text
    - [x] With a strict schema, the report always has the required fields and types, so code can use it without parsing prose
    - [ ] The model can't write JSON in a text response

    The schema turns "please format your answer like this" into a guarantee.

!!! quiz "Least privilege"
    A triage agent needs to read pod logs and events in one namespace. Which credentials should it get?

    - [ ] The on-call engineer's kubeconfig, since they're on call anyway
    - [ ] cluster-admin, so it never hits a permission error mid-incident
    - [x] A ServiceAccount with a `view` Role in that namespace

    Scope the credentials to the job. A permission error is a safe failure; a mistaken write isn't.

## Common Mistakes

- Parsing the root cause out of free text with regular expressions.
- Asking "what's the root cause?" without asking the agent to rule out alternatives.
- Giving a triage agent write access "just in case".
- Trusting `confidence` before measuring how often high-confidence reports are right.
- Acting on a report without opening the evidence it cites.

## Interview Questions

- How would you get reliable, structured output from an agent?
- An AI triage agent named the wrong root cause with high confidence. How do you find out why, and how do you prevent it?
- What permissions would you give an incident triage agent in Kubernetes, and how would you enforce them?
- Why might you split triage and remediation into separate agents?

## Next

Continue to [Lab 7: Evaluate Your Agent](07-evaluating-your-agent.md).
