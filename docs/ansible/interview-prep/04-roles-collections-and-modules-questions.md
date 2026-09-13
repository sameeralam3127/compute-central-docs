---
title: "Ansible Interview Questions: Roles and Collections"
icon: lucide/box
description: Ansible interview questions on roles, collections, and custom modules, with concise answers and links to the full concept pages.
tags:
  - Ansible
  - Interview Preparation
---

# Interview Prep: Roles, Collections & Modules

Each question has a short answer you can say in an interview, what a strong answer adds, and where the full explanation lives.

## Roles

### What is the standard directory structure of an Ansible role?

**Short answer:** `tasks/`, `handlers/`, `defaults/`, `vars/`, `templates/`, `files/`, and `meta/`, each with a `main.yml` where applicable. Ansible loads each directory automatically when the role runs.

**Strong answer adds:** `meta/argument_specs.yml` for input validation, `tests/` or `molecule/` for testing, and that you only create the directories a role actually needs.

Full explanation: [Role Structure](../roles/01-role-structure.md)

### What's the practical difference between `defaults/main.yml` and `vars/main.yml`?

**Short answer:** Both define role variables, but `defaults` has the **lowest** precedence of any source and `vars` has high precedence. `defaults` are meant to be overridden by consumers; `vars` are internal constants.

**Strong answer adds:** Putting a configurable value in `vars/` is a common bug — inventory can't override it, so consumers resort to `-e`.

