---
title: "Install kubectl and Set Up a Local Kubernetes Cluster"
icon: lucide/terminal
description: Install kubectl on Linux and macOS, understand kubeconfig and contexts, and choose between minikube, kind, Docker Desktop, and Rancher Desktop for a local cluster.
tags:
  - Kubernetes
  - Getting Started
---

# Installing kubectl and a Local Cluster

## What You'll Learn

- How to install `kubectl` on Linux and macOS
- What a kubeconfig and a context actually are, and how to switch between clusters safely
- Which local cluster tool fits your situation — minikube, kind, Docker Desktop, or Rancher Desktop

## Why This Matters

`kubectl` is the one tool you'll run hundreds of times a day once you're working with Kubernetes, and almost every "wrong cluster" incident — running a command against production when you meant a local sandbox — traces back to not understanding contexts. Getting this right once, before you have anything real at stake, is worth the ten minutes it takes.

## Installing kubectl

**Linux:**

```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
kubectl version --client
```

**macOS (Homebrew):**

```bash
brew install kubectl
kubectl version --client
```

`kubectl` itself doesn't run a cluster — it's a client that talks to whatever `kube-apiserver` your kubeconfig points at, local or remote.

## kubeconfig and Contexts

Your kubeconfig (default location `~/.kube/config`) stores three things: **clusters** (an API server address and its CA certificate), **users** (credentials), and **contexts** (a named cluster + user + default-namespace combination). Every `kubectl` command runs against whichever context is currently "current."

```bash
# See every context kubectl knows about, and which one is active
kubectl config get-contexts

# Switch the active context
kubectl config use-context minikube

# Check which context you're actually pointed at right now
kubectl config current-context

# Pin a default namespace for the current context, so you stop typing -n every time
kubectl config set-context --current --namespace=dev
```

!!! warning "Check your context before anything destructive"
    `kubectl delete`, `kubectl apply`, and `kubectl scale` all act against whatever `current-context` says — silently, with no per-command confirmation. Run `kubectl config current-context` (or use a shell prompt plugin that shows it) before any command you can't easily undo, especially once you have more than one cluster's credentials on the same laptop.

## Choosing a Local Cluster

You don't need a cloud account to learn Kubernetes — several tools run a real cluster on your own machine.

| Tool | What it actually runs | Best for | Notes |
|---|---|---|---|
| **minikube** | A single- or multi-node cluster in a VM or container | First labs, testing manifests, the most widely documented option | Supports multiple drivers (Docker, VM, bare-metal); easiest to find tutorials for |
| **kind** ("Kubernetes IN Docker") | Cluster nodes as Docker containers | Fast spin-up/teardown, CI pipelines, testing against multiple Kubernetes versions | Very fast to create and delete; less GUI tooling than the others |
| **Docker Desktop** | A single-node cluster bundled into an app you may already have | Developers who already run Docker Desktop daily | One-click enable in settings; convenient, less configurable |
| **Rancher Desktop** | A `k3s`-based cluster with a desktop UI | Developers who want a GUI and a lighter-weight distribution | Lets you switch between `containerd` and `dockerd` |

```bash
# minikube — install and start
brew install minikube          # macOS
minikube start --driver=docker
kubectl get nodes

# kind — install and create a cluster
brew install kind              # macOS
kind create cluster --name dev
kubectl get nodes

# Clean up either one when you're done
minikube delete
kind delete cluster --name dev
```

None of these are a substitute for production cluster design — backup strategy, node lifecycle, and access control still matter once you're past learning. Full step-by-step exercises using these tools live in [Labs](../labs/index.md); this page only gets you to `kubectl get nodes` returning something.

## Common Mistakes

- Running commands against the wrong context because you forgot to check `current-context` after switching projects.
- Assuming `kubectl` version and cluster version must match exactly — `kubectl` supports one minor version skew in either direction, but staying close avoids surprises with newer API fields.
- Treating a local single-node cluster as representative of multi-node scheduling, networking, or failure behavior — some things (pod anti-affinity across nodes, node failure recovery) simply can't be exercised realistically on one node.

## Interview Questions

- What's stored in a kubeconfig file, and what's a context?
- What's the practical difference between minikube and kind, and when would you pick one over the other?
- Why doesn't installing `kubectl` alone give you a running cluster?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

Continue to [Your First Deployment](04-your-first-deployment.md) to actually run something on the cluster you just set up.
