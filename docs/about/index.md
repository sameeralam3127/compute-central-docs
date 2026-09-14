---
title: "About Compute Central and Sameer Alam"
icon: lucide/user-round
description: "Who writes Compute Central, how the guides are researched, tested, and kept current, and how to report a technical error."
tags:
  - About
hide:
  - toc
---

# About Compute Central

Compute Central is a free, independent knowledge base for people who build and run infrastructure: Linux, networking, containers, Kubernetes, cloud, automation, CI/CD, reliability, and security. It grew from personal learning notes started in 2016 into a structured set of learning tracks.

## The Author

**Sameer Alam** — DevOps Engineer and SRE.

I build and run reliable, automated, observable, and secure systems, and write down what I learn along the way. Compute Central brings a decade of notes, experiments, and real-world lessons into one organized place.

Focus areas:

- Infrastructure design
- Deployment automation
- Monitoring
- Incident response
- Platform operations

Find me on:

- [GitHub](https://github.com/sameeralam3127)
- [Medium](https://medium.com/@sameeralam3127)
- [Blog archive](https://compute-central.blogspot.com/)

## How the Guides Are Written

Every guide aims to be useful to someone doing the work, not just reading about it:

- **Start from the problem.** Pages explain why a tool or practice exists and when it's the wrong choice, not only how to use it.
- **Show working examples.** Commands and configuration are complete enough to run, with the expected output where it helps.
- **Cover failure modes.** Most pages end with common mistakes and the questions that come up in real incidents and interviews.
- **Prefer official sources.** Behavior is checked against the official documentation for each tool, and pages link to it where detail matters.

## How Examples Are Checked

Where it's practical, configuration and code are validated with the tool's own checker before publishing — for example `promtool` and `amtool` for Prometheus and Alertmanager rules, `loki -verify-config` for Loki, `docker compose config` for Compose files, `terraform fmt` for Terraform snippets, `k6 inspect` for load tests, ShellCheck for Bash, and pytest and Ruff for Python examples. Tool versions shown on a page are the versions checked when it was last updated.

Examples use placeholder names such as `example.com`, `example-org`, and `acme`. Always review commands before running them against shared or production systems.

## Keeping Pages Current

DevOps tooling changes quickly. Each page shows the date it was last updated, taken from the site's version history, so you can judge how current it is. Pages are revised when tools release breaking changes, when official guidance changes, or when a better approach becomes standard.

## Independence

Compute Central isn't sponsored by, affiliated with, or endorsed by any vendor mentioned on the site. Paid and commercial products are discussed for learning purposes only; check each vendor's current documentation, pricing, and license terms before relying on them. All product names and trademarks belong to their respective owners.

## Report an Error

If you find a technical mistake or an outdated command, reach out through [GitHub](https://github.com/sameeralam3127) or [Medium](https://medium.com/@sameeralam3127) with the page URL and what's wrong. Corrections are welcome and appreciated.
