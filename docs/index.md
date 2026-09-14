---
title: "DevOps, Kubernetes, Ansible & Cloud Engineering Guides"
description: Learn DevOps, Kubernetes, Docker, Terraform, Ansible, CI/CD, monitoring, and AI engineering through practical infrastructure guides.
hide:
  - navigation
  - toc
---

<section class="cc-hero">
  <div class="cc-hero-copy">
    <p class="cc-eyebrow">DevOps · SRE · Platform engineering</p>
    <h1>Compute Central</h1>
    <p class="cc-hero-lead">Practical, lab-tested guides for the infrastructure you actually run — <strong>Linux, containers, Kubernetes, automation, CI/CD, observability, and AI engineering</strong>, explained from first principles all the way to production.</p>
    <div class="cc-hero-actions">
      <a class="md-button md-button--primary" href="docker/">Start with Docker <span aria-hidden="true">→</span></a>
      <a class="md-button" href="#learning-tracks">Explore all tracks</a>
    </div>
    <ul class="cc-hero-points">
      <li>Free and open source</li>
      <li>Hands-on labs and case studies</li>
      <li>Updated September 2026</li>
    </ul>
  </div>
  <div class="cc-terminal" data-cc-terminal>
    <div class="cc-terminal-bar" aria-hidden="true">
      <span class="cc-dot cc-dot-r"></span><span class="cc-dot cc-dot-y"></span><span class="cc-dot cc-dot-g"></span>
      <span class="cc-terminal-title">~/compute-central</span>
    </div>
    <pre class="cc-terminal-body"><code data-cc-terminal-body><span class="cc-t-line cc-t-cmd"><span class="cc-t-prompt">$ </span>docker compose up -d</span><span class="cc-t-line cc-t-out">✔ Container caddylab-db-1  Healthy</span><span class="cc-t-line cc-t-out">✔ Container caddylab-api-1  Started</span><span class="cc-t-line cc-t-out">✔ Container caddylab-caddy-1  Started</span><span class="cc-t-line cc-t-cmd"><span class="cc-t-prompt">$ </span>curl -s localhost/api/todos | jq length</span><span class="cc-t-line cc-t-out cc-t-ok">3</span></code></pre>
    <div class="cc-terminal-foot">
      <div class="cc-terminal-tabs" role="tablist" aria-label="Example commands from the guides" data-cc-terminal-tabs hidden></div>
      <a class="cc-terminal-link" href="docker/14-caddy-web-app-lab/" data-cc-terminal-link>Open the Docker guide →</a>
    </div>
  </div>
</section>

<div class="cc-stats" markdown>

<div class="cc-stat" markdown>
**0**{: .cc-stat-number data-count="280" data-suffix="+" }
<span>Guides and lab-tested chapters</span>
</div>

<div class="cc-stat" markdown>
**0**{: .cc-stat-number data-count="9" }
<span>Learning tracks, foundations to production</span>
</div>

<div class="cc-stat" markdown>
**0**{: .cc-stat-number data-count="20" }
<span>Hands-on labs and case studies</span>
</div>

<div class="cc-stat" markdown>
**2016**
<span>Notes and lessons collected since</span>
</div>

</div>

## Learning tracks

Pick a track, or filter by what you're working on. Every track stands on its own.

<div class="cc-filter" role="toolbar" aria-label="Filter learning tracks" data-cc-filter hidden>
  <button type="button" class="cc-chip" data-cc-value="all" aria-pressed="true">All</button>
  <button type="button" class="cc-chip" data-cc-value="containers" aria-pressed="false">Containers</button>
  <button type="button" class="cc-chip" data-cc-value="automation" aria-pressed="false">Automation</button>
  <button type="button" class="cc-chip" data-cc-value="delivery" aria-pressed="false">Delivery</button>
  <button type="button" class="cc-chip" data-cc-value="operations" aria-pressed="false">Operations</button>
  <button type="button" class="cc-chip" data-cc-value="ai" aria-pressed="false">AI</button>
  <span class="cc-filter-count" data-cc-count aria-live="polite">9 tracks</span>
