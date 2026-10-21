---
title: "Text Processing for DevOps: grep, sed, awk, and jq"
icon: lucide/text-search
description: Process logs, config files, and JSON from the command line — pipelines, grep, sed, awk, sort, uniq, cut, and jq — with real operations examples.
tags:
  - Shell
  - Bash
  - Text Processing
---

# Text Processing: grep, sed, awk, and jq

## What You'll Learn

- How pipelines and standard streams let small tools combine into powerful one-liners
- When to reach for `grep`, `sed`, `awk`, or `jq`
- Real operations examples: top error sources, request rates, config edits, and API output
- How to avoid the quoting and locale traps that make one-liners fragile

## Streams and Pipelines

Every process has three standard streams: **stdin** (0), **stdout** (1), and **stderr** (2). A pipe connects one command's stdout to the next command's stdin.

```bash
command 2>/dev/null            # discard errors
command > out.log 2>&1         # stdout and stderr to one file
command 2>&1 | tee run.log     # see output and save it
command | head -5              # the pipeline stops early; later lines are never read
```

!!! note "Pipelines and exit codes"
    By default a pipeline's exit status is the **last** command's. `grep ERROR app.log | wc -l` succeeds even if `app.log` doesn't exist. With `set -o pipefail` (part of strict mode), any failing command fails the pipeline.

## Choosing the Tool

| Tool | Best at | Example |
|---|---|---|
| `grep` | Selecting lines that match a pattern | Find error lines |
| `sed` | Editing streams: substitute, delete, insert | Change a config value |
| `awk` | Fields and columns, counting, summing, reports | Requests per status code |
| `sort`, `uniq`, `cut`, `wc` | Ordering, de-duplicating, counting | Top 10 client IPs |
| `jq` | Parsing and transforming JSON | Extract fields from API or `kubectl` output |

## grep

```bash
grep -i 'error' app.log                     # case-insensitive
grep -n -C 3 'Traceback' app.log            # line numbers with 3 lines of context
grep -v 'healthcheck' access.log            # invert: exclude matches
grep -c ' 500 ' access.log                  # count matching lines
grep -E 'timeout|refused|reset' app.log     # extended regex: alternation
grep -o 'user_id=[0-9]\+' app.log           # print only the match
grep -rIl 'password' /etc/myapp/            # recursive, skip binaries, filenames only
grep -F '[ERROR]' app.log                   # fixed string: no regex, no escaping brackets
zgrep 'ERROR' app.log.2.gz                  # search compressed rotated logs
```

## sed

```bash
sed -n '100,120p' app.log                           # print a line range
sed 's/http:/https:/g' urls.txt                     # substitute every match on each line
sed -i.bak 's/^max_connections = .*/max_connections = 500/' postgresql.conf   # in place, keep a backup
sed '/^\s*#/d; /^\s*$/d' nginx.conf                 # strip comments and blank lines
sed -n '/2026-09-14T10:00/,/2026-09-14T10:15/p' app.log   # lines between two timestamps
```

!!! warning "`sed -i` on macOS"
    GNU sed (Linux) accepts `sed -i 's/a/b/' file`. BSD sed (macOS) requires an explicit backup suffix argument: `sed -i '' 's/a/b/' file`. Scripts that run on both should use `sed -i.bak ...` and remove the backup, or use `perl -pi -e`.

For anything more structured than a single key, prefer a real parser — `yq` for YAML, `jq` for JSON, or an Ansible module — over regex edits.

## awk

`awk` splits each line into fields (`$1`, `$2`, … and `$0` for the whole line) and runs a program against it.

Given an Nginx access log:

```text
203.0.113.9 - - [14/Sep/2026:10:02:11 +0000] "GET /api/orders HTTP/1.1" 500 512 "-" "curl/8.9" 0.842
```

