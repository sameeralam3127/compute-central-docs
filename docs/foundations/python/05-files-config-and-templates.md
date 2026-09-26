---
title: "Python Config Files and Templates: YAML, JSON, Jinja2"
icon: lucide/file-cog
description: Handle files and configuration in Python automation — pathlib, JSON, YAML, TOML, environment overrides, Jinja2 templates, validation, and atomic writes.
tags:
  - Python
  - Configuration
  - YAML
---

# Files, Config, and Templates

## What You'll Learn

- How to work with paths and files safely using `pathlib`
- How to read and write JSON, YAML, and TOML — and the YAML pitfalls to avoid
- How to layer defaults, environment files, and environment variables into one config
- How to render config files with Jinja2 and write them atomically

## `pathlib`

```python
from pathlib import Path

base = Path("/etc/opsctl")
config_file = base / "config.yaml"          # join with /

config_file.exists()
config_file.is_file()
config_file.parent                          # /etc/opsctl
config_file.suffix                          # .yaml
config_file.stem                            # config

text = config_file.read_text(encoding="utf-8")
Path("out/report.txt").parent.mkdir(parents=True, exist_ok=True)
Path("out/report.txt").write_text("done\n", encoding="utf-8")

for log in Path("/var/log/app").glob("*.log"):            # one directory
    print(log.name, log.stat().st_size)
for manifest in Path("k8s").rglob("*.yaml"):              # recursive
    print(manifest)

home_config = Path.home() / ".config" / "opsctl" / "config.yaml"
```

Always pass `encoding="utf-8"` explicitly; the default depends on the platform.

## JSON

```python
import json

data = json.loads(Path("inventory.json").read_text(encoding="utf-8"))
Path("inventory.json").write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")

# Newline-delimited JSON logs: one object per line
with Path("app.json.log").open(encoding="utf-8") as fh:
    errors = [rec for line in fh if (rec := json.loads(line)).get("level") == "ERROR"]
```

Datetimes aren't JSON serializable. Convert them explicitly: `json.dumps(obj, default=str)`, or format with `.isoformat()`.

## YAML

```python
import yaml

with Path("values.yaml").open(encoding="utf-8") as fh:
    values = yaml.safe_load(fh)

with Path("out.yaml").open("w", encoding="utf-8") as fh:
    yaml.safe_dump(values, fh, sort_keys=False, default_flow_style=False)

# Multi-document files, such as Kubernetes manifests
with Path("manifests.yaml").open(encoding="utf-8") as fh:
    for doc in yaml.safe_load_all(fh):
        if doc:
            print(doc["kind"], doc["metadata"]["name"])
```

!!! warning "Always `safe_load`"
    `yaml.load` without a safe loader can construct arbitrary Python objects from tags in the file — code execution from a config file. Use `yaml.safe_load` and `yaml.safe_dump`.

### YAML surprises

```yaml
country: NO          # PyYAML (YAML 1.1) reads this as False
version: 1.10        # a float: 1.1
port: 0800           # may parse as an octal integer, or a string
enabled: on          # True in YAML 1.1
```

Quote values that must stay strings: `country: "NO"`, `version: "1.10"`. PyYAML also drops comments on rewrite; when you must edit a human-maintained YAML file and keep its comments and ordering, use `ruamel.yaml`.

## TOML

Python 3.11+ reads TOML in the standard library:

```python
import tomllib

with Path("pyproject.toml").open("rb") as fh:     # tomllib needs binary mode
    project = tomllib.load(fh)
print(project["project"]["version"])
```

To write TOML, use the `tomli-w` package.

## Layered Configuration

Real tools combine several sources. A clear, predictable order:

```mermaid
flowchart LR
  A["Built-in defaults"] --> B["config file"]
  B --> C["environment-specific file"]
  C --> D["environment variables"]
  D --> E["command-line flags"]
  E --> F["Validated config object"]
```

