---
description: Learn shell scripting for DevOps and SRE automation with Bash basics, safe script structure, health checks, log scanners, backups, deployments, and debugging.
---

# Shell Scripting for SRE and DevOps Automation

Shell scripts are one of the most practical tools in infrastructure work. They let you combine operating system commands, glue together tools, automate repetitive tasks, and turn manual runbooks into repeatable workflows.

For SRE and DevOps work, shell scripting is often the fastest way to automate:

- Health checks
- Service operations
- Backup tasks
- Deployment helpers
- Log analysis
- CI/CD build steps
- Cron-based maintenance

---

## Why Shell Scripting Still Matters

Even with tools like Python, Go, Ansible, and Terraform, shell scripts remain important because they are:

- Available by default on most Linux and Unix systems
- Excellent for orchestration and system-level automation
- Easy to integrate with commands like `systemctl`, `docker`, `kubectl`, `curl`, and `rsync`
- Fast to write for operational tasks and prototypes

!!! tip "Use shell where it fits"
    Shell is great for command orchestration and glue logic. If the logic becomes very complex, data-heavy, or hard to read, it is often better to switch to Python or Go.

---

## Common Shells

Popular Unix shells include:

- **`sh`**: Basic POSIX shell
- **`bash`**: Most common shell for Linux scripting
- **`zsh`**: Powerful interactive shell, often used on macOS
- **`ksh`**: Korn shell, common in some enterprise Unix systems

For most Linux automation work, `bash` is the most common choice.

---

## Start Every Script Correctly

### Shebang

The first line tells the OS which interpreter should run the script.

```bash
#!/usr/bin/env bash
```

This is a portable way to locate `bash`.

### Safe mode

A strong default for production scripts is:

```bash
set -euo pipefail
```

What it does:

- `-e`: Exit when a command fails
- `-u`: Fail on unset variables
- `-o pipefail`: Fail a pipeline if any command inside it fails

You can also add:

```bash
set -x
```

to print commands during debugging.

---

## Core Building Blocks

### Variables

```bash
ENVIRONMENT="production"
PORT=8080
readonly APP_NAME="payments-api"
```

### Arguments

```bash
echo "Script name: $0"
echo "First argument: $1"
echo "Argument count: $#"
echo "All arguments: $@"
echo "Previous command exit code: $?"
```

### Conditionals

```bash
if [[ -f /etc/hosts ]]; then
  echo "hosts file exists"
else
  echo "hosts file missing"
fi
```

### Loops

```bash
for service in nginx sshd docker; do
  echo "Checking $service"
done
```

### Functions

```bash
log_info() {
  echo "[INFO] $1"
}

log_info "Deployment started"
```

### Case statements

```bash
case "${1:-}" in
  start) echo "Starting service" ;;
  stop) echo "Stopping service" ;;
  status) echo "Checking status" ;;
  *) echo "Usage: $0 {start|stop|status}" ;;
esac
```

---

## Useful Bash Patterns

### Default values

```bash
REGION="${AWS_REGION:-us-east-1}"
```

### Command substitution

```bash
HOSTNAME="$(hostname)"
DATE_NOW="$(date +%F)"
```

### Arrays

```bash
SERVICES=("nginx" "docker" "ssh")

for svc in "${SERVICES[@]}"; do
  echo "$svc"
done
```

### Reading a file line by line

```bash
while IFS= read -r line; do
  echo "Processing: $line"
done < servers.txt
```

### Trap for cleanup

```bash
cleanup() {
  rm -f /tmp/example.tmp
}

trap cleanup EXIT
```

---

## Script Structure Template

This is a clean starting point for operational scripts:

```bash
#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[%s] %s\n' "$(date '+%F %T')" "$1"
}

usage() {
  echo "Usage: $0 <environment>"
  exit 1
}

main() {
  local environment="${1:-}"

  [[ -n "$environment" ]] || usage

  log "Running in environment: $environment"
}

main "$@"
```

---

## Example Script 1: System Health Check

This script is useful for daily operations checks or cron jobs.

```bash
#!/usr/bin/env bash
set -euo pipefail

WARNING_DISK_THRESHOLD=80

log() {
  printf '[%s] %s\n' "$(date '+%F %T')" "$1"
}

check_disk() {
  local usage
  usage="$(df -h / | awk 'NR==2 {gsub("%","",$5); print $5}')"

  if (( usage >= WARNING_DISK_THRESHOLD )); then
    log "WARNING: Root disk usage is ${usage}%"
  else
    log "OK: Root disk usage is ${usage}%"
  fi
}

check_memory() {
  free -h
}

check_load() {
  uptime
}

main() {
  log "Starting health check"
  hostnamectl || true
  check_disk
  check_memory
  check_load
  log "Health check completed"
}

main "$@"
```

Use cases:

- Cron-based health reports
- Basic server validation after provisioning
- Quick support triage

---

## Example Script 2: Log Error Scanner

This script scans a log file for common error patterns and prints a short summary.

```bash
#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="${1:-/var/log/syslog}"

if [[ ! -f "$LOG_FILE" ]]; then
  echo "Log file not found: $LOG_FILE"
  exit 1
fi

echo "Scanning: $LOG_FILE"
echo

echo "Top error counts:"
grep -Ei 'error|failed|fatal|panic|critical' "$LOG_FILE" | \
  sed 's/[[:space:]]\+/ /g' | \
  sort | uniq -c | sort -nr | head -10
```

Use cases:

- Rapid incident triage
- Scheduled log reviews
- Pre-check before escalating to application teams

