---
title: "Integrate SonarQube With Jenkins"
icon: lucide/plug
description: Integrate SonarQube with Jenkins by installing the plugin, adding the SonarQube server, configuring scans, and preparing pipeline quality checks.
tags:
  - Jenkins
  - Integration
---

# SonarQube and Jenkins Integration Guide

## What You'll Learn

- How to install the SonarQube Scanner plugin
- How to register the SonarQube server and token in Jenkins
- What quality gate enforcement needs from both sides

This setup lets Jenkins run code analysis during pipeline execution instead of treating quality checks as a separate manual task.

## Step 1: Install the Plugin

1. Open Jenkins.
2. Go to **Manage Jenkins** > **Manage Plugins**.
3. Search for **SonarQube Scanner**.
4. Install it and restart Jenkins if required.

## Step 2: Add the SonarQube Server

1. Go to **Manage Jenkins** > **Configure System**.
2. Find the **SonarQube servers** section.
3. Click **Add SonarQube**.
4. Fill in:

- Name: `SonarQube`
- Server URL: `http://your-sonarqube-server:9000`
- Server authentication token: generate this in SonarQube under account security settings

## Why This Matters

Once Jenkins knows the SonarQube server, pipelines can:

- Send analysis results automatically
- Wait for quality gate status
- Fail a build when code quality does not meet the standard

## Common Mistakes

- Pasting the SonarQube token into a `Jenkinsfile` instead of storing it as a Jenkins credential.
- Forgetting the SonarQube webhook to `https://<jenkins>/sonarqube-webhook/`, so `waitForQualityGate` waits forever.
- Using one admin token for every project instead of scoped tokens.
- Configuring the integration but never failing builds on a red gate.

## Interview Questions

- How does Jenkins learn the quality gate result after analysis finishes?
- Where should the SonarQube token live?
- What happens to a pipeline when the quality gate fails?

## Next

Continue to the [Pipeline Example](pipeline-example.md).

Use the example in [pipeline-example.md](pipeline-example.md) to add scanning to a real pipeline.

Official reference: [SonarQube Jenkins integration](https://docs.sonarsource.com/sonarqube/latest/analyzing-source-code/ci-integration/jenkins-integration/)
