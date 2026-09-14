---
title: "Git Repository Hygiene: Commits, Signing, Hooks, and Secrets"
icon: lucide/users
description: "Keep Git repositories healthy — commit conventions, signed commits, pre-commit hooks, protected branches, large files, and leaked secrets."
tags:
  - Git
  - Collaboration
  - Security
---

# Collaboration and Repository Hygiene

## What You'll Learn

- How to write commit messages and pull requests that help reviewers and future you
- How to sign commits so their authorship can be verified
- How pre-commit hooks catch problems before they reach CI
- How to protect important branches, handle large files, and respond to a leaked secret

## Commit Messages

A good message explains **why** the change was made. The diff already shows what.

```text
Retry order submission on 503 with exponential backoff

The payment provider returns 503 during its nightly failover, which
failed about 40 checkouts a night. Retry up to 3 times with jittered
backoff, only for idempotent submission calls.

Refs: OPS-142
```

- Subject line in the imperative mood ("Add", "Fix", not "Added"), about 50–72 characters, no trailing period.
- A blank line, then a body wrapped at about 72 characters when context is needed.
- Reference tickets or incidents.

### Conventional Commits

Many teams use a machine-readable prefix, which tools like release-please and semantic-release use to generate changelogs and version numbers:

```text
feat(orders): retry submission on 503
fix(api): return 404 instead of 500 for unknown order IDs
docs: add runbook for payment provider failover
chore(deps): bump urllib3 to 2.5.0
feat(auth)!: require OAuth tokens for the admin API

BREAKING CHANGE: API keys are no longer accepted on /admin endpoints.
```

| Prefix | Version bump |
|---|---|
| `fix:` | Patch (`2.4.0` → `2.4.1`) |
| `feat:` | Minor (`2.4.0` → `2.5.0`) |
| `!` or `BREAKING CHANGE:` | Major (`2.4.0` → `3.0.0`) |

## Pull Requests That Get Reviewed Quickly

- **Small.** Aim for a change a reviewer can understand in one sitting — a few hundred lines at most.
- **One purpose.** Don't mix a refactor, a dependency bump, and a feature.
- **Describe why and how to verify.** What problem does it solve? How was it tested? What's the rollback?
- **Draft early** for design feedback before polishing.

```markdown title=".github/pull_request_template.md"
## Why

## What changed

## How I tested it

## Rollback plan

- [ ] Tests added or updated
- [ ] Dashboards or alerts updated if behavior changed
```

## Signed Commits

Anyone can set `user.email` to your address. Signing proves a commit was made by someone holding your key. SSH keys are the simplest option:

```bash
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true
git config --global tag.gpgsign true
```

Add the same public key to your Git host as a **signing key** (on GitHub: **Settings → SSH and GPG keys → New SSH key → Key type: Signing Key**). Commits then show as **Verified**.

```bash
# Verify locally: list trusted signers, then check
echo "priya@example.com $(cat ~/.ssh/id_ed25519.pub)" >> ~/.config/git/allowed_signers
git config --global gpg.ssh.allowedSignersFile ~/.config/git/allowed_signers
git log --show-signature -1
```

## Pre-Commit Hooks

