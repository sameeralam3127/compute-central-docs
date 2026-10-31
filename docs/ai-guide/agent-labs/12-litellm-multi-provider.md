---
title: "LiteLLM Tutorial: One Agent Loop Across Claude, OpenAI, and Local Models"
icon: lucide/shuffle
description: "A hands-on lab: run the same tool-using AI agent on any provider with LiteLLM. OpenAI-format tool calls, token counting, cost tracking, drop_params, and what a common interface loses."
tags:
  - AI
  - Agents
  - LiteLLM
  - Lab
---

# Lab 12: LiteLLM

## What You'll Learn

- How LiteLLM puts many model providers behind one OpenAI-style API
- How the agent loop changes in the OpenAI message format
- How to count tokens and track cost per run across providers
- What a common interface translates, and what it loses

## Why LiteLLM

Platform teams get asked to support several model providers: Claude for one team, a local model for sensitive data, another vendor for a cost experiment. LiteLLM gives them all one interface. It comes in two forms:

| | Python SDK | Proxy server |
|---|---|---|
| What it is | `litellm.completion()` in your code | An OpenAI-compatible HTTP gateway |
| Used by | One application | Every team and tool in the company |
| Adds | Provider switching, cost calculation | Virtual keys, per-team budgets, rate limits, logging, fallbacks |

This lab uses the SDK. The proxy is the same translation layer, run as a service.

## Step 1: The Loop in OpenAI Format

Save this as `litellm_agent.py`, next to `tools.py` and `agent.py` from Lab 2:

```python title="litellm_agent.py"
"""Lab 12: one agent loop, any provider, through LiteLLM's OpenAI-style interface.

    AGENT_MODEL=anthropic/claude-opus-5-5 python litellm_agent.py
    AGENT_MODEL=ollama_chat/llama3.1 python litellm_agent.py      # a local model
"""

import json
import os
import sys

import litellm

from agent import SYSTEM
from tools import TOOLS, ask_human, run_tool

MODEL = os.environ.get("AGENT_MODEL", "anthropic/claude-opus-5-5")
MAX_STEPS = 15

# LiteLLM takes tools in OpenAI's format. The JSON Schemas from Lab 2 carry over unchanged.
OPENAI_TOOLS = [
    {"type": "function",
     "function": {"name": t["name"], "description": t["description"], "parameters": t["input_schema"]}}
    for t in TOOLS
]


def run(task):
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": task}]
    cost = 0.0
    for step in range(1, MAX_STEPS + 1):
        response = litellm.completion(
            model=MODEL, messages=messages, tools=OPENAI_TOOLS, max_tokens=16000,
            reasoning_effort="medium",  # becomes output_config.effort on Claude
        )
        cost += litellm.completion_cost(completion_response=response) or 0.0
        message = response.choices[0].message
        messages.append(message.model_dump(exclude_none=True))

        if not message.tool_calls:
            return message.content, step, cost

        for call in message.tool_calls:
            args = json.loads(call.function.arguments)
            print(f"[step {step}] {call.function.name} {args}")
            content, is_error = run_tool(call.function.name, args, ask_human)
            messages.append({"role": "tool", "tool_call_id": call.id,
                             "content": f"ERROR: {content}" if is_error else content})
    return "(step limit reached)", MAX_STEPS, cost


if __name__ == "__main__":
    task = " ".join(sys.argv[1:]) or "Investigate the checkout alert. What is the root cause?"
    prompt_tokens = litellm.token_counter(model=MODEL, messages=[{"role": "user", "content": task}])
    print(f"{MODEL}: task is about {prompt_tokens} tokens")
    answer, steps, cost = run(task)
    print(f"\n--- {steps} steps, ${cost:.4f} ---\n{answer}")
```

The loop is Lab 2's loop with OpenAI's message shapes:

| Claude Messages API (Lab 2) | OpenAI format (LiteLLM) |
|---|---|
| `tools=[{"name", "description", "input_schema"}]` | `tools=[{"type": "function", "function": {"name", "description", "parameters"}}]` |
| System prompt in `system=` | First message with `"role": "system"` |
| `stop_reason == "tool_use"` | `message.tool_calls` is not empty |
| `block.input` is a dict | `call.function.arguments` is a JSON string to parse |
| `{"type": "tool_result", "tool_use_id", "content", "is_error"}` in a user message | `{"role": "tool", "tool_call_id", "content"}` message per call |
| `is_error: true` | No error flag. The lab prefixes the content with `ERROR:`. |

LiteLLM converts these to Claude's format on the way out and back on the way in. The JSON Schemas from Lab 2 work unchanged.

## Step 2: Run It on Claude

```bash
python litellm_agent.py
```

A typical run:

