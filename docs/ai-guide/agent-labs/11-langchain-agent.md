---
title: "LangChain Agent Tutorial: create_agent, Tools, and Middleware"
icon: lucide/link
description: "A hands-on lab: rebuild a tool-using AI agent with LangChain 1.x and Claude. create_agent, @tool, ChatAnthropic, and middleware for call limits and human-in-the-loop approval, compared line by line with a hand-written loop."
tags:
  - AI
  - Agents
  - LangChain
  - Lab
---

# Lab 11: LangChain

## What You'll Learn

- How the hand-written agent from Lab 2 maps onto LangChain 1.x
- How to define tools with `@tool` and build an agent with `create_agent`
- How LangChain middleware replaces the step limit and approval gate
- What a framework gives you, and what it costs

## The Same Agent, Different Code

You already know what an agent does. This lab rebuilds the Lab 2 agent in LangChain so you can see which parts the framework takes over:

| Lab 2 (hand-written) | LangChain 1.x |
|---|---|
| `TOOLS` list of JSON Schemas | `@tool` functions. The schema comes from type hints and the docstring. |
| `client.messages.create(...)` | `ChatAnthropic(model=...)` |
| The `for step in range(...)` loop | `create_agent(...)`, which runs a LangGraph graph |
| `MAX_STEPS` | `ModelCallLimitMiddleware(run_limit=15)` |
| `approve()` callback | `HumanInTheLoopMiddleware` plus a checkpointer to pause and resume |
| `messages` list | Graph state, saved by the checkpointer per `thread_id` |

## Step 1: Write the Agent

Save this as `langchain_agent.py`, next to `tools.py` and `agent.py` from Lab 2:

```python title="langchain_agent.py"
"""Lab 11: the same agent in LangChain, with the same guardrails as middleware."""

import os
import sys

from langchain.agents import create_agent
from langchain.agents.middleware import HumanInTheLoopMiddleware, ModelCallLimitMiddleware
from langchain.tools import tool
from langchain_anthropic import ChatAnthropic
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

import tools
from agent import SYSTEM


def safe(fn, *args):
    # Same rule as Lab 2: a tool failure goes back to the model as text, not as a crash.
    try:
        return fn(*args)
    except tools.ToolError as exc:
        return f"ERROR: {exc}"


@tool
def list_files(path: str = ".") -> str:
    """List every file under a directory of the incident workspace, with sizes."""
    return safe(tools.list_files, path)


@tool
def read_file(path: str, start_line: int = 1, max_lines: int = 200) -> str:
    """Read a text file from the incident workspace with numbered lines. At most 500 lines per call."""
    return safe(tools.read_file, path, start_line, max_lines)


@tool
def search_files(pattern: str, path: str = ".") -> str:
    """Search files for a case-insensitive regular expression. Returns file:line: text, at most 50 matches."""
    return safe(tools.search_files, pattern, path)


@tool
def restart_service(service: str, reason: str) -> str:
    """Restart a production service. A human must approve every call, and may decline."""
    return tools.restart_service(service, reason)


model = ChatAnthropic(
    model=os.environ.get("AGENT_MODEL", "claude-opus-5-5"),
    max_tokens=16000,
    output_config={"effort": "medium"},
    # No temperature: current Claude models reject it. See Lab 3.
)

agent = create_agent(
    model,
    tools=[list_files, read_file, search_files, restart_service],
    system_prompt=SYSTEM,
    middleware=[
        ModelCallLimitMiddleware(run_limit=15, exit_behavior="end"),      # Lab 2: MAX_STEPS
        HumanInTheLoopMiddleware(interrupt_on={"restart_service": True}),  # Lab 2: approve()
    ],
    checkpointer=InMemorySaver(),  # needed to pause for approval and resume
)

if __name__ == "__main__":
    task = " ".join(sys.argv[1:]) or "Investigate the checkout alert. What is the root cause?"
    config = {"configurable": {"thread_id": "checkout-incident"}}
    result = agent.invoke({"messages": [{"role": "user", "content": task}]}, config, version="v2")

    while result.interrupts:  # paused on restart_service
        decisions = []
        for action in result.interrupts[0].value["action_requests"]:
            answer = input(f"\nApprove {action['name']}({action['args']})? [y/N] ")
            if answer.strip().lower() == "y":
                decisions.append({"type": "approve"})
            else:
                decisions.append({"type": "reject", "message": "A human declined. Do not retry."})
        result = agent.invoke(Command(resume={"decisions": decisions}), config, version="v2")

    for message in result.value["messages"]:
        for call in getattr(message, "tool_calls", []):
            print(f"[tool] {call['name']} {call['args']}")
    print("\n" + result.value["messages"][-1].text)
```

The parts that matter:

- **`@tool` functions** wrap the Lab 2 tools. The docstring becomes the description the model reads, so write it as carefully as you did the JSON descriptions.
- **`safe()`** keeps the Lab 2 rule: an expected failure goes back to the model as text instead of stopping the run.
- **`ChatAnthropic`** takes `output_config={"effort": "medium"}` like the raw SDK. There's no `temperature`. Lab 3 explains why setting one makes the request fail.
- **`HumanInTheLoopMiddleware`** pauses the graph before `restart_service` runs. Pausing needs a **checkpointer**, which saves the graph's state so `Command(resume=...)` can continue it.
- **`version="v2"`** makes `invoke()` return a `GraphOutput` with `.value` and `.interrupts`, instead of a dict with a special `__interrupt__` key.

