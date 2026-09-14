---
title: "Testing Python Automation: pytest, Mocks, Ruff, mypy, and CI"
icon: lucide/flask-conical
description: "Test and ship Python automation — pytest, mocking HTTP with respx and AWS with moto, Ruff, mypy, CI with uv, and packaging a CLI."
tags:
  - Python
  - Testing
  - CI/CD
---

# Testing, Linting, and Packaging

## What You'll Learn

- How to write focused tests with pytest fixtures, parametrization, and temporary files
- How to test code that calls HTTP APIs and AWS, with no network or account
- How to lint and format with Ruff and catch type errors with mypy
- How to run everything in CI and ship the tool as an installable command

## Why Test Automation Code?

Automation scripts delete volumes, restart services, and change DNS. The bugs that matter — an off-by-one in an age check, a missed pagination token, a wrong region — are exactly what tests catch cheaply and production catches expensively.

## pytest Basics

```python title="tests/test_config.py"
import pytest

from opsctl.config import deep_merge, load_config


def test_deep_merge_overrides_nested_values():
    base = {"notify": {"slack_channel": None, "email": "ops@example.com"}, "region": "us-east-1"}
    override = {"notify": {"slack_channel": "#alerts"}}

    assert deep_merge(base, override) == {
        "notify": {"slack_channel": "#alerts", "email": "ops@example.com"},
        "region": "us-east-1",
    }


@pytest.mark.parametrize("bad_env", ["production", "", "PROD"])
def test_unknown_environment_is_rejected(tmp_path, bad_env):
    with pytest.raises(ValueError, match="unknown environment"):
        load_config(bad_env, config_dir=tmp_path)


def test_environment_variable_overrides_file(tmp_path, monkeypatch):
    (tmp_path / "base.yaml").write_text("region: eu-west-1\ntimeout_seconds: 10\n")
    monkeypatch.setenv("OPSCTL_REGION", "ap-south-1")

    cfg = load_config("dev", config_dir=tmp_path)

    assert cfg.region == "ap-south-1"
```

```bash
uv run pytest                  # all tests
uv run pytest -x -q            # stop at first failure, quiet output
uv run pytest -k merge         # tests matching a name
uv run pytest --lf             # rerun only the last failures
```

Built-in fixtures you'll use constantly:

| Fixture | Provides |
|---|---|
| `tmp_path` | A fresh temporary directory per test |
| `monkeypatch` | Set environment variables, attributes, or dictionary items, undone after the test |
| `capsys` | Captured stdout and stderr |
| `caplog` | Captured log records |

## Testing HTTP Calls With respx