The [pre-commit](https://pre-commit.com) framework runs checks on staged files before each commit, with versions pinned in the repository so everyone runs the same tools.

```yaml title=".pre-commit-config.yaml"
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v6.0.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-merge-conflict
      - id: check-added-large-files
        args: ["--maxkb=1024"]
      - id: detect-private-key

  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.30.1
    hooks:
      - id: gitleaks
```

```bash
pipx install pre-commit
pre-commit install                 # installs the Git hook in .git/hooks
pre-commit autoupdate              # move hooks to their latest releases
pre-commit run --all-files
```

Hooks run on developers' machines and can be skipped with `--no-verify`, so **run the same checks in CI** as the real enforcement.

## Protect Important Branches

On GitHub (rulesets or branch protection), GitLab (protected branches), or similar:

| Rule | Why |
|---|---|
| Require a pull request before merging | No unreviewed changes reach `main` |
| Require status checks to pass | Broken builds can't merge |
| Require branches to be up to date, or use a merge queue | Tests run against what will actually be merged |
| Block force pushes and deletion | History can't be rewritten or lost |
| Require signed commits (optional) | Authorship is verifiable |
| Require review from code owners | The right people approve sensitive areas |

### CODEOWNERS

```text title=".github/CODEOWNERS"
# Default reviewers
*                        @acme/platform-team

# Infrastructure and pipelines need platform review
/terraform/              @acme/platform-team
/.github/workflows/      @acme/platform-team @acme/security

# Payments code needs the payments team
/services/payments/      @acme/payments
```

With "Require review from Code Owners" enabled, a pull request touching `/terraform/` can't merge without platform approval.

## `.gitignore` and `.gitattributes`

```gitignore title=".gitignore"
# Dependencies and build output
node_modules/
.venv/
dist/
target/

# Local configuration and secrets
.env
*.pem
*.tfstate
*.tfstate.*
.terraform/

# Editor and OS files
.idea/
.vscode/
.DS_Store
```

```gitattributes title=".gitattributes"
* text=auto eol=lf
*.sh text eol=lf
*.bat text eol=crlf
*.png binary
```

`.gitignore` only affects untracked files. If a file is already committed, remove it from the index first: `git rm --cached .env`.

## Large Files and Big Repositories

Git stores every version of every file forever, so large binaries bloat every clone.

- Keep build artifacts, datasets, and container images **out of Git** — use an artifact registry, object storage, or DVC.
- For binaries that must be versioned alongside code (design assets, small models), use **Git LFS**:

```bash
git lfs install
git lfs track "*.psd"
git add .gitattributes
```

- For very large repositories, clone less:

```bash
git clone --filter=blob:none https://github.com/acme/monorepo.git   # partial clone: fetch file contents on demand
git sparse-checkout set services/orders libs/common                 # only check out the paths you need
git clone --depth 1 https://github.com/acme/app.git                 # shallow: fine for CI builds, not for development
```

## Responding to a Leaked Secret

A credential pushed to a repository — even for seconds, even on a branch later deleted — must be treated as compromised. Bots scan public repositories continuously.

1. **Revoke and rotate the credential first.** This is the only step that actually stops misuse.
2. **Check for misuse** in the provider's audit logs (CloudTrail, GitHub audit log, database logs).
3. **Remove it from history** if the repository is shared, using `git filter-repo`:

```bash
pipx install git-filter-repo
git clone --mirror git@github.com:acme/app.git && cd app.git

# Replace the secret string everywhere in history
echo 'AKIAABCDEFGHIJKLMNOP==>REDACTED' > ../replacements.txt
git filter-repo --replace-text ../replacements.txt
# or remove a whole file from every commit
git filter-repo --path config/prod.env --invert-paths

git push --force --mirror
```

4. **Tell collaborators to re-clone**; old clones and forks still contain the secret. Ask the Git host's support to purge cached views if needed.
5. **Prevent the next one:** secret scanning with push protection on the host, Gitleaks in pre-commit and CI, and secrets loaded from a secrets manager instead of files. See [Secrets Management](../../security/02-secrets-management-with-vault.md).

## Common Mistakes

- Commit messages like "fix", "wip", and "updates" that make history and `git blame` useless.
- Relying only on local hooks, which are optional, instead of enforcing the same checks in CI.
- No branch protection, so a force-push to `main` rewrites shared history.
- Rewriting history to remove a secret **instead of** rotating it.
- Committing `.env`, Terraform state, or kubeconfig files, then adding them to `.gitignore` without removing them from the index.
- Committing large binaries and making every clone and CI run slower forever.

## Interview Questions

- What makes a good commit message?
- How do Conventional Commits enable automated releases?
- Why sign commits, and how does SSH signing work?
- Someone pushed an AWS access key to a public repository. What do you do, in order?
- Which branch protection rules would you enable on `main` for a production service?

## Next

You've finished Git. Continue to [Python Automation](../python/index.md), or put this into practice with [CI/CD Pipelines](../../cicd/index.md).
