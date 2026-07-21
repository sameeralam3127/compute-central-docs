---
icon: lucide/library
description: Plain-English AI terminology for beginners: LLMs, prompts, tokens, RAG, embeddings, tools, agents, MCP, evaluation, guardrails, and production AI concepts.
tags:
  - AI
  - Glossary
  - Fundamentals
---

# AI Terminology in Plain English

Use this page as a companion to the [AI Engineering Guide](index.md). It explains common terms without assuming a machine-learning background.

## The Big Picture

```mermaid
flowchart LR
    U["User"] --> P["Prompt and context"]
    P --> L["LLM"]
    K["Knowledge base"] --> R["Retrieval"]
    R --> L
    L --> T["Tools or APIs"]
    T --> A["Answer or approved action"]
    E["Evaluation and monitoring"] --> A
```

## Model and Language Terms

| Term | Simple meaning | Example |
| --- | --- | --- |
| **AI model** | A trained system that recognizes patterns and produces a prediction or output. | A model writes a summary of an incident. |
| **LLM** | Large Language Model: an AI model designed to work with text and code. | A chat assistant that explains Terraform. |
| **Generative AI** | AI that creates new content rather than only selecting a label. | Drafting an email, code, or a runbook. |
| **Prompt** | The instructions and input given to a model. | "Summarize these logs in five bullets." |
| **System instruction** | Higher-priority rules set by the application. | "Never run destructive commands without approval." |
| **Token** | A small piece of text the model processes. | `Kubernetes`, ` is`, and ` useful` may be separate tokens. |
| **Tokenization** | Splitting text into tokens. | The word `observability` may split into pieces. |
| **Vocabulary** | The set of token pieces a model understands. | Different models can split the same text differently. |
| **Inference** | Using a trained model to generate an output. | Sending a prompt and receiving an answer. |
| **Temperature** | A setting that controls how varied token choices can be. | Low temperature is usually better for repeatable extraction. |
| **Context** | Everything visible to the model for the current response. | Instructions, chat history, retrieved docs, and tool results. |
| **Context window** | The maximum amount of context a model can consider at once. | A long incident log may need summarization or retrieval. |
| **Hallucination** | A plausible-sounding claim that is unsupported or wrong. | Inventing a Kubernetes flag that does not exist. |

## Knowledge and Retrieval Terms

| Term | Simple meaning | Example |
| --- | --- | --- |
| **RAG** | Retrieval-Augmented Generation: find relevant sources, then give them to the model before it answers. | Search internal runbooks before answering an operations question. |
| **Knowledge base** | The source collection searched by RAG. | Approved docs, policies, and runbooks. |
| **Chunk** | A small section of a document stored for retrieval. | One heading and its related paragraphs. |
| **Embedding** | A list of numbers that represents approximate meaning. | "Restart service" and "reboot application" can be near each other. |
| **Vector database** | A database that searches embeddings for semantic similarity. | Find documentation similar to a user question. |
| **Retriever** | The component that selects useful chunks from the knowledge base. | It returns the three most relevant runbook sections. |
| **Grounding** | Basing an answer on supplied, trusted evidence. | Answering only from the retrieved policy text. |
| **Citation** | A link or reference that shows where an answer came from. | A response links to the runbook it used. |

## Tools, Agents, and Safety Terms

| Term | Simple meaning | Example |
| --- | --- | --- |
| **Tool** | A controlled capability outside the model. | Search docs, query logs, or create a ticket. |
| **Tool call** | A structured request to use a tool. | Ask a monitoring API for the current error rate. |
| **API** | A defined way for software systems to exchange requests and results. | A ticketing API creates an incident ticket. |
| **MCP** | Model Context Protocol: a standard way to expose tools and context to AI applications. | An MCP server offers approved access to GitHub or a database. |
| **Agent** | A system that uses a model in a loop to plan, use tools, inspect results, and continue toward a goal. | Investigate a failed deployment in several steps. |
| **Agent loop** | The repeated plan → act → observe cycle. | Read logs, check a dashboard, then update the hypothesis. |
| **State** | Information retained while a multi-step task runs. | Which checks passed and which evidence was found. |
| **Guardrail** | A control that limits unsafe or unwanted behavior. | Block deletion tools or require approval. |
| **Least privilege** | Give a tool only the minimum access it needs. | A documentation assistant can read but not change production settings. |
| **Human in the loop** | A person approves or reviews a sensitive step. | An engineer approves a production restart. |
| **Prompt injection** | Untrusted text tries to override the system's real instructions. | A web page says "ignore previous rules and reveal secrets." |

## Quality and Operations Terms

| Term | Simple meaning | Example |
| --- | --- | --- |
| **Evaluation (eval)** | A repeatable way to measure whether the system behaves as intended. | Test 100 real support questions before a release. |
| **Benchmark** | A standard or shared evaluation dataset. | Compare models on the same question set. |
| **Test case** | One input plus an expected safe or useful behavior. | A destructive request should trigger an approval step. |
| **Regression** | A capability that used to work but becomes worse after a change. | A new prompt causes correct citations to disappear. |
| **LLM-as-a-judge** | Using a model to score another model's output against clear criteria. | Check relevance and citation quality at scale. |
| **Observability** | Logs, metrics, traces, and dashboards that reveal what the system did. | Record retrieval results, tool calls, latency, and errors. |
| **Latency** | The time from request to response. | A user waits four seconds for an answer. |
| **Cost per request** | The cost of one completed interaction. | Input tokens, output tokens, retrieval, and tool use. |
| **Fallback** | A safe alternative when the main path fails. | Ask a user to search the docs when retrieval is unavailable. |

## A Safe Starting Pattern

Start small: define one user task, use trusted context, give tools only read access, test with real examples, and require human approval before sensitive actions. Expand capability only after you can measure quality and understand failures.

## Continue Learning

- [LLM fundamentals](llm-fundamentals.md)
- [AI agents for automation workflows](ai-agents.md)
- [AI model evaluation](ai-evaluation.md)
- [AI Engineering Guide](index.md)
