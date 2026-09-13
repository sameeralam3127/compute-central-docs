---
title: "Install SonarQube Server on Ubuntu With PostgreSQL"
icon: lucide/download
description: Install SonarQube on Ubuntu with PostgreSQL and Java, prepare the database user, download the server package, and continue into runtime configuration.
tags:
  - Installation
  - Ubuntu
---

# SonarQube Installation Guide for Ubuntu

## What You'll Learn

- The hardware, Java, and database prerequisites
- How to prepare PostgreSQL for SonarQube
- How to install SonarQube under a dedicated system user

This page walks through a practical SonarQube installation using PostgreSQL on Ubuntu.

## Before You Start

- Ubuntu 22.04 or 24.04
- At least 4 GB RAM, with 8 GB preferred
- Java 21 (Java 17 is deprecated in SonarQube Server 2025.x and removed from 2026.4)

Install Java:

```bash
sudo apt update
sudo apt install openjdk-21-jdk -y
java -version
```

## Step 1: Install PostgreSQL

```bash
sudo apt install postgresql postgresql-contrib -y
```

Create the database and user:

```bash
sudo -u postgres psql
```

```sql
CREATE USER sonar WITH PASSWORD 'sonar';
CREATE DATABASE sonar OWNER sonar;
GRANT ALL PRIVILEGES ON DATABASE sonar TO sonar;
\q
```

## Step 2: Download and Install SonarQube

Download the current package from the [official downloads page](https://www.sonarsource.com/products/sonarqube/downloads/).

```bash
wget https://binaries.sonarsource.com/Distribution/sonarqube/sonarqube-2026.1.2.zip
sudo apt install unzip -y
unzip sonarqube-*.zip
sudo mv sonarqube-* /opt/sonarqube
```

## Step 3: Create a Dedicated User

```bash
sudo useradd -r -m -U -d /opt/sonarqube -s /bin/false sonar
sudo chown -R sonar:sonar /opt/sonarqube
```

## Common Mistakes

- Skipping the kernel settings SonarQube's embedded Elasticsearch needs (`vm.max_map_count=524288`, `fs.file-max=131072`, and higher open-file limits), so the service won't start.
- Running SonarQube as root — Elasticsearch refuses to start as root.
- Keeping the example database password `sonar` on a real server.
- Using an unsupported Java version for your SonarQube release.

## Interview Questions

- What does SonarQube need from the operating system before it starts?
- Why does SonarQube use an external database?
- How would you run SonarQube in production differently from this guide?

## Next

Continue to [SonarQube Configuration](configuration.md) for database settings, starting the service, and first login.