## Step 2: Run It

```bash
python langchain_agent.py
```

A typical run:

```text
[tool] list_files {'path': '.'}
[tool] search_files {'pattern': 'error|timed out', 'path': 'logs'}
[tool] read_file {'path': 'deploys.json', 'start_line': 1, 'max_lines': 200}

The checkout alert fired because release 2.14.0 reduced DB_POOL_SIZE from 20 to 5...
```

Now ask for an action:

```bash
python langchain_agent.py "Checkout is failing. Restart it if the evidence says that will fix it."
```

When the model calls `restart_service`, the graph stops and your loop asks you:

```text
Approve restart_service({'service': 'checkout', 'reason': '...'})? [y/N] n
```

If you answer `n`, the model gets this as an error result:

```text
User rejected the tool call for `restart_service` with reason: A human declined. Do not retry.
```

If you answer `y`, the tool runs and `actions.log` gets a line. That's the same behaviour as Lab 2, in about the same amount of code.

## Step 3: Add More Middleware

Middleware is where LangChain saves you real work. Each of these is a one-line addition to the `middleware` list:

| Middleware | Does | Lab equivalent |
|---|---|---|
| `ToolCallLimitMiddleware` | Caps calls to one tool or all tools | Per-tool budgets |
| `ModelFallbackMiddleware` | Retries on another model when a call fails | Not built in the labs |
| `ToolRetryMiddleware`, `ModelRetryMiddleware` | Retries failed calls with backoff | The SDK's built-in retries |
| `PIIMiddleware` | Redacts or blocks patterns such as emails | Not built in the labs |
| `SummarizationMiddleware` | Replaces old messages with a summary | Lab 3, Part 3 |

!!! warning "Test history-rewriting middleware on your model"
    `SummarizationMiddleware` and similar middleware rewrite earlier messages. Lab 3 explains why current Claude models can reject a request whose earlier turns were edited. Before you rely on it, run a long conversation with it enabled on the exact model you'll use, and check for 400 errors. Server-side context editing is the safer way to shrink context on Claude.

## Framework or Hand-Written?

| | Hand-written loop (Lab 2) | LangChain |
|---|---|---|
| Lines of code, not counting `tools.py` | About 95 (`agent.py`) | About 85 (`langchain_agent.py`) |
| Pause, persist, and resume a run | You build it | Checkpointers do it |
| Switch model provider | Rewrite the API calls | Change the model class |
| Debug "why did it do that?" | Read your own loop | Read the graph, the middleware, and the provider adapter |
| Upgrades | Only the Anthropic SDK | LangChain, LangGraph, and `langchain-anthropic` together |
| New Claude API features | Available immediately | Available when the adapter supports them |

Choose LangChain when you need what it adds: durable runs that survive restarts, LangGraph workflows with branches and human steps, LangSmith tracing, or several providers behind one interface. For one focused agent, a hand-written loop is often easier to own.

## What Most Engineers Miss

- **LangChain 1.x is a different library from the one in most tutorials.** `AgentExecutor`, `initialize_agent`, and LangGraph's `create_react_agent` are replaced by `langchain.agents.create_agent` and middleware. Check the date on any example you copy.
- **The framework still calls the same API.** Every limit from Lab 2 still applies: step limits, output caps, read-only tools, error results. Middleware makes them easier to add, not optional.
- **Adapters pass through what you configure.** If a shared config sets `temperature=0` for every model, `ChatAnthropic` sends it, and the Claude API rejects it.
- **Checkpointers store everything.** The saved state holds every tool result, including log lines and anything sensitive in them. Treat the checkpointer's database like a log store.

!!! quiz "Human in the loop"
    Why does `HumanInTheLoopMiddleware` need a checkpointer?

    - [ ] To count how many times the tool was called
    - [x] To save the paused run's state so it can continue after a human decides
    - [ ] To store the approval decisions for auditing

    The graph stops at the interrupt. The checkpointer keeps the messages and position, so `Command(resume=...)` can pick up where it stopped.

!!! quiz "Mapping"
    Which LangChain piece replaces Lab 2's `MAX_STEPS`?

    - [ ] `ToolCallLimitMiddleware`
    - [x] `ModelCallLimitMiddleware`
    - [ ] `InMemorySaver`

    `MAX_STEPS` limits model calls per run. `ToolCallLimitMiddleware` limits tool calls, which is a different budget.

## Common Mistakes

- Copying LangChain 0.x examples with `AgentExecutor` into a 1.x project.
- Setting `temperature` in `ChatAnthropic` for a current Claude model.
- Using `HumanInTheLoopMiddleware` without a checkpointer, or reusing one `thread_id` for unrelated runs.
- Adding summarization or trimming middleware without testing it against the model's history rules.
- Assuming the framework adds safety. Read-only tools and credentials are still your job.

## Interview Questions

- What does an agent framework like LangChain do for you? What does it cost?
- How does LangChain implement human-in-the-loop approval?
- When would you choose a hand-written loop over a framework?
- How would you upgrade an agent from LangChain 0.x to 1.x safely?

## Next

Continue to [Lab 12: LiteLLM](12-litellm-multi-provider.md).