</div>

<div class="cc-card-grid" data-cc-reveal markdown>

<a class="cc-card" href="docker/" data-cc-tags="containers">
  <span class="cc-card-icon">:lucide-container:</span>
  <strong>Docker and Linux Containers</strong>
  <span class="cc-card-desc">From namespaces and cgroups to images, networking, storage, Compose, Podman, and production troubleshooting.</span>
  <span class="cc-card-meta">25 chapters + quick reference</span>
</a>

<a class="cc-card" href="kubernetes/" data-cc-tags="containers operations">
  <span class="cc-card-icon">:lucide-ship-wheel:</span>
  <strong>Kubernetes and OpenShift</strong>
  <span class="cc-card-desc">Core objects, networking and Gateway API, security, GitOps, labs, case studies, and interview prep.</span>
  <span class="cc-card-meta">17 sections · 108 pages</span>
</a>

<a class="cc-card" href="ansible/" data-cc-tags="automation">
  <span class="cc-card-icon">:lucide-workflow:</span>
  <strong>Ansible Automation</strong>
  <span class="cc-card-desc">Playbooks, roles, collections, custom modules, Vault, Molecule, and real deployment case studies.</span>
  <span class="cc-card-meta">17 sections · 104 pages</span>
</a>

<a class="cc-card" href="terraform/" data-cc-tags="automation">
  <span class="cc-card-icon">:lucide-layers:</span>
  <strong>Terraform</strong>
  <span class="cc-card-desc">Infrastructure as code from a first project to remote state, modules, environments, testing, and CI/CD.</span>
  <span class="cc-card-meta">8 guides</span>
</a>

<a class="cc-card" href="cicd" data-cc-tags="delivery">
  <span class="cc-card-icon">:lucide-infinity:</span>
  <strong>CI/CD Pipelines</strong>
  <span class="cc-card-desc">GitHub Actions, GitLab CI, Jenkins, and ArgoCD — from commit to tested image to a GitOps deployment.</span>
  <span class="cc-card-meta">7 guides</span>
</a>

<a class="cc-card" href="code-quality" data-cc-tags="delivery">
  <span class="cc-card-icon">:lucide-shield-check:</span>
  <strong>Code Quality</strong>
  <span class="cc-card-desc">SonarQube quality gates, open-source linters and scanners, and the paid platforms that compete with them.</span>
  <span class="cc-card-meta">7 guides</span>
</a>

<a class="cc-card" href="monitoring-tools/" data-cc-tags="operations">
  <span class="cc-card-icon">:lucide-activity:</span>
  <strong>Monitoring and SRE</strong>
  <span class="cc-card-desc">Prometheus, Grafana, Alertmanager, Loki with Grafana Alloy, OpenTelemetry, and synthetic checks.</span>
  <span class="cc-card-meta">12 guides</span>
</a>

<a class="cc-card" href="ai-guide/" data-cc-tags="ai">
  <span class="cc-card-icon">:lucide-brain:</span>
  <strong>AI Engineering</strong>
  <span class="cc-card-desc">LLM fundamentals, RAG, tools and MCP, agents, and evaluation for platform and DevOps teams.</span>
  <span class="cc-card-meta">5 guides</span>
</a>

<a class="cc-card" href="shell-scripts/scripts/" data-cc-tags="automation operations">
  <span class="cc-card-icon">:lucide-terminal:</span>
  <strong>Shell Scripts</strong>
  <span class="cc-card-desc">Safe Bash structure, health checks, log scanners, backups, deployment helpers, and debugging.</span>
  <span class="cc-card-meta">6 example scripts</span>
</a>

</div>

## The path through this site

Most readers move left to right — but jump in wherever your work is today.

