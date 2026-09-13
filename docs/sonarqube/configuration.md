---
title: "SonarQube Configuration: Database, Service, and First Login"
icon: lucide/settings
description: Configure SonarQube database settings, start the service, access the web UI, validate connectivity, and follow practical setup advice.
tags:
  - Configuration
  - Database
---

# SonarQube Configuration Guide

## What You'll Learn

- How to point SonarQube at PostgreSQL
- How to start SonarQube and reach the web UI
- Practical settings to change before real use

After installation, the next job is to point SonarQube at PostgreSQL and start the service cleanly.

## Update the Database Settings

Edit the main configuration file:

```bash
sudo nano /opt/sonarqube/conf/sonar.properties
```

Add or update these values:

```properties
sonar.jdbc.username=sonar
sonar.jdbc.password=sonar
sonar.jdbc.url=jdbc:postgresql://localhost:5432/sonar
```

## Start SonarQube

```bash
cd /opt/sonarqube/bin/linux-x86-64
sudo -u sonar ./sonar.sh start
```

Check the status:

```bash
sudo -u sonar ./sonar.sh status
```

## Access the UI

Open:

```text
http://your-server-ip:9000
```

Default credentials:

- Username: `admin`
- Password: `admin`

## Practical Advice

- Change the default password immediately
- Run SonarQube as a service for long-term use
- Keep database credentials out of screenshots and shared notes

## Quick Check

```bash
curl http://localhost:9000
```

Official guide: [Install the Server](https://docs.sonarsource.com/sonarqube/latest/setup-and-upgrade/install-the-server/)

## Common Mistakes

- Leaving the default `admin`/`admin` account.
- Exposing port 9000 directly instead of putting SonarQube behind an HTTPS reverse proxy.
- Not sizing JVM heap for the web, compute engine, and search processes.
- Not backing up the database — it holds all project history and settings.

## Interview Questions

- Where does SonarQube store analysis results?
- How would you secure access to a SonarQube server?
- Which logs would you check if SonarQube fails to start?

## Next

Continue to [Jenkins Integration](jenkins-integration.md).
