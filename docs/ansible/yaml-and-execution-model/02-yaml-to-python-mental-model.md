---
icon: lucide/workflow
description: What actually happens between writing YAML and a module executing on a remote machine — the real pipeline, and why "YAML compiles to Python" is a misleading way to describe it.
tags:
  - Ansible
  - YAML
  - Execution Model
  - Internals
---

# YAML → Python Mental Model

## What You'll Learn

- The real pipeline from a YAML file to a running module and back
- A conceptual (non-runnable) Python representation of what a parsed task looks like internally
- Why "Ansible converts YAML to Python" is the wrong way to say this

## The Misconception

You'll sometimes hear "Ansible just compiles YAML into Python and runs it." That's not accurate, and believing it leads to wrong guesses about how Ansible behaves. YAML is never compiled into a Python *program*. It's **parsed into ordinary Python data structures** (dicts and lists) that Ansible's engine — itself written in Python — then walks through and acts on. The distinction matters: your playbook never becomes a `.py` file; it stays data, all the way through.

## The Real Pipeline

```mermaid
flowchart TD
    A[YAML file on disk] --> B[YAML parser\nPyYAML / libyaml]
    B --> C[Python dicts and lists\none per play/task]
    C --> D[Ansible engine validates\nagainst each module's argument_spec]
    D --> E[Jinja2 renders any\n"{{ }}" expressions]
    E --> F[Task Queue Manager\ndispatches the task]
    F --> G[Module code shipped to\nmanaged node, executed there\nby the managed node's Python]
    G --> H[Module prints one JSON\nobject to stdout]
    H --> I[Result flows back to\nthe control node]
```

Six distinct things are easy to conflate. They are not the same:

1. **YAML syntax** — the text in your `.yml` file.
2. **Parsed task data** — the Python `dict`/`list` structure the YAML parser produces. This is what Ansible's engine actually operates on.
3. **Jinja2 templating** — `{{ variable }}` expressions inside that data get rendered **after** YAML parsing, not during it — YAML has no idea Jinja2 exists; it just sees a string that happens to contain `{{ }}` characters.
4. **Python objects (Ansible's engine)** — `Play`, `Task`, and related classes inside `ansible-core` itself, which the parsed data gets loaded into.
5. **Module execution (remote)** — a *separate* Python process, running on the **managed node**, not the control node — the module's own script, not part of the engine above.
6. **Module return JSON** — the only thing that comes back across that boundary: one JSON object per module call.

## A Conceptual (Non-Runnable) Python View

This YAML task:

```yaml
- name: Install nginx
  ansible.builtin.package:
    name: nginx
    state: present
```

parses into something conceptually equivalent to this plain Python data structure — this is illustrative, not real `ansible-core` source, but it's an accurate shape:

```python
# Conceptual only — not real ansible-core internals
task = {
    "name": "Install nginx",
    "action": "ansible.builtin.package",
    "args": {
        "name": "nginx",
        "state": "present",
    },
}
```

The engine takes that dict, validates `args` against the `package` module's `argument_spec` (see [Build a Custom Module](../build-your-own/01-build-a-custom-module.md) for how a module declares one), ships the module code to the managed node, and waits for a JSON result — conceptually:

```python
# Conceptual only — the shape of what comes back
result = {
    "changed": True,
    "failed": False,
    "invocation": {"module_args": {"name": "nginx", "state": "present"}},
}
```

## Where Jinja2 Fits

```yaml
- name: Deploy config for {{ inventory_hostname }}
  ansible.builtin.template:
    src: app.conf.j2
    dest: "/etc/app/{{ env_name }}.conf"
```

The YAML parser sees `"/etc/app/{{ env_name }}.conf"` as an ordinary string — it has no special meaning to YAML. Only *after* parsing does Ansible pass string values through the Jinja2 engine, substituting `{{ env_name }}` with its resolved value. This is why a Jinja2 syntax error shows up as a templating error at task-execution time, not as a YAML parse error at load time — they're genuinely different stages, with different error messages.

## Why This Model Matters in Practice

- It explains why a variable that "looks right" in YAML can still fail to render — the YAML stage never touches variable resolution at all; that's a completely separate stage.
- It explains why module code runs on the **managed node's** Python, not the control node's — two different interpreters, potentially two different Python versions, doing two different jobs.
- It explains the actual security boundary: the control node never executes your remote command locally; it ships code across SSH and gets back only a JSON result — nothing about the *managed node's* internal execution is visible to the control node except that result.

## Common Mistakes

- Saying "Ansible compiles YAML to Python" in an interview — it's a red flag to anyone who knows the real pipeline. Say "YAML parses into Python data structures that the engine acts on" instead.
- Assuming a Jinja2 expression is evaluated *during* YAML parsing — it's a distinct, later stage.
- Assuming the module runs using the **control node's** Python — it runs using the **managed node's** interpreter (see [Architecture and Execution](../getting-started/02-architecture-and-execution.md)).

## Interview Questions

- Does Ansible convert YAML into a Python program? If not, what does it actually do with the YAML?
- At what stage does Jinja2 templating happen relative to YAML parsing?
- Which Python interpreter actually executes a module's code — the control node's, or the managed node's?

See [Interview Prep: Architecture & Performance](../interview-prep/02-architecture-and-performance-questions.md) for the full answers.

## Next

Continue to [Variables & Data](../variables-and-data/index.md) to see how the "parsed task data" stage resolves `{{ variable }}` values before Jinja2 ever runs.