```python title="src/opsctl/config.py"
import copy
import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml

MAX_TIMEOUT_SECONDS = 120

DEFAULTS = {
    "region": "us-east-1",
    "timeout_seconds": 10,
    "health_endpoints": [],
    "notify": {"slack_channel": None},
}


def deep_merge(base: dict, override: dict) -> dict:
    merged = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


@dataclass(frozen=True)
class Config:
    environment: str
    region: str
    timeout_seconds: int
    health_endpoints: list[str] = field(default_factory=list)
    slack_channel: str | None = None

    def __post_init__(self) -> None:
        if self.environment not in {"dev", "staging", "prod"}:
            raise ValueError(f"unknown environment: {self.environment!r}")
        if not 1 <= self.timeout_seconds <= MAX_TIMEOUT_SECONDS:
            raise ValueError(f"timeout_seconds must be between 1 and {MAX_TIMEOUT_SECONDS}")


def load_config(environment: str, config_dir: Path = Path("config")) -> Config:
    data = copy.deepcopy(DEFAULTS)   # never modify the module-level defaults
    for name in ("base.yaml", f"{environment}.yaml"):
        path = config_dir / name
        if path.exists():
            data = deep_merge(data, yaml.safe_load(path.read_text(encoding="utf-8")) or {})

    # Environment variables win over files
    if region := os.environ.get("OPSCTL_REGION"):
        data["region"] = region
    if timeout := os.environ.get("OPSCTL_TIMEOUT_SECONDS"):
        data["timeout_seconds"] = int(timeout)

    return Config(
        environment=environment,
        region=data["region"],
        timeout_seconds=data["timeout_seconds"],
        health_endpoints=list(data["health_endpoints"]),
        slack_channel=data["notify"]["slack_channel"],
    )
```

Validating in one place means a typo like `timeout_seconds: "ten"` fails at startup with a clear message, not halfway through a run. The `copy.deepcopy` matters too: assigning `data = DEFAULTS` and then setting `data["region"]` would silently change the defaults for every later call in the same process, a classic source of tests that pass alone and fail together. For larger schemas, `pydantic` provides validation, type coercion, and good error messages.

Keep **secrets out of config files**. Reference them by name and fetch them at runtime from a secrets manager or environment variables injected by the platform.

## Rendering Config Files With Jinja2

```jinja title="templates/nginx-upstream.conf.j2"
# Managed by opsctl — do not edit by hand
upstream {{ service }} {
    least_conn;
{% for backend in backends %}
    server {{ backend.host }}:{{ backend.port }}{% if backend.weight %} weight={{ backend.weight }}{% endif %};
{% endfor %}
    keepalive {{ keepalive | default(32) }};
}
```

```python
from jinja2 import Environment, FileSystemLoader, StrictUndefined

env = Environment(
    loader=FileSystemLoader("templates"),
    undefined=StrictUndefined,      # a missing variable is an error, not an empty string
    trim_blocks=True,
    lstrip_blocks=True,
    keep_trailing_newline=True,
    autoescape=False,               # config files, not HTML
)

rendered = env.get_template("nginx-upstream.conf.j2").render(
    service="orders_api",
    backends=[{"host": "10.0.2.15", "port": 8080}, {"host": "10.0.2.16", "port": 8080, "weight": 2}],
)
```

Without `StrictUndefined`, a misspelled variable renders as an empty string and produces a config file that looks valid but isn't. The same templating language is used by [Ansible templates](../../ansible/jinja2-and-templates/index.md).

## Atomic Writes

If a process crashes halfway through writing a config file, readers can see a truncated file. Write to a temporary file in the same directory, then rename it into place — renames are atomic on the same filesystem:

```python
import os
import tempfile
from pathlib import Path

def atomic_write(path: Path, content: str, mode: int = 0o644) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(content)
            fh.flush()
            os.fsync(fh.fileno())
        os.chmod(tmp, mode)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise
```

Only rewrite when content changes, so file watchers and reloads don't trigger needlessly:

```python
target = Path("/etc/nginx/conf.d/orders-upstream.conf")
if not target.exists() or target.read_text(encoding="utf-8") != rendered:
    atomic_write(target, rendered)
    subprocess.run(["nginx", "-t"], check=True, timeout=30)
    subprocess.run(["systemctl", "reload", "nginx"], check=True, timeout=30)
```

## Common Mistakes

- `yaml.load` instead of `yaml.safe_load`.
- Unquoted YAML values like `NO`, `on`, or `1.10` changing type silently.
- Rendering templates without `StrictUndefined`, shipping configs with empty values.
- Writing config files in place, so a crash or full disk leaves a truncated file.
- Scattering `os.environ` lookups throughout the code instead of loading and validating config once.
- Putting secrets in YAML config files committed to Git.

## Interview Questions

- Why is `yaml.safe_load` important?
- How would you layer defaults, per-environment files, and environment variables into one configuration?
- Why use `StrictUndefined` in Jinja2?
- How do you update a config file so that readers never see a partially written file?

## Next

Continue to [Testing, Linting, and Packaging](06-testing-linting-and-packaging.md).
