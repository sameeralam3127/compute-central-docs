---
icon: lucide/download
description: Install SonarQube on Ubuntu with PostgreSQL and Java, prepare the database user, download the server package, and continue into runtime configuration.
tags:
  - Installation
  - Ubuntu
---

# SonarQube Installation Guide for Ubuntu

This page walks through a practical SonarQube installation using PostgreSQL on Ubuntu.

## Before You Start

- Ubuntu 20.04, 22.04, or 24.04
- At least 4 GB RAM, with 8 GB preferred
- Java 17

Install Java:

```bash
sudo apt update
sudo apt install openjdk-17-jdk -y
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

## Next Step

Continue with database and runtime configuration in [configuration.md](configuration.md).
