---
title: "Ansible Vault: Secrets Management Guide"
icon: lucide/lock
description: Ansible Vault and secrets management — encrypting files and values, vault IDs for multiple trust domains, and integrating an external secret manager instead.
tags:
  - Ansible
  - Production
  - Vault
  - Security
---

# Secrets and Vault

## What You'll Learn

- Every `ansible-vault` command you'll use, and when
- Whole-file encryption vs. `encrypt_string`, and the `vault_` indirection pattern
- How vault IDs separate environments so one leaked password doesn't expose everything
- How to supply vault passwords safely in CI
- Vault's real limitations, and when an external secret manager is the better answer

## Why This Exists

Secrets need to exist somewhere — playbook repos, CI systems, control nodes — without being readable by anyone who shouldn't have them. Vault is Ansible's built-in answer; an external secret manager is often the better one for larger teams.

## Mental Model

> Ansible Vault is **symmetric encryption (AES-256) for files and values in your repository**. Anyone with the vault password can decrypt; anyone without it sees ciphertext. Ansible decrypts transparently at run time, in memory, whenever a play reads an encrypted value.

## The Commands

```bash
ansible-vault create group_vars/production/vault.yml     # new encrypted file, opens $EDITOR
ansible-vault edit   group_vars/production/vault.yml     # decrypt → edit → re-encrypt
ansible-vault view   group_vars/production/vault.yml     # read-only
ansible-vault encrypt files/tls/shop.key                 # encrypt an existing file in place
ansible-vault decrypt files/tls/shop.key                 # permanently decrypt (rarely what you want)
ansible-vault rekey  group_vars/production/vault.yml     # change the password
```

Running a playbook that uses encrypted content:

```bash
ansible-playbook site.yml --ask-vault-pass
ansible-playbook site.yml --vault-password-file ~/.vault/pass.txt
```

## Pattern 1: Encrypted File With Indirection

Encrypting a whole `group_vars` file hides variable **names** too, so nobody can search for where `db_password` is defined. The standard fix is two files:

```text
inventories/production/group_vars/all/
├── vars.yml        # plaintext, readable, searchable
└── vault.yml       # encrypted
```

```yaml title="group_vars/all/vault.yml (before encryption)"
vault_db_password: "S3cure-and-long"
vault_api_token: "tok_live_8c1f..."
```

```yaml title="group_vars/all/vars.yml"
db_password: "{{ vault_db_password }}"
api_token: "{{ vault_api_token }}"
```

Tasks and roles only ever reference `db_password`. Reviewers can see *that* a secret is used and where it comes from, without seeing its value.

## Pattern 2: encrypt_string for Single Values

```bash
ansible-vault encrypt_string --vault-id prod@prompt 'S3cure-and-long' --name 'vault_db_password'
```

```yaml title="group_vars/production.yml"
db_host: db01.internal.example.com
vault_db_password: !vault |
  $ANSIBLE_VAULT;1.2;AES256;prod
  6231643965383464303433383237366234...
```

Good for a handful of secrets in otherwise plaintext files. Downside: `ansible-vault edit` can't edit inline values — you re-run `encrypt_string` and paste the result.

!!! tip "Keep secrets out of shell history"
    Omit the plaintext argument and use `--stdin-name`, then type or pipe the value: `ansible-vault encrypt_string --vault-id prod@prompt --stdin-name vault_db_password`.

## Vault IDs: Separate Trust Domains

One password for everything means a staging leak decrypts production. Label each encrypted item with a **vault ID** and use a different password per ID:

```bash
ansible-vault create --vault-id staging@prompt inventories/staging/group_vars/all/vault.yml
ansible-vault create --vault-id prod@prompt    inventories/production/group_vars/all/vault.yml
```

The ID is written into the header (`$ANSIBLE_VAULT;1.2;AES256;prod`). At run time, supply only the passwords that environment needs:

```bash
# A staging run: the production password is never present
ansible-playbook -i inventories/staging site.yml --vault-id staging@~/.vault/staging.txt

# A production run
ansible-playbook -i inventories/production site.yml --vault-id prod@~/.vault/prod.txt
```

Configure defaults in `ansible.cfg`, so nobody has to remember flags:

