---
icon: lucide/git-pull-request
description: Contributing to Ansible Core and community collections — developer setup, running the test suite, building documentation, creating modules, submitting pull requests, and coding standards.
tags:
  - Ansible
  - Volume 5
  - Contributing
---

# Part 30 — Contributing to Ansible

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

Everything in this volume builds toward this chapter: how to take a module or plugin you wrote for internal use and turn it into a real upstream contribution.

## Why This Exists

- Ansible's module/collection ecosystem is community-sustained — this chapter closes the loop from "consumer of Ansible" to "contributor to Ansible," which is also where Volume 3's source-code tour pays off directly.

## Problem Statement

- Upstream projects have process requirements (DCO/CLA sign-off, coding standards, changelog fragments, review cycles) that aren't obvious from just reading the source — skipping them is the most common reason first-time contributions stall.

## Internal Architecture / Contribution Surfaces

- **`ansible-core`** itself (`github.com/ansible/ansible`) — the engine, for deep/internal contributions.
- **Individual collection repositories** (`github.com/ansible-collections/*`) — where most module/plugin contributions actually land, each with its own maintainers and specific conventions.

## Step-by-Step Explanation

1. **Developer setup**: cloning the target repository, creating a virtualenv, installing in editable mode (`pip install -e .`), matching the contribution guide's exact setup steps (which vary slightly between `ansible-core` and individual collections).
2. **Running tests**: `ansible-test sanity`, `ansible-test units`, and `ansible-test integration` locally before opening a PR (ties directly into Part 27).
3. **Building docs**: generating and locally previewing documentation changes so `DOCUMENTATION`/`EXAMPLES`/`RETURN` blocks render correctly.
4. **Creating modules**: following the collection's module template and existing sibling modules' conventions closely, since consistency is itself a review criterion.
5. **Changelog fragments**: most collections require a `changelogs/fragments/*.yml` file describing the change, generated or hand-written per the project's `antsibull-changelog` conventions.
6. **Submitting PRs**: a clear PR description, passing CI, and responding to reviewer feedback iteratively — realistic expectations about review timelines for a volunteer-maintained ecosystem.
7. **Coding standards**: PEP 8 plus Ansible-specific conventions enforced by `ansible-test sanity` and `black`/`ruff` (Part 28) — these are checked automatically, not just style guidance.

## Production Best Practices

- Opening a small, focused PR (one module or one bug fix) rather than a large multi-feature PR, to keep review tractable for volunteer maintainers.
- Engaging on the relevant GitHub issue or the Ansible community forum *before* writing a large contribution, to confirm the approach is wanted upstream.

## Common Mistakes

- Skipping the DCO sign-off (`git commit -s`) required by most Ansible repositories, causing CI to block the PR on a technicality unrelated to the code itself.
- Not running `ansible-test sanity` locally first, leading to a PR that immediately fails CI on style/documentation-completeness checks.
- Reinventing a helper that already exists in `module_utils`, missed because the source-code tour (Volume 3, Part 19) wasn't done first.

## Performance Considerations

- N/A directly — this chapter is process-focused, not runtime-focused.

## Security Considerations

- Security-relevant fixes often have a separate, more discreet reporting process (private security disclosure) rather than a public PR — worth knowing before publicly disclosing a vulnerability via a normal issue/PR.

## Interview Questions

- "What steps would you take before opening a pull request against an Ansible collection?"
- "Why do most Ansible repositories require a changelog fragment with each PR?"
- "What's the difference between contributing to ansible-core versus a community collection?"

## Hands-On Lab

- Fork a small community collection, fix a real open "good first issue," run `ansible-test sanity` and `units` locally, add a changelog fragment, and open a draft PR following the repository's contribution guide.

## Summary

- Contributing successfully to Ansible is as much about process (DCO, changelog fragments, focused PRs, CI passing locally first) as it is about code quality — this chapter, paired with Volume 3's source tour, is the complete path from user to contributor.

## Next

Volume 5 is complete. Continue to [Volume 6: Production Best Practices, Performance & Troubleshooting](../volume-6-production-and-performance/index.md).