Full explanation: [Role Structure](../roles/01-role-structure.md#defaults-vs-vars-the-roles-public-interface)

### How do role dependencies in `meta/main.yml` work, and what's the risk?

**Short answer:** Roles listed under `dependencies` run automatically before the role itself. By default a dependency runs only once per play even if several roles depend on it, unless its parameters differ or `allow_duplicates` is set.

**Misconception to avoid:** that dependencies are a clean way to compose roles. They're implicit and surprising; composing roles explicitly in the playbook is usually clearer.

Full explanation: [Role Structure](../roles/01-role-structure.md), [Production Role Design](../roles/03-production-role-design.md)

### Why namespace role variables instead of using short, generic names?

**Short answer:** Variables share one namespace per host. Two roles reading `port` read the same value, so one role's setting silently changes another's behavior. Prefixing (`nginx_port`) prevents collisions.

**Strong answer adds:** `ansible-lint`'s `var-naming` rule can enforce it; internal helper variables often use a double-underscore prefix (`__nginx_packages`).

Full explanation: [Role Variables and Interfaces](../roles/02-role-variables-and-interfaces.md)

### How would you validate a role's inputs?

**Short answer:** `meta/argument_specs.yml`. Ansible validates types, required values, and choices before the role's tasks run, with a clear error naming the parameter.

**Strong answer adds:** Cross-field rules ("TLS requires a certificate") still need `ansible.builtin.assert` at the start of `tasks/main.yml`.

Full explanation: [Role Variables and Interfaces](../roles/02-role-variables-and-interfaces.md#validating-inputs-metaargument_specsyml)

### What would you check before running a third-party Galaxy role in production?

**Short answer:** Read its tasks, handlers, and templates; check its dependencies, maintenance, and license; pin an exact version; test it with Molecule on your platforms.

**Senior follow-up:** Mirror critical third-party roles into an internal repository or private Automation Hub, so upstream changes require review before they can reach production.

Full explanation: [Production Role Design](../roles/03-production-role-design.md#4-auditing-third-party-roles)

## Collections

### What's the difference between a role and a collection?

**Short answer:** A role packages tasks, handlers, templates, and variables for one job. A collection is a distribution format that can contain many roles **plus** modules, plugins, and playbooks, under one versioned `namespace.collection` name.

**Strong answer adds:** Custom modules that roles depend on belong in the same collection, so they're versioned and released together.

Full explanation: [Collections](../collections/index.md)

### What does `galaxy.yml` declare, and why does it matter for dependency resolution?

**Short answer:** Namespace, name, version, authors, license, and `dependencies` on other collections with version ranges. `ansible-galaxy collection install` reads the dependencies to install compatible versions automatically.

**Strong answer adds:** `meta/runtime.yml` declares the supported `ansible-core` range (`requires_ansible`) and plugin redirects for renames.

Full explanation: [Collection Structure](../collections/01-collection-structure.md)

### Why should collection versions be pinned in `requirements.yml` rather than installed ad hoc?

**Short answer:** Reproducibility. Without pins, a teammate, CI, and production can each resolve a different version, and a collection update can change module behavior underneath an unchanged playbook.

**Strong answer adds:** Install per project with `-p ./collections` and `collections_path`, or ship collections inside an Execution Environment.

Full explanation: [Installing and Using Collections](../collections/02-installing-and-using-collections.md)

### Why use fully qualified collection names (FQCNs)?

**Short answer:** They say exactly which collection a module or role comes from. Short names can resolve to a different collection than intended, or to nothing once content moves.

Full explanation: [Modules](../core-concepts/04-modules.md#why-fqcns-not-short-names)

### How do you version a collection other teams depend on?

**Short answer:** Semantic versioning from the consumer's point of view: breaking changes are major, new features minor, fixes patch. Deprecate in a minor release before removing in the next major.

**Strong answer adds:** Published versions are immutable, so run `ansible-test sanity` against the built artifact before publishing.

Full explanation: [Publishing Collections](../collections/03-publishing-collections.md)

## Custom Modules

### When would you write a custom module instead of using `command` or `shell`?

**Short answer:** When you need idempotency, check mode, and structured results for something no existing module handles — typically an internal API or tool. `command` can't know the current state, so it can't honestly report `changed`.

Full explanation: [Build a Custom Module](../build-your-own/01-build-a-custom-module.md)

### What does a module have to do to correctly support check mode — not just declare it?

**Short answer:** Read current state, compute whether a change is needed, report `changed` accordingly, and skip the write when `module.check_mode` is true. `supports_check_mode=True` is a promise; Ansible doesn't simulate anything for you.

**Misconception to avoid:** that declaring check mode support makes a module safe in `--check`. A module that declares it and writes anyway makes check mode lie.

Full explanation: [ArgumentSpec, Check Mode, Idempotency, and Diff](../build-your-own/02-argumentspec-checkmode-idempotency-diff.md#check-mode-internals)

### How does `argument_spec` relate to input validation and documentation?

**Short answer:** `argument_spec` drives validation and type conversion before your code runs, including `choices`, `required_if`, and nested `options`. The `DOCUMENTATION` string, which `ansible-doc` renders, must match it, and `ansible-test sanity` checks that they agree.

Full explanation: [Build a Custom Module](../build-your-own/01-build-a-custom-module.md)

### What does `no_log=True` on a module parameter do?

**Short answer:** It replaces the parameter's value in the reported invocation and masks that value if it appears elsewhere in the output. It doesn't stop the module code from writing the secret somewhere itself.

Full explanation: [ArgumentSpec, Check Mode, Idempotency, and Diff](../build-your-own/02-argumentspec-checkmode-idempotency-diff.md#no_log-what-it-redacts)

### What changes — and what doesn't — when a standalone `library/` module moves into a collection?

**Short answer:** The code and `AnsibleModule` usage stay the same. What changes: it lives in `plugins/modules/`, it's called by FQCN, shared code moves to `plugins/module_utils/` with collection import paths, and it's versioned and released with the collection.

Full explanation: [Build a Collection From Zero](../build-your-own/03-build-a-collection-from-zero.md)

### How would you share logic across several related modules?

**Short answer:** Put it in `module_utils`. Ansible bundles imported `module_utils` files with each module when it's shipped to the managed node, so nothing extra has to be installed there.

Full explanation: [ArgumentSpec, Check Mode, Idempotency, and Diff](../build-your-own/02-argumentspec-checkmode-idempotency-diff.md#module_utils-shared-code)

## Next

Continue to [Senior & Architect Questions](05-senior-and-architect-questions.md).
