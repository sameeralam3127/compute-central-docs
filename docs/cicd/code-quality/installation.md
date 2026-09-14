---
title: "Install SonarQube on Ubuntu or Docker With PostgreSQL"
icon: lucide/download
description: Install SonarQube Community Build with PostgreSQL on Ubuntu or Docker Compose — Java 21, kernel settings, a dedicated user, and a verified first start.
tags:
  - SonarQube
  - Installation
  - Ubuntu
---

# SonarQube Installation

## What You'll Learn

- Which SonarQube edition and version to install, and what it needs from the host
- How to prepare PostgreSQL and the kernel settings Elasticsearch requires
- Two installation paths: Docker Compose for labs and small teams, or a native Ubuntu install
- How to confirm the server actually started

## Choose an Edition

| Edition | Cost | Branch and pull request analysis | Typical use |
|---|---|---|---|
| **Community Build** | Free | Main branch only | Learning, small teams, single-branch projects |
| Developer, Enterprise, Data Center | Paid, licensed per lines of code | Yes, with PR decoration | Teams that gate pull requests |
| SonarQube Cloud | SaaS subscription (free for public projects) | Yes | Teams that don't want to run a server |

This page installs the **Community Build**, which uses version numbers like `26.9.0.129388`. Paid SonarQube Server releases use year-based versions like `2026.1` and are downloaded from the SonarSource website after you request a license. See [Paid Platforms](paid-platforms.md) for how they compare.

## Requirements

| Resource | Minimum | Recommended for a team |
|---|---|---|
| CPU | 2 cores | 4+ cores |
| Memory | 4 GB | 8–16 GB |
| Disk | 30 GB, SSD | 100 GB+ SSD (Elasticsearch indexes are I/O heavy) |
| Java | 21 (native install only — the Docker image bundles it) | |
| Database | PostgreSQL (a version listed on the official requirements page) | Dedicated or managed PostgreSQL |

SonarQube runs three Java processes — the web server, the compute engine that processes analysis reports, and an embedded Elasticsearch for search. Memory planning has to cover all three.

## Step 1: Kernel Settings (Both Paths)

Elasticsearch refuses to start without these. On Docker, set them on the **host**, not in the container.

```bash
sudo tee /etc/sysctl.d/99-sonarqube.conf <<'EOF'
vm.max_map_count=524288
fs.file-max=131072
EOF
sudo sysctl --system

sysctl vm.max_map_count fs.file-max   # verify
```

## Option A: Docker Compose

The fastest way to a working server. Pin the image tag so upgrades are deliberate.

```yaml title="docker-compose.yml"
services:
  sonarqube:
    image: sonarqube:26.9.0.129388-community
    depends_on:
      db:
        condition: service_healthy
    environment:
      SONAR_JDBC_URL: jdbc:postgresql://db:5432/sonar
      SONAR_JDBC_USERNAME: sonar
      SONAR_JDBC_PASSWORD: ${SONAR_DB_PASSWORD:?set SONAR_DB_PASSWORD in .env}
    volumes:
      - sonarqube_data:/opt/sonarqube/data
      - sonarqube_extensions:/opt/sonarqube/extensions
      - sonarqube_logs:/opt/sonarqube/logs
    ulimits:
      nofile:
        soft: 131072
        hard: 131072
      nproc: 8192
    ports:
      - "127.0.0.1:9000:9000"
    restart: unless-stopped

  db:
    image: postgres:17
    environment:
      POSTGRES_USER: sonar
      POSTGRES_PASSWORD: ${SONAR_DB_PASSWORD:?set SONAR_DB_PASSWORD in .env}
      POSTGRES_DB: sonar
    volumes:
      - postgresql_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sonar -d sonar"]
      interval: 10s
      retries: 5
    restart: unless-stopped

volumes:
  sonarqube_data:
  sonarqube_extensions:
  sonarqube_logs:
  postgresql_data:
```

```bash
echo "SONAR_DB_PASSWORD=$(openssl rand -base64 24)" > .env
docker compose up -d
docker compose logs -f sonarqube    # wait for "SonarQube is operational"
```

The port is bound to `127.0.0.1`. Put a TLS reverse proxy in front before exposing it — see [Configuration](configuration.md#put-sonarqube-behind-https).

## Option B: Native Install on Ubuntu

### Install Java 21

```bash
sudo apt update
sudo apt install -y openjdk-21-jre-headless unzip
java -version
```

### Install and prepare PostgreSQL

```bash
sudo apt install -y postgresql
sudo -u postgres psql
```

```sql
CREATE USER sonar WITH ENCRYPTED PASSWORD 'use-a-long-random-password';
CREATE DATABASE sonar OWNER sonar;
\q
```

Making `sonar` the database owner is enough — SonarQube creates its own schema on first start.

### Create a dedicated user

Elasticsearch will not run as root, and SonarQube should never need it.

```bash
sudo useradd --system --home-dir /opt/sonarqube --shell /usr/sbin/nologin sonar
```

### Download and unpack

Check the [downloads page](https://www.sonarsource.com/products/sonarqube/downloads/) or the [release list](https://github.com/SonarSource/sonarqube/releases) for the current Community Build version.

```bash
SONAR_VERSION=26.9.0.129388
cd /tmp
wget "https://binaries.sonarsource.com/Distribution/sonarqube/sonarqube-${SONAR_VERSION}.zip"
unzip -q "sonarqube-${SONAR_VERSION}.zip"
sudo mv "sonarqube-${SONAR_VERSION}" /opt/sonarqube
sudo chown -R sonar:sonar /opt/sonarqube
```

### Raise process limits

```bash
sudo tee /etc/security/limits.d/99-sonarqube.conf <<'EOF'
sonar   -   nofile   131072
sonar   -   nproc    8192
EOF
```

The systemd unit on the next page sets the same limits for the service itself.

## Verify the Installation

After you start the service (Docker above, or systemd in [Configuration](configuration.md#run-sonarqube-as-a-systemd-service)):

```bash
curl -s http://localhost:9000/api/system/status
# {"id":"...","version":"26.9.0.129388","status":"UP"}
```

| `status` | Meaning |
|---|---|
| `STARTING` | Still booting — Elasticsearch and database migrations take a minute or two |
| `UP` | Ready |
| `DB_MIGRATION_NEEDED` | A new version is waiting for you to open `/setup` and migrate |
| `DOWN` | Check `logs/sonar.log`, `web.log`, `es.log`, and `ce.log` |

## Common Mistakes

- Skipping `vm.max_map_count`, so `es.log` shows `max virtual memory areas vm.max_map_count [65530] is too low` and the server never comes up.
- Running SonarQube as root — Elasticsearch refuses to start.
- Copying a paid-edition version like `2026.1.x` into the Community Build download URL; those files are not published there.
- Using the embedded H2 database beyond a quick demo — it can't be upgraded or scaled.
- Using `sonarqube:latest` in Compose, so a restart silently upgrades and blocks on a database migration.

## Interview Questions

- What are SonarQube's three processes, and why does memory sizing have to account for all of them?
- Why does SonarQube need `vm.max_map_count` raised, and where do you set it when running in Docker?
- What's the difference between SonarQube Community Build and the paid Server editions?

## Next

Continue to [SonarQube Configuration](configuration.md) to connect the database, run it as a service, and put it behind HTTPS.