```ini title="ansible.cfg"
[defaults]
vault_identity_list = staging@~/.vault/staging.txt, prod@~/.vault/prod.txt
vault_id_match = True
```

`vault_id_match = True` makes Ansible try only the password whose ID matches the header, instead of trying every password on every value.

## Vault Passwords in CI

Never commit the password, and never pass it on the command line. Store it in the CI system's secret store and write it to a short-lived file:

```yaml title=".github/workflows/deploy.yml (excerpt)"
      - name: Deploy to production
        env:
          VAULT_PROD_PASSWORD: ${{ secrets.VAULT_PROD_PASSWORD }}
        run: |
          umask 077
          printf '%s' "$VAULT_PROD_PASSWORD" > "$RUNNER_TEMP/vault-prod"
          ansible-playbook -i inventories/production site.yml \
            --vault-id "prod@$RUNNER_TEMP/vault-prod"
          rm -f "$RUNNER_TEMP/vault-prod"
```

Alternatively, point `--vault-id prod@scripts/vault-pass.sh` at an **executable** script that prints the password to stdout — for example by fetching it from a cloud secret manager. Ansible runs executable password files instead of reading them.

## Keeping Decrypted Values Out of Logs

Decryption is transparent, so a decrypted value appears in output like any other variable unless you hide it:

```yaml
- name: Create the database user
  community.postgresql.postgresql_user:
    name: checkout
    password: "{{ db_password }}"
  no_log: true
```

`no_log: true` hides the task's arguments and results even at `-vvv`. Full logging hygiene is in [Security](04-security.md).

## Rotating a Secret

1. `ansible-vault edit` and change the value, then commit.
2. Run the playbook that applies the new credential to the system and its consumers.
3. Revoke the old credential in the system that issued it.

Rotating the **vault password** is `ansible-vault rekey --vault-id prod@old.txt --new-vault-id prod@new.txt <files>`. Old commits in Git history remain decryptable with the old password — rekeying doesn't protect secrets that were already exposed. If the password leaked, rotate the secrets themselves.

## Limitations, and When to Use an External Secret Manager

| Ansible Vault | External manager (HashiCorp Vault, AWS Secrets Manager, ...) |
|---|---|
| Shared symmetric password per vault ID | Per-identity access policies |
| No audit log of who decrypted what | Access audit logs |
| Rotation = edit, commit, re-run | Automatic rotation; dynamic, short-lived credentials |
| Ciphertext lives in Git history forever | Nothing secret in the repository |
| Zero extra infrastructure | Another service to run or pay for |

Vault is a solid choice for small teams and bootstrap secrets. As a team grows, fetch secrets at run time with a lookup instead of committing any encrypted value at all — see [Lookup and Filter Plugins](../advanced-execution/04-lookup-and-filter-plugins.md#pulling-secrets-at-run-time). A common hybrid: the only thing in Ansible Vault is the credential Ansible uses to authenticate to the external manager.

## Full worked example

See [Case Study: Vault Secrets](../case-studies/05-vault-secrets-case-study.md).

## Common Mistakes

- Passing a secret via `-e` on a CI command line, where it can land in shell history or process listings — see [Security](04-security.md).
- One vault password for every environment, so a staging compromise exposes production secrets too.
- Forgetting `no_log: true` on a task that decrypts and uses a secret, leaking it into readable output.
- Encrypting whole vars files without the `vault_` indirection, so nobody can find where a variable is defined.
- Committing a decrypted file after `ansible-vault decrypt` and forgetting to re-encrypt — add a pre-commit check that rejects unencrypted `vault.yml` files.
- Assuming `rekey` makes previously leaked ciphertext safe.

## Interview Questions

- How does Ansible Vault protect secrets, and what are its limitations compared to an external secret manager?
- Why would a team use multiple `--vault-id`s instead of one shared vault password?
- How would you give a CI pipeline the vault password without committing it or exposing it in logs?
- Why pair an encrypted `vault.yml` with a plaintext `vars.yml`?

## Next

Continue to [Security](04-security.md). When secrets outgrow Ansible Vault, see [Secrets Management With HashiCorp Vault](../../security/02-secrets-management-with-vault.md).
