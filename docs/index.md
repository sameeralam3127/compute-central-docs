---
title: "DevOps, Kubernetes, Ansible & Cloud Engineering Guides"
description: Learn DevOps, Kubernetes, Docker, Terraform, Ansible, CI/CD, monitoring, and AI engineering through practical infrastructure guides.
hide:
  - navigation
---

# Compute Central

<div class="cc-hero" markdown>

<p class="cc-hero-tagline" markdown>
**Compute Central** is a practical DevOps, cloud, platform, AI engineering, and SRE knowledge base built around real infrastructure work — Linux, containers, Kubernetes, CI/CD, Terraform, Ansible, monitoring, troubleshooting, and AI-assisted engineering, explained clearly and connected to day-to-day operations.
</p>

<div class="cc-hero-track" markdown>
<span class="cc-hero-node" style="--i:0">:lucide-container: Docker</span>
<span class="cc-hero-node" style="--i:1">:lucide-ship-wheel: Kubernetes</span>
<span class="cc-hero-node" style="--i:2">:lucide-workflow: Ansible</span>
<span class="cc-hero-node" style="--i:3">:lucide-infinity: CI/CD</span>
<span class="cc-hero-node" style="--i:4">:lucide-activity: Monitoring</span>
<span class="cc-hero-node" style="--i:5">:lucide-brain: AI</span>
</div>

<div class="cc-hero-line" aria-hidden="true">
<span class="cc-hero-packet"></span>
<span class="cc-hero-packet"></span>
<span class="cc-hero-packet"></span>
</div>

</div>

<div class="cc-stats" markdown>

<div class="cc-stat" markdown>
**0**{: .cc-stat-number data-count="110" data-suffix="+" }
<span>Guides and lab-tested chapters</span>
</div>

<div class="cc-stat" markdown>
**0**{: .cc-stat-number data-count="10" }
<span>Learning tracks, foundations to production</span>
</div>

<div class="cc-stat" markdown>
**2016**
<span>Notes and lessons collected since</span>
</div>

</div>

## The path through this site

```mermaid
flowchart LR
    A[Foundations] --> B[Docker & containers]
    B --> C[Kubernetes & OpenShift]
    C --> D[Automation: Ansible & scripts]
    D --> E["CI/CD: Jenkins & SonarQube"]
    E --> F[Observability & SRE]
    F --> G[AI engineering]
    classDef stage1 fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef stage2 fill:#dcfce7,stroke:#16a34a,color:#14532d
    classDef stage3 fill:#fef3c7,stroke:#d97706,color:#78350f
    classDef stage4 fill:#fce7f3,stroke:#db2777,color:#831843
    class A,B stage1
    class C,D stage2
    class E,F stage3
    class G stage4
```

Most readers move left to right, but every section stands on its own — jump straight to the track you need.

## Start Here

<div class="cc-card-grid" markdown>

<a class="cc-card" href="docker/">
  <strong>:lucide-container: Docker and Linux Containers</strong>
  <span>A from-first-principles course: namespaces, cgroups, OCI runtimes, networking, storage, and Docker workflows.</span>
</a>

<a class="cc-card" href="kubernetes/">
  <strong>:lucide-ship-wheel: Kubernetes and OpenShift</strong>
  <span>Learn core concepts, OpenShift operations, labs, troubleshooting, and quick-reference commands.</span>
</a>

<a class="cc-card" href="ansible/">
  <strong>:lucide-workflow: Ansible Automation</strong>
  <span>Getting started through production: playbooks, roles, collections, custom modules, troubleshooting, and interview prep.</span>
</a>

<a class="cc-card" href="jenkins/jenkins/">
  <strong>:lucide-infinity: CI/CD and Code Quality</strong>
  <span>Set up Jenkins pipelines, SonarQube checks, and deployment workflows that are easier to review and operate.</span>
</a>

<a class="cc-card" href="sonarqube/">
  <strong>:lucide-shield-check: SonarQube</strong>
  <span>Install, configure, and wire SonarQube into Jenkins with quality gates that actually get enforced.</span>
</a>

<a class="cc-card" href="monitoring-tools/">
  <strong>:lucide-activity: Monitoring and SRE</strong>
  <span>Use Prometheus, Grafana, Alertmanager, Loki, and troubleshooting patterns to understand system health.</span>
</a>

<a class="cc-card" href="ai-guide/">
  <strong>:lucide-brain: AI Engineering</strong>
  <span>Understand LLM fundamentals, AI agents, evaluation, and practical model workflows for technical teams.</span>
</a>

<a class="cc-card" href="terraform/overview/">
  <strong>:lucide-layers: Terraform</strong>
  <span>Infrastructure as code fundamentals, core concepts, and common interview questions.</span>
</a>

<a class="cc-card" href="shell-scripts/scripts/">
  <strong>:lucide-terminal: Shell Scripts</strong>
  <span>Practical automation scripts and patterns for everyday operations work.</span>
</a>