<ol class="cc-journey" data-cc-reveal>
  <li><a href="shell-scripts/scripts/"><span class="cc-step">1</span><span class="cc-journey-text"><strong>Linux &amp; shell</strong><small>Safe scripts and system basics</small></span></a></li>
  <li><a href="docker/"><span class="cc-step">2</span><span class="cc-journey-text"><strong>Containers</strong><small>How Docker really works</small></span></a></li>
  <li><a href="kubernetes/"><span class="cc-step">3</span><span class="cc-journey-text"><strong>Kubernetes</strong><small>Orchestrate workloads</small></span></a></li>
  <li><a href="ansible/"><span class="cc-step">4</span><span class="cc-journey-text"><strong>Automation</strong><small>Ansible and Terraform</small></span></a></li>
  <li><a href="cicd"><span class="cc-step">5</span><span class="cc-journey-text"><strong>Delivery</strong><small>CI/CD and code quality</small></span></a></li>
  <li><a href="monitoring-tools/"><span class="cc-step">6</span><span class="cc-journey-text"><strong>Observability</strong><small>Metrics, logs, traces</small></span></a></li>
  <li><a href="ai-guide/"><span class="cc-step">7</span><span class="cc-journey-text"><strong>AI engineering</strong><small>LLMs, RAG, and agents</small></span></a></li>
</ol>

## What's new

<div class="cc-news" data-cc-reveal markdown>

<a class="cc-news-item" href="terraform/">
  <span class="cc-badge">New</span>
  <span class="cc-news-text"><strong>Terraform learning path</strong><span>State and S3 native locking, modules, environments, and CI/CD with OIDC.</span></span>
</a>

<a class="cc-news-item" href="kubernetes/networking/07-gateway-api/">
  <span class="cc-badge">New</span>
  <span class="cc-news-text"><strong>Gateway API</strong><span>The successor to Ingress, and how to migrate off retired ingress-nginx.</span></span>
</a>

<a class="cc-news-item" href="docker/06-build-a-container-with-linux/">
  <span class="cc-badge">Expanded</span>
  <span class="cc-news-text"><strong>Docker course labs</strong><span>Build a container by hand, then run a four-tier app on segmented networks.</span></span>
</a>

<a class="cc-news-item" href="monitoring-tools/logging/">
  <span class="cc-badge">Updated</span>
  <span class="cc-news-text"><strong>Loki with Grafana Alloy</strong><span>Promtail is end-of-life — the supported collector and migration path.</span></span>
</a>

</div>

## Learning paths by goal

Pick the goal closest to yours — each tab is a short, ordered route through the material.

=== ":lucide-container: Containers & orchestration"

    Start with the [Docker and Linux Containers course](docker/index.md), then move to [Kubernetes core concepts](kubernetes/core-concepts/index.md).

=== ":lucide-flask-conical: Practice Kubernetes locally"

    Try the [Minikube lab](kubernetes/labs/01-minikube-lab.md), the [kind lab](kubernetes/labs/02-kind-lab.md), or the [Podman lab](kubernetes/labs/04-podman-lab.md).

=== ":lucide-workflow: Automate infrastructure"

    Provision with [Terraform](terraform/index.md), configure hosts with [Ansible](ansible/index.md), and glue it together with [shell scripts](shell-scripts/scripts.md).

=== ":lucide-infinity: Improve delivery pipelines"

    Start with the [CI/CD overview](cicd/index.md) and [GitHub Actions](cicd/github-actions.md), add [SonarQube quality gates](code-quality/jenkins-integration.md), then wire in [Kubernetes CI/CD](kubernetes/cicd-and-gitops/01-cicd-pipelines-for-kubernetes.md).

=== ":lucide-activity: Operate production-style systems"

    Stand up the [monitoring stack](monitoring-tools/index.md) and review [Kubernetes troubleshooting](kubernetes/troubleshooting/index.md).

=== ":lucide-brain: Understand AI engineering basics"

    Start with the [AI Engineering Guide](ai-guide/index.md), then [LLM fundamentals](ai-guide/llm-fundamentals.md) and [AI evaluation](ai-guide/ai-evaluation.md).

## How to use this site