```bash
# Requests per status code
awk '{print $9}' access.log | sort | uniq -c | sort -rn

# Top 10 client IPs
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head

# Only 5xx responses, printing time, path, and status
awk '$9 ~ /^5/ {print $4, $7, $9}' access.log

# Average response time (last field) per path
awk '{sum[$7] += $NF; n[$7]++} END {for (p in sum) printf "%.3f %s\n", sum[p]/n[p], p}' access.log | sort -rn | head

# Custom separator: users with a login shell from /etc/passwd
awk -F: '$7 !~ /nologin|false/ {print $1, $7}' /etc/passwd
```

## sort, uniq, cut, and friends

```bash
cut -d, -f1,3 inventory.csv            # columns 1 and 3 of a CSV (no quoted commas)
sort -t, -k3,3n inventory.csv          # sort numerically by the third column
sort -u hosts.txt                      # sort and de-duplicate
uniq -c                                # count adjacent duplicates — always sort first
comm -13 <(sort old.txt) <(sort new.txt)   # lines only in new.txt
tr '[:upper:]' '[:lower:]' < names.txt
xargs -n 1 -P 4 ./check-host.sh < hosts.txt   # run 4 checks in parallel
```

## jq

```bash
sudo apt install -y jq
```

```bash
# Pretty-print and pick fields
curl -s https://api.github.com/repos/prometheus/prometheus/releases/latest | jq '{tag: .tag_name, published: .published_at}'

# Raw strings for use in shell variables
TAG=$(curl -s https://api.github.com/repos/prometheus/prometheus/releases/latest | jq -r .tag_name)

# Pods that are not Running, with their node
kubectl get pods -A -o json \
  | jq -r '.items[] | select(.status.phase != "Running") | [.metadata.namespace, .metadata.name, .status.phase, .spec.nodeName] | @tsv'

# Container images across all pods, counted
kubectl get pods -A -o json | jq -r '.items[].spec.containers[].image' | sort | uniq -c | sort -rn

# Count structured log events by level
jq -r '.level' app.json.log | sort | uniq -c

# Filter JSON log lines by a field
jq -c 'select(.level == "ERROR" and .service == "orders-api")' app.json.log

# Build JSON safely from shell variables — never by string concatenation
jq -n --arg host "$HOSTNAME" --argjson disk "$(df --output=pcent / | tail -1 | tr -dc 0-9)" \
  '{host: $host, disk_used_percent: $disk}'
```

## Worked Example: An Incident One-Liner

"Which endpoints started returning 5xx in the last 15 minutes, and from which upstream?"

```bash
since=$(date -u -d '15 minutes ago' '+%d/%b/%Y:%H:%M')
awk -v since="$since" '
  { ts = substr($4, 2, 17) }            # 14/Sep/2026:10:02
  ts >= since && $9 ~ /^5/ { count[$7" "$9]++ }
  END { for (k in count) print count[k], k }
' /var/log/nginx/access.log | sort -rn | head
```

String comparison of timestamps works here only because every line is within the same day. For anything longer, use structured JSON logs and query them in Loki or `jq`.

## Common Mistakes

- Parsing `ls` output instead of using globs or `find -print0 | xargs -0`, and breaking on filenames with spaces.
- Using `uniq` without `sort`, so non-adjacent duplicates aren't counted.
- Writing `cat file | grep` everywhere — harmless, but `grep pattern file` is clearer and gives `grep` the filename.
- Editing YAML or JSON with `sed` regexes, then corrupting the file when formatting changes.
- Building JSON with string interpolation instead of `jq --arg`, producing invalid JSON when a value contains a quote.
- Forgetting `pipefail`, so a missing input file produces an empty result instead of an error.

## Interview Questions

- How would you find the top 10 IP addresses hitting a web server from its access log?
- What's the difference between `grep`, `sed`, and `awk`, and when would you use each?
- How do you extract the names of all failing pods across namespaces with `kubectl` and `jq`?
- Why does `set -o pipefail` matter for scripts that use pipelines?

## Next

Continue to [Testing, Linting, and Debugging](03-testing-linting-and-debugging.md).
