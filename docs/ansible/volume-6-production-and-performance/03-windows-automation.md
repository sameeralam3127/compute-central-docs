---
icon: lucide/monitor
description: Ansible and Windows — WinRM, PowerShell, pywinrm, Windows modules, requirements, and Kerberos, NTLM, and CredSSP authentication, with troubleshooting.
tags:
  - Ansible
  - Volume 6
  - Windows
---

# Part 33 — Windows Automation

!!! info "Chapter status: outline"
    This chapter is scoped but not yet written in full prose. The sections below define what each part will cover.

Windows automation is different enough from the SSH/Python model covered everywhere else in this series that it deserves standalone treatment.

## Why This Exists

- Real enterprise environments are rarely all-Linux — this chapter equips readers to automate Windows fleets alongside Linux ones using the same Ansible control node.

## Problem Statement

- Windows doesn't ship an SSH-based remote-execution model equivalent to Unix by default, and its native scripting language is PowerShell, not Python — Ansible's Windows support has to bridge both gaps.

## Internal Architecture

- **WinRM** (Windows Remote Management): the transport protocol Ansible uses to reach Windows managed nodes, analogous to SSH's role for Linux (Volume 3, Part 15).
- **PowerShell**: Windows modules are PowerShell scripts, not Python — the managed-node execution language differs from every other chapter in this series, though the module *contract* (JSON in/out, idempotency, check mode) stays conceptually the same.
- **`pywinrm`**: the Python library the control node uses to speak WinRM, installed as an extra (`pip install pywinrm`) since it's not a core Ansible dependency (previewed in Volume 3, Part 17).

## Step-by-Step Explanation

- **Windows modules**: the `win_*`-prefixed and `ansible.windows`/`community.windows` collection modules (`win_package`, `win_service`, `win_copy`) mirroring familiar Linux module names but implemented in PowerShell.
- **Requirements**: WinRM must be enabled and configured on the target (often via a bootstrap PowerShell script Microsoft/Ansible provide), and the control node needs `pywinrm` installed.
- **Authentication methods**:
    - **Kerberos**: domain-joined authentication, generally the most secure and recommended option inside an Active Directory environment.
    - **NTLM**: works without Kerberos infrastructure but is a weaker authentication protocol, useful for non-domain or mixed environments.
    - **CredSSP**: required specifically when a task needs to make a second network hop using the same credentials (the "double-hop" problem).
- Connection variables: `ansible_connection: winrm`, `ansible_winrm_transport`, `ansible_port` (typically 5985/5986), `ansible_winrm_server_cert_validation`.

## Production Best Practices

- Preferring Kerberos authentication in domain environments over NTLM for stronger security guarantees.
- Enabling HTTPS-based WinRM (port 5986) with real certificates in production rather than unencrypted HTTP WinRM.

## Common Mistakes

- Hitting the WinRM "double-hop" problem (a task needing to authenticate onward to a second resource) without configuring CredSSP, resulting in confusing access-denied errors.
- Assuming Linux modules work unchanged against Windows hosts instead of using the dedicated `win_*`/Windows-collection modules.
- Leaving `ansible_winrm_server_cert_validation: ignore` set in production instead of using properly validated certificates.

## Performance Considerations

- WinRM connections don't benefit from SSH's ControlPersist multiplexing the same way; connection reuse and batching strategies differ from the Linux tuning in Part 32.

## Security Considerations

- Choosing the weakest sufficient authentication method deliberately (Kerberos > NTLM in most domain environments), and enabling encrypted WinRM (HTTPS) rather than plaintext.

## Interview Questions

- "How does Ansible connect to and execute automation on Windows hosts?"
- "What's the WinRM 'double-hop' problem, and how does CredSSP address it?"
- "When would you choose NTLM over Kerberos for Windows automation?"

## Hands-On Lab

- Configure `ansible_connection: winrm` against a test Windows host, verify connectivity with `ansible winserver -m win_ping`, and inspect the difference in output/behavior compared to the Linux `ping` module used throughout Volume 3.

## Summary

- Windows automation swaps SSH for WinRM and Python modules for PowerShell modules, but keeps the same conceptual contract (idempotent, JSON-returning modules) — the real complexity is in authentication method selection (Kerberos/NTLM/CredSSP) for your specific domain topology.

## Next

Continue to [Part 34 — Troubleshooting](04-troubleshooting.md).