</div>

## What You Will Find

- Step-by-step guides for common DevOps and SRE tasks
- Kubernetes, OpenShift, Docker, Terraform, Ansible, Jenkins, and SonarQube notes
- Monitoring and troubleshooting workflows for production-style systems
- AI engineering notes that connect models, retrieval, tools, evaluation, and operations
- Scripts, examples, and checklists that are easy to adapt

## Learning Paths

Pick the goal closest to yours — each tab is a short, ordered route through the material.

=== ":lucide-container: Containers & orchestration"

    Start with the [Docker and Linux Containers course](docker/), then move to [Kubernetes core concepts](kubernetes/core-concepts/index.md).

=== ":lucide-flask-conical: Practice Kubernetes locally"

    Try the [Minikube lab](kubernetes/labs/01-minikube-lab.md), the [Docker Desktop lab](kubernetes/labs/03-docker-desktop-lab.md), or the [Podman lab](kubernetes/labs/04-podman-lab.md).

=== ":lucide-workflow: Automate server work"

    Read [Ansible](ansible/index.md) — jump straight to [playbooks, plays, and tasks](ansible/core-concepts/03-playbooks-plays-tasks.md) — and pair it with [shell scripts](shell-scripts/scripts.md).

=== ":lucide-infinity: Improve delivery pipelines"

    Set up [Jenkins](jenkins/jenkins.md), add [SonarQube quality gates](sonarqube/jenkins-integration.md), then wire in [Kubernetes CI/CD](kubernetes/cicd-and-gitops/01-cicd-pipelines-for-kubernetes.md).

=== ":lucide-activity: Operate production-style systems"

    Stand up the [monitoring stack](monitoring-tools/index.md) and review [Kubernetes troubleshooting](kubernetes/troubleshooting/index.md).

=== ":lucide-brain: Understand AI engineering basics"

    Start with the [AI Engineering Guide](ai-guide/index.md), then [LLM fundamentals](ai-guide/llm-fundamentals.md) and [AI evaluation](ai-guide/ai-evaluation.md).

## How to Use This Site

Start with the topic you need, then follow the examples in a local or test environment before using them in production. Most pages are written to help you understand the reason behind each step, not just copy a command and move on.

!!! tip "Best way to learn"
    Read the short explanation first, run the example safely, then write down what changed and why it worked.

!!! note "Production reminder"
    Always review commands, credentials, namespaces, and environment names before running anything against shared or production systems.

??? note ":lucide-layout-list: Browse every section"

    - **Docker** — [Course index](docker/), [Dockerfiles](docker/17-dockerfiles.md), [Compose](docker/18-docker-compose.md), [quick reference](docker/docker.md)
    - **Kubernetes** — [Core Concepts](kubernetes/core-concepts/index.md), [labs](kubernetes/labs/05-hands-on-scenarios.md), [OpenShift](kubernetes/openshift/index.md), [troubleshooting](kubernetes/troubleshooting/index.md), [quick reference](kubernetes/quick-reference/index.md)
    - **Ansible** — [Overview](ansible/index.md), [Getting Started](ansible/getting-started/index.md), [Core Concepts](ansible/core-concepts/index.md), [Modules](ansible/modules/index.md), [Case Studies](ansible/case-studies/index.md), [Troubleshooting](ansible/troubleshooting/index.md), [Interview Prep](ansible/interview-prep/index.md)
    - **Jenkins** — [Installation and first pipeline](jenkins/jenkins.md)
    - **SonarQube** — [Overview](sonarqube/index.md), [installation](sonarqube/installation.md), [Jenkins integration](sonarqube/jenkins-integration.md)
    - **Monitoring** — [Stack overview](monitoring-tools/index.md), [Prometheus](monitoring-tools/prometheus.md), [Grafana](monitoring-tools/grafana.md), [Alertmanager](monitoring-tools/alertmanager.md)
    - **AI Engineering** — [Guide](ai-guide/index.md), [LLM fundamentals](ai-guide/llm-fundamentals.md), [AI agents](ai-guide/ai-agents.md), [evaluation](ai-guide/ai-evaluation.md)
    - **Terraform** — [Overview](terraform/overview.md), [interview questions](terraform/interview-questions.md)
    - **Shell Scripts** — [Practical scripts](shell-scripts/scripts.md)

## About Sameer Alam

I’m **Sameer Alam**, a DevOps Engineer and SRE practitioner focused on reliable, automated, observable, and secure systems.

My work includes infrastructure design, deployment automation, monitoring, incident response, platform operations, and simplifying complex workflows for teams.

I started documenting my learning in **2016**. Compute Central brings those notes, experiments, and real-world lessons into one organized place.

## Links

- **GitHub:** [github.com/sameeralam3127](https://github.com/sameeralam3127)
- **Medium:** [medium.com/@sameeralam3127](https://medium.com/@sameeralam3127)
- **Blog archive:** [compute-central.blogspot.com](https://compute-central.blogspot.com/)