[respx](https://lundberg.github.io/respx/) intercepts `httpx` requests, so tests never touch the network.

```python title="tests/test_health.py"
import httpx
import respx

from opsctl import health


@respx.mock
def test_check_reports_success():
    respx.get("https://api.example.com/healthz").mock(return_value=httpx.Response(200))

    result = health.check("https://api.example.com/healthz", timeout=1, backoff=0)

    assert result.ok
    assert result.status_code == 200


@respx.mock
def test_check_retries_503_then_succeeds():
    route = respx.get("https://api.example.com/healthz").mock(
        side_effect=[httpx.Response(503), httpx.Response(503), httpx.Response(200)]
    )

    result = health.check("https://api.example.com/healthz", timeout=1, backoff=0)

    assert result.ok
    assert route.call_count == 3


@respx.mock
def test_check_reports_connection_errors_as_failure():
    respx.get("https://api.example.com/healthz").mock(side_effect=httpx.ConnectError("refused"))

    result = health.check("https://api.example.com/healthz", timeout=1, backoff=0)

    assert not result.ok
```

Passing `backoff=0` turns off the waits between retries, so a retry test runs in milliseconds instead of sleeping.

## Testing AWS Code With moto

[moto](https://docs.getmoto.org/) implements AWS APIs in memory.

```python title="tests/test_aws_cleanup.py"
from datetime import UTC, datetime, timedelta

import boto3
import pytest
from moto import mock_aws

from opsctl import aws_cleanup


@pytest.fixture
def aws(monkeypatch):
    # Fake credentials so nothing can ever reach a real account
    for key, value in {
        "AWS_ACCESS_KEY_ID": "testing",
        "AWS_SECRET_ACCESS_KEY": "testing",
        "AWS_SESSION_TOKEN": "testing",
        "AWS_DEFAULT_REGION": "us-east-1",
    }.items():
        monkeypatch.setenv(key, value)
    with mock_aws():
        yield boto3.Session(region_name="us-east-1")


def test_finds_only_unprotected_unattached_volumes(aws):
    ec2 = aws.client("ec2")
    unused = ec2.create_volume(AvailabilityZone="us-east-1a", Size=100)["VolumeId"]
    ec2.create_volume(
        AvailabilityZone="us-east-1a",
        Size=50,
        TagSpecifications=[
            {"ResourceType": "volume", "Tags": [{"Key": "opsctl:keep", "Value": "yes"}]}
        ],
    )

    found = aws_cleanup.find_unattached_volumes(aws, "us-east-1", min_age_days=0)

    assert [v.volume_id for v in found] == [unused]


def test_dry_run_does_not_delete(aws):
    ec2 = aws.client("ec2")
    vol_id = ec2.create_volume(AvailabilityZone="us-east-1a", Size=10)["VolumeId"]
    vol = aws_cleanup.Volume("us-east-1", vol_id, 10, datetime.now(UTC) - timedelta(days=60), "")

    aws_cleanup.delete_volume(aws, vol, dry_run=True)

    assert ec2.describe_volumes(VolumeIds=[vol_id])["Volumes"]
```

moto is excellent for logic tests. It doesn't enforce IAM policies or every API edge case exactly, so also test critical automation against a real sandbox account before trusting it in production.

## Ruff: Linting and Formatting

[Ruff](https://docs.astral.sh/ruff/) replaces flake8, isort, pyupgrade, and Black-style formatting with one fast tool.

```toml title="pyproject.toml (excerpt)"
[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = [
    "E", "F",      # pycodestyle errors, pyflakes
    "I",           # import sorting
    "B",           # bugbear: likely bugs
    "UP",          # modern Python syntax
    "S",           # bandit: security issues (shell=True, yaml.load, hard-coded passwords)
    "SIM",         # simplifications
    "PL",          # pylint subset
]

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S101", "PLR2004"]   # allow assert and magic numbers in tests
```

```bash
uv run ruff check .            # lint
uv run ruff check --fix .      # apply safe fixes
uv run ruff format .           # format
```

The `S` rules are especially valuable for automation: they flag `subprocess` with `shell=True`, `yaml.load`, `verify=False`, and hard-coded credentials. `S603` flags **every** `subprocess` call so someone reviews it; once you've confirmed the arguments are a fixed list with no shell, mark that line with `# noqa: S603` and a short reason, as in the [systemd helper](02-cli-tools-and-subprocess.md#running-commands-with-subprocess).

## mypy: Type Checking

```toml title="pyproject.toml (excerpt)"
[tool.mypy]
python_version = "3.12"
strict = true
packages = ["opsctl"]

[[tool.mypy.overrides]]
module = ["moto.*"]
ignore_missing_imports = true
```

```bash
uv add --dev boto3-stubs[ec2,s3,sts] types-PyYAML
uv run mypy
```

Type hints catch a whole class of automation bugs before running: passing a region where a volume ID is expected, forgetting that a value can be `None`, or misspelling a dictionary key on a typed dataclass. The `boto3-stubs` packages add types for every AWS response shape.

## Pre-Commit Hooks

```yaml title=".pre-commit-config.yaml"
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.16.7
    hooks:
      - id: ruff-check
        args: [--fix]
      - id: ruff-format
```

## CI

```yaml title=".github/workflows/python.yml"
name: Python
on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.12", "3.14"]
    steps:
      - uses: actions/checkout@v7

      - uses: astral-sh/setup-uv@v7
        with:
          python-version: ${{ matrix.python-version }}
          enable-cache: true

      - name: Install
        run: uv sync --locked

      - name: Lint and format check
        run: |
          uv run ruff check .
          uv run ruff format --check .

      - name: Type check
        run: uv run mypy

      - name: Test
        run: uv run pytest -q
```

`uv sync --locked` fails if `uv.lock` doesn't match `pyproject.toml`, so dependency changes can't slip in unreviewed.

## Packaging and Distribution

With `[project.scripts]` in `pyproject.toml`, the project builds into a wheel that installs an `opsctl` command:

```bash
uv build                                   # dist/opsctl-0.1.0-py3-none-any.whl
uv tool install dist/opsctl-0.1.0-py3-none-any.whl
opsctl --help
```

Ways to distribute internal tools:

| Method | Command | Good for |
|---|---|---|
| Git tag | `uv tool install git+https://github.com/acme/opsctl@v0.3.0` | Small teams |
| Internal package index (CodeArtifact, Artifactory, GitLab) | `uv publish --index internal` then `uv tool install opsctl` | Many consumers, version pinning |
| Container image | `docker run ghcr.io/acme/opsctl:0.3.0 unused-volumes` | CI jobs and Kubernetes CronJobs |

Version with semantic versioning and tag releases, so a cron job can pin `opsctl==0.3.*` and upgrade on purpose.

## Common Mistakes

- Tests that call real APIs or AWS accounts, making them slow, flaky, and dangerous.
- Retry tests that actually sleep, turning a 1-second test suite into a 5-minute one.
- Testing only the happy path — no tests for pagination, throttling, or permission errors.
- Relying on moto alone for destructive automation, without a run against a real sandbox.
- Lint and type checks that run locally but aren't enforced in CI.
- Distributing tools by copying `.py` files onto servers, with no version and no dependency pinning.

## Interview Questions

- How do you test a function that calls an external HTTP API?
- How would you test boto3 code without an AWS account? What are the limitations?
- What does `uv sync --locked` protect against in CI?
- Which Ruff rule sets are especially useful for infrastructure automation, and why?
- How would you distribute an internal CLI tool to engineers and to CI jobs?

## Next

You've finished the Foundations track. Continue to [AWS](../../cloud/aws/index.md) to apply these skills in the cloud, or to [SRE Practices](../../sre/index.md).
