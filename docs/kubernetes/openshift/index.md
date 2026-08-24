---
title: "OpenShift Guide: Red Hat's Enterprise Kubernetes Platform"
icon: lucide/building-2
description: Start here for OpenShift — how it differs from vanilla Kubernetes, the oc CLI and Projects, Routes, Source-to-Image builds, and the Operator ecosystem.
tags:
  - Kubernetes
  - OpenShift
---

# OpenShift

OpenShift is Red Hat's enterprise Kubernetes distribution — the same Kubernetes you already know, plus an opinionated set of developer, security, and operational tooling layered on top. This section covers what OpenShift actually adds, how to work with it day to day via `oc`, and the platform-specific concepts (Routes, S2I builds, Operators) that don't exist in a vanilla cluster.

## Read in this order

1. [What Is OpenShift?](01-what-is-openshift.md) — how OpenShift relates to vanilla Kubernetes, Red Hat's distribution model, and OKD as the community upstream
2. [oc CLI and Projects](02-oc-cli-and-projects.md) — `oc` as a superset of `kubectl`, logging in, and Projects as namespaces with more built in
3. [Routes and Networking](03-routes-and-networking.md) — Route vs. Ingress, the built-in HAProxy router, and OpenShift's SDN/OVN-Kubernetes networking layer
4. [Source-to-Image and Builds](04-source-to-image-and-builds.md) — S2I, BuildConfig, ImageStreams, and how `oc new-app` ties them together
5. [Operators and OLM](05-operators-and-olm.md) — the Operator pattern, the Operator Lifecycle Manager, and OperatorHub as a catalog

!!! tip "Already know vanilla Kubernetes?"
    Most of what you already know transfers directly — a Deployment is still a Deployment. Focus on what's genuinely new: Projects, Routes, S2I builds, and OLM-managed Operators. Everything else is the Kubernetes you already have, with `oc` sitting on top of `kubectl`.

## Next

Continue to [Labs](../labs/index.md) to practice these concepts hands-on, including on OpenShift Local.