---

## Example Script 3: Backup Script with Retention

This script creates a compressed backup and deletes old backups based on retention days.

```bash
#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${1:-/etc}"
BACKUP_DIR="${2:-/var/backups/custom}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP="$(date +%F-%H%M%S)"
ARCHIVE_NAME="backup-${TIMESTAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"

tar -czf "${BACKUP_DIR}/${ARCHIVE_NAME}" "$SOURCE_DIR"
echo "Created backup: ${BACKUP_DIR}/${ARCHIVE_NAME}"

find "$BACKUP_DIR" -type f -name 'backup-*.tar.gz' -mtime +"$RETENTION_DAYS" -delete
echo "Old backups older than ${RETENTION_DAYS} days removed"
```

Use cases:

- Configuration backups
- Pre-change safety snapshots
- Simple server maintenance automation

!!! warning "Production backup note"
    For critical systems, backups should also include verification, secure storage, encryption, restore testing, and off-host copies.

---

## Example Script 4: Deployment Helper

This pattern is useful when restarting a service after pulling the latest release artifacts or configuration.

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/myapp"
SERVICE_NAME="myapp"

log() {
  printf '[%s] %s\n' "$(date '+%F %T')" "$1"
}

deploy() {
  log "Switching to application directory"
  cd "$APP_DIR"

  log "Pulling latest code"
  git pull origin main

  log "Restarting service"
  sudo systemctl restart "$SERVICE_NAME"

  log "Checking service status"
  sudo systemctl status "$SERVICE_NAME" --no-pager
}

deploy
```

Use cases:

- Simple service deployments
- Jenkins or GitLab CI shell stages
- Small internal tools on virtual machines

---

## Example Script 5: Kubernetes Rollout Checker

This script validates that a Kubernetes deployment rollout finishes successfully.

```bash
#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${1:-default}"
DEPLOYMENT_NAME="${2:-}"

if [[ -z "$DEPLOYMENT_NAME" ]]; then
  echo "Usage: $0 <namespace> <deployment-name>"
  exit 1
fi

echo "Checking rollout for deployment/${DEPLOYMENT_NAME} in namespace ${NAMESPACE}"
kubectl rollout status "deployment/${DEPLOYMENT_NAME}" -n "$NAMESPACE" --timeout=120s
kubectl get pods -n "$NAMESPACE"
```

Use cases:

- Post-deployment checks
- CD validation steps
- Quick operational validation during incidents

---

## Example Script 6: Service Monitor with Exit Codes

This is useful when a script needs to integrate with monitoring systems or CI jobs.

```bash
#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${1:-nginx}"

if systemctl is-active --quiet "$SERVICE_NAME"; then
  echo "OK: ${SERVICE_NAME} is running"
  exit 0
else
  echo "CRITICAL: ${SERVICE_NAME} is not running"
  exit 2
fi
```

Use cases:

- Nagios-style checks
- Cron alerts
- Jenkins or monitoring integrations

---

## Running a Script

Save the file, then make it executable:

```bash
chmod +x script.sh
```

Run it:

```bash
./script.sh
```

Or pass arguments:

```bash
./script.sh production
```

You can also run it directly with an interpreter:

```bash
bash script.sh
```

---

## Debugging Shell Scripts

Useful debugging techniques:

### Enable command tracing

```bash
bash -x script.sh
```

### Print line numbers on errors

```bash
trap 'echo "Error on line $LINENO"' ERR
```

### Check syntax without running

```bash
bash -n script.sh
```

### Lint with ShellCheck

```bash
shellcheck script.sh
```

!!! tip "ShellCheck is worth using"
    ShellCheck catches quoting mistakes, unsafe expansions, and common Bash pitfalls that are easy to miss in review.

---

## Best Practices

- Use `#!/usr/bin/env bash` when you are writing Bash-specific scripts
- Start with `set -euo pipefail` for safer behavior
- Quote variables like `"$VAR"` unless you intentionally want word splitting
- Prefer functions for readability and reuse
- Validate input arguments early
- Return meaningful exit codes
- Log clearly so operators can understand what happened
- Avoid hardcoding secrets in scripts
- Use `mktemp` for temporary files
- Test scripts in a safe environment before production use

---

## Common Mistakes to Avoid

- Unquoted variables:

```bash
rm -rf $DIR
```

Safer:

```bash
rm -rf "$DIR"
```

- Ignoring command failures
- Using shell for overly complex business logic
- Assuming tools like `jq`, `kubectl`, or `aws` are installed without checking
- Deleting files without validating paths
- Mixing POSIX `sh` syntax and Bash-specific syntax accidentally

---

## Integration with DevOps Workflows

Shell scripts are often used inside:

- **Jenkins** stages with `sh`
- **GitHub Actions** `run` steps
- **Cron** jobs for recurring tasks
- **Systemd** services and timers
- **Docker** entrypoint scripts
- **Kubernetes** init containers and operational jobs

Example Jenkins stage:

```groovy
stage('Backup Config') {
    steps {
        sh 'bash scripts/backup.sh /etc /var/backups/config'
    }
}
```

Example GitHub Actions step:

```yaml
- name: Run health check
  run: bash scripts/health-check.sh
```

---

## When to Use Another Language

Shell is not always the right tool. Consider Python or Go when you need:

- Complex parsing and data structures
- Heavy JSON or YAML processing
- Strong error modeling
- Cross-platform application logic
- Larger testable codebases

Use shell scripts for what they do best: command orchestration, operational automation, and fast system-level workflows.