Start with the topic you need, then follow the examples in a local or test environment before using them in production. Most pages explain the reason behind each step, not just the command.

!!! tip "Best way to learn"
    Read the short explanation first, run the example safely, then write down what changed and why it worked.

!!! note "Production reminder"
    Always review commands, credentials, namespaces, and environment names before running anything against shared or production systems.

??? note ":lucide-layout-list: Browse every section"

    - **Docker** — [Course index](docker/index.md), [Dockerfiles](docker/17-dockerfiles.md), [Compose](docker/18-docker-compose.md), [quick reference](docker/docker.md)
    - **Kubernetes** — [Core Concepts](kubernetes/core-concepts/index.md), [labs](kubernetes/labs/05-hands-on-scenarios.md), [OpenShift](kubernetes/openshift/index.md), [troubleshooting](kubernetes/troubleshooting/index.md), [quick reference](kubernetes/quick-reference/index.md)
    - **Ansible** — [Overview](ansible/index.md), [Getting Started](ansible/getting-started/index.md), [Core Concepts](ansible/core-concepts/index.md), [Modules](ansible/modules/index.md), [Case Studies](ansible/case-studies/index.md), [Troubleshooting](ansible/troubleshooting/index.md), [Interview Prep](ansible/interview-prep/index.md)
    - **CI/CD Pipelines** — [Overview](cicd/index.md), [GitHub Actions](cicd/github-actions.md), [GitLab CI/CD](cicd/gitlab-ci.md), [ArgoCD](cicd/argocd.md), [Jenkins](cicd/jenkins.md)
    - **Code Quality** — [Overview](code-quality/index.md), [open-source tools](code-quality/code-quality-ecosystem.md), [SonarQube installation](code-quality/installation.md), [Jenkins integration](code-quality/jenkins-integration.md)
    - **Monitoring** — [Stack overview](monitoring-tools/index.md), [Prometheus](monitoring-tools/prometheus.md), [Grafana](monitoring-tools/grafana.md), [Alertmanager](monitoring-tools/alertmanager.md)
    - **AI Engineering** — [Guide](ai-guide/index.md), [LLM fundamentals](ai-guide/llm-fundamentals.md), [AI agents](ai-guide/ai-agents.md), [evaluation](ai-guide/ai-evaluation.md)
    - **Terraform** — [Overview](terraform/index.md), [first project](terraform/overview.md), [state and backends](terraform/state-and-backends.md), [modules](terraform/modules.md), [testing and CI/CD](terraform/testing-and-ci.md), [interview questions](terraform/interview-questions.md)
    - **Shell Scripts** — [Practical scripts](shell-scripts/scripts.md)

## About

<div class="cc-about" data-cc-reveal markdown>

<div class="cc-about-profile">
  <img class="cc-avatar" src="assets/sameer-avatar.jpg" alt="Sameer Alam" width="240" height="240" loading="lazy" decoding="async">
  <div class="cc-about-id">
    <strong class="cc-about-name">Sameer Alam</strong>
    <span class="cc-about-role">DevOps Engineer · SRE</span>
    <span class="cc-about-since">Writing since 2016</span>
  </div>
</div>

<div class="cc-about-body" markdown>

<p class="cc-about-lead">I build and run reliable, automated, observable, and secure systems — and write down what I learn along the way. Compute Central brings a decade of notes, experiments, and real-world lessons into one organized place.</p>

<ul class="cc-about-focus" aria-label="Focus areas">
  <li>Infrastructure design</li>
  <li>Deployment automation</li>
  <li>Monitoring</li>
  <li>Incident response</li>
  <li>Platform operations</li>
</ul>

<div class="cc-about-links" markdown>

[:fontawesome-brands-github: GitHub](https://github.com/sameeralam3127){ .cc-social } [:fontawesome-brands-medium: Medium](https://medium.com/@sameeralam3127){ .cc-social } [:lucide-archive: Blog archive](https://compute-central.blogspot.com/){ .cc-social }

</div>

</div>

</div>