```text
anthropic/claude-opus-5-5: task is about 19 tokens
[step 1] list_files {'path': '.'}
[step 2] search_files {'pattern': 'error|timed out', 'path': 'logs'}
[step 3] read_file {'path': 'deploys.json', 'start_line': 1, 'max_lines': 200}

--- 4 steps, $0.1286 ---
The checkout alert fired because release 2.14.0 cut DB_POOL_SIZE from 20 to 5...
```

`litellm.completion_cost()` prices each response from LiteLLM's model price list, so you get a dollar figure per run without your own price table. Check that list when a new model comes out. A model it doesn't know yet has no price.

## Step 3: Run It on Another Provider

Change one environment variable:

```bash
# A local model with Ollama (no API key, nothing leaves your machine)
ollama pull llama3.1
AGENT_MODEL=ollama_chat/llama3.1 python litellm_agent.py

# Another hosted provider, if you have a key
export OPENAI_API_KEY="sk-..."
AGENT_MODEL=openai/<model-name> python litellm_agent.py
```

Then run each model several times and compare. Smaller local models often call tools with wrong arguments, stop early, or skip the evidence. That's exactly what the eval in Lab 7 measures. To evaluate models through LiteLLM, add Lab 6's `submit_report` tool and `stop_on` handling to this loop, return the same result dict as `run_agent`, and point `triage.py` at it.

## Step 4: Know What Gets Lost

A common interface can only offer what every provider has in common. Some Claude features translate and some don't:

| Feature | Through LiteLLM |
|---|---|
| Tool calls and JSON Schemas | Translated |
| `effort` | Pass `reasoning_effort="medium"`. LiteLLM turns it into `output_config.effort`. |
| Token usage and cost | Translated into the OpenAI `usage` shape |
| `stop_reason` values such as `refusal` and `max_tokens` | Collapsed into `finish_reason` |
| Tool error flag (`is_error`) | No equivalent in the OpenAI format |
| New API features | Available once LiteLLM supports them. In our tests, LiteLLM 1.106 still sent `anthropic-version: 2023-06-01`, not the newer `2026-10-21` that the Anthropic SDK uses. |

!!! warning "`drop_params` hides problems"
    Passing `temperature=0` to `claude-opus-5-5` through LiteLLM raises `UnsupportedParamsError` before any request is sent. Setting `litellm.drop_params = True` makes the error go away by silently removing the parameter. That's convenient in a gateway, and it means your config no longer says what actually happens. Prefer removing unsupported parameters from the config.

## Choosing an Approach

| You need | Use |
|---|---|
| One provider, newest features, least to debug | The provider's own SDK (Labs 1 to 10) |
| Several providers in one app, or fast model comparisons | The LiteLLM SDK |
| Central keys, budgets, and logging for many teams | The LiteLLM proxy, or another LLM gateway |
| Workflows, checkpoints, and middleware | LangChain or LangGraph (Lab 11), which can sit on top of either |

## What Most Engineers Miss

- **The same prompt isn't the same agent on another model.** Tool descriptions, system prompts, and step limits tuned for one model need re-tuning, and re-evaluating, on another.
- **A gateway is now a critical dependency.** Every model call goes through it. Pin its version, and plan for its outages like any shared service.
- **The gateway sees everything.** Prompts, tool results, and logs pass through it. Apply the same data rules to it as to the model providers.
- **Cost tables age.** Prices change and new models appear. Check what `completion_cost()` returns for a new model before you trust a dashboard built on it.

!!! quiz "Tool results"
    In the OpenAI message format, how does your loop tell the model that a tool call failed?

    - [ ] Set `is_error: true` on the tool message
    - [x] Say so in the content, because the format has no error flag
    - [ ] Leave the tool message out

    Every tool call still needs a matching `tool` message with its `tool_call_id`. The failure has to be in the text.

!!! quiz "drop_params"
    A shared LiteLLM config sets `drop_params: true`, and a team sends `temperature=0` to Claude. What happens?

    - [ ] The request fails with a clear error
    - [x] The request succeeds, and `temperature` is silently removed
    - [ ] Claude uses temperature 0

    The team thinks they get low-temperature output, and they don't. Silent translation is the main risk of any common interface.

## Common Mistakes

- Assuming a prompt and tool set tuned on one model will work as well on another.
- Using `drop_params` to make errors go away instead of fixing the config.
- Expecting provider-specific features through a lowest-common-denominator API.
- Building cost dashboards on prices that haven't been updated.
- Putting a gateway in front of every model call with no plan for when it's down.

## Interview Questions

- Why would a platform team run an LLM gateway such as the LiteLLM proxy?
- What changes in an agent loop when you move from the Claude Messages API to the OpenAI format?
- What can go wrong when you switch an agent to a different model provider?
- How would you compare two models for the same agent task?

## Next

You've built the whole stack: the loop, guardrails, memory, MCP, evals, injection defenses, multiple agents, A2A, and two frameworks. Return to the [AI Engineering Guide](../index.md), or read [AI Terminology](../terminology.md) to check the vocabulary.
