---
title: "Kubernetes Labs: Hands-On Local Cluster Practice"
icon: lucide/flask-conical
description: Hands-on Kubernetes labs — minikube, kind, Docker Desktop, and Podman — plus guided multi-part scenarios with real, copy-pasteable commands.
tags:
  - Kubernetes
  - Labs
---

# Labs

Reading about a Deployment and actually watching one roll out are different skills. This section is the second one: real terminals, real commands, real output, on a disposable local cluster you can tear down and rebuild in minutes. Each lab is self-contained — pick the tool that matches what's already on your machine, or work through all four to see how they differ.

If you haven't touched `kubectl` yet, do [Your First Deployment](../getting-started/04-your-first-deployment.md) first — these labs assume you already know what a Deployment and a Service are and want practice running them for real, not an explanation of what they do.

## Read in this order

1. [Minikube Lab](01-minikube-lab.md) — install, start a single-node cluster, deploy and expose a real app, inspect it, clean up
2. [kind Lab](02-kind-lab.md) — a multi-node cluster from a config file, and loading a locally built image straight into it without a registry
3. [Docker Desktop Lab](03-docker-desktop-lab.md) — the built-in Kubernetes cluster most people already have installed
4. [Podman Lab](04-podman-lab.md) — daemonless containers, `podman generate kube`, and running that YAML on a real cluster
5. [Hands-On Scenarios](05-hands-on-scenarios.md) — longer guided exercises: a multi-tier app, a CI/CD pipeline, monitoring, blue-green, and a crash-loop investigation

!!! tip "Only need one local cluster?"
    Minikube and kind cover almost everyone. Reach for kind specifically when you need more than one node (to practice scheduling, affinity, or DaemonSets realistically) or when you're testing a locally built image and don't want to push it to a registry first.

## Next

Once you're comfortable running these labs by hand, continue to [Case Studies](../case-studies/index.md) to see the same tools applied to complete, realistic production scenarios.
