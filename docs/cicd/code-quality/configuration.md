---
title: "SonarQube Configuration: Database, systemd, HTTPS"
icon: lucide/settings
description: Configure SonarQube for real use — database settings, JVM memory, a systemd service, an Nginx HTTPS proxy, first-login hardening, backups, and upgrades.
tags:
  - SonarQube
  - Configuration
  - Database
---

# SonarQube Configuration

## What You'll Learn

- The `sonar.properties` settings that matter on a native install
- How to run SonarQube as a systemd service with the right limits
- How to put SonarQube behind HTTPS with Nginx
- What to lock down on first login, and how to back up and upgrade safely

If you used the Docker Compose option in [Installation](installation.md), the database settings are already passed as environment variables — skip to [Put SonarQube Behind HTTPS](#put-sonarqube-behind-https).

## Configure `sonar.properties`

```bash
sudo -u sonar nano /opt/sonarqube/conf/sonar.properties
```

```properties title="/opt/sonarqube/conf/sonar.properties"
# Database
sonar.jdbc.username=sonar
sonar.jdbc.password=use-a-long-random-password
sonar.jdbc.url=jdbc:postgresql://localhost:5432/sonar

# Listen only on localhost; Nginx handles external traffic
sonar.web.host=127.0.0.1
sonar.web.port=9000

# Keep data and temp files on a disk you back up and monitor
sonar.path.data=/var/lib/sonarqube/data
sonar.path.temp=/var/lib/sonarqube/temp
```

Every setting also has an environment-variable form (`SONAR_JDBC_URL`, `SONAR_WEB_HOST`, …), which is how the Docker image is configured.

If you move the data directories, create them first:

```bash
sudo mkdir -p /var/lib/sonarqube/{data,temp}
sudo chown -R sonar:sonar /var/lib/sonarqube
```

### Memory for the three processes

The defaults suit a small instance. Increase them as projects and analysis volume grow:

```properties
sonar.web.javaOpts=-Xmx1G -Xms256m -XX:+HeapDumpOnOutOfMemoryError
sonar.ce.javaOpts=-Xmx2G -Xms512m -XX:+HeapDumpOnOutOfMemoryError
sonar.search.javaOpts=-Xmx2G -Xms2G -XX:MaxDirectMemorySize=1G -XX:+HeapDumpOnOutOfMemoryError
```

| Process | Grows with |
|---|---|
| Web (`sonar.web`) | Number of concurrent UI and API users |
| Compute engine (`sonar.ce`) | Size of analysis reports and how many run at once |
| Search (`sonar.search`) | Total issues and components indexed — set `-Xms` equal to `-Xmx` |

## Run SonarQube as a systemd Service

```ini title="/etc/systemd/system/sonarqube.service"
[Unit]
Description=SonarQube
After=network.target postgresql.service

[Service]
Type=forking
User=sonar
Group=sonar
ExecStart=/opt/sonarqube/bin/linux-x86-64/sonar.sh start
ExecStop=/opt/sonarqube/bin/linux-x86-64/sonar.sh stop
LimitNOFILE=131072
LimitNPROC=8192
TimeoutStartSec=5min
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sonarqube
sudo systemctl status sonarqube
tail -f /opt/sonarqube/logs/sonar.log
```

Wait for `SonarQube is operational`, then confirm:

```bash
curl -s http://localhost:9000/api/system/status
```

### Where to look when it doesn't start

| Log | Shows |
|---|---|
| `logs/sonar.log` | Process launcher — which child process died |
| `logs/es.log` | Elasticsearch: kernel limits, disk watermarks, heap |
| `logs/web.log` | Database connection, migrations, plugins |
| `logs/ce.log` | Background analysis report processing |

## Put SonarQube Behind HTTPS

Tokens and passwords travel with every request, so never expose port 9000 directly.

```nginx title="/etc/nginx/sites-available/sonarqube"
server {
    listen 80;
    server_name sonar.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name sonar.example.com;

    ssl_certificate     /etc/letsencrypt/live/sonar.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sonar.example.com/privkey.pem;

    # Analysis reports from large projects can be big
    client_max_body_size 100m;

    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/sonarqube /etc/nginx/sites-enabled/
sudo certbot certonly --nginx -d sonar.example.com
sudo nginx -t && sudo systemctl reload nginx
```

Then set **Administration → Configuration → General → Server base URL** to `https://sonar.example.com` so links in emails, webhooks, and pull request comments are correct.

## First Login Checklist

Open the server URL and sign in with `admin` / `admin`. SonarQube makes you change the password immediately. Then:

1. **Create a personal admin account** (or connect SSO), and stop using the shared `admin` account day to day.
2. **Force authentication** — **Administration → Security → Force user authentication** — so anonymous visitors can't browse code.
3. **Review default permissions** — by default any logged-in user can create projects; restrict **Create Projects** to a group.
4. **Create tokens per purpose** — a project analysis token per CI job rather than one user token everywhere (see [Jenkins Integration](jenkins-integration.md#step-1-create-an-analysis-token)).
5. **Set the base URL** as above, and configure outgoing email if you want notifications.

## Back Up SonarQube

All important state is in the database — projects, history, quality gates, users, and settings. The Elasticsearch index under `data/` is rebuilt automatically.

```bash
# Consistent logical backup, safe while SonarQube runs
sudo -u postgres pg_dump -Fc sonar > /backup/sonar-$(date +%F).dump

# Restore into an empty database
sudo -u postgres pg_restore -d sonar --clean /backup/sonar-2026-09-14.dump
```

Also keep a copy of `conf/sonar.properties` and any plugins in `extensions/plugins/`.

## Upgrade Safely

1. Read the release notes for your target version, including plugin compatibility.
2. Back up the database.
3. Stop SonarQube.
4. Unpack the new version to a fresh directory (or change the Docker image tag). Copy `sonar.properties` settings across — don't overwrite the new file wholesale.
5. Start the new version, open `https://sonar.example.com/setup`, and follow the database migration prompt.
6. Once `api/system/status` reports `UP`, run an analysis on a known project to confirm.

## Common Mistakes

- Exposing port 9000 directly instead of binding to localhost and serving HTTPS through a proxy.
- Leaving **Force user authentication** off on a server that holds private code.
- Sizing only `sonar.web.javaOpts` and wondering why large analyses fail in the compute engine.
- Backing up the `data/` directory but not the database, which holds everything that matters.
- Upgrading across many versions at once without reading the migration notes or taking a backup first.

## Interview Questions

- Where does SonarQube store analysis history, and what exactly would you back up?
- How would you secure a self-hosted SonarQube server exposed to your whole company?
- Which log would you check first if SonarQube starts and immediately stops, and why?
- How do you upgrade SonarQube with minimal risk?

## Next

Continue to [Quality Gates and Profiles](quality-gates.md) to decide what the server should enforce.
