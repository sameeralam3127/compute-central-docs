---
title: "Linux Users, sudo, and SSH Hardening for Servers"
icon: lucide/key-round
description: Manage Linux users, groups, and service accounts, write safe sudoers rules, set up key-based SSH, harden sshd, add a firewall, and ban brute-force attempts.
tags:
  - Linux
  - Security
  - SSH
---

# Users, sudo, and SSH Hardening

## What You'll Learn

- How users, groups, and system accounts work, and when to use each
- How to grant least-privilege `sudo` access with sudoers drop-ins
- How to set up key-based SSH and a hardened `sshd` configuration without locking yourself out
- How to add a host firewall and basic brute-force protection

## Users and Groups

```bash
# A human user with a home directory and bash
sudo useradd -m -s /bin/bash -c "Priya Shah" priya
sudo passwd priya                         # or skip passwords entirely and use SSH keys

# A service account: no home login, no shell
sudo useradd --system --no-create-home --shell /usr/sbin/nologin orders

# Groups
sudo groupadd devops
sudo usermod -aG devops priya             # -a appends; without it you REPLACE all groups
id priya
getent group devops

# Lock and remove
sudo usermod -L -e 1 priya                # lock the password and expire the account
sudo userdel -r priya                     # delete the user and home directory
```

| File | Contains |
|---|---|
| `/etc/passwd` | Accounts: UID, primary GID, home, shell |
| `/etc/shadow` | Password hashes and expiry — readable only by root |
| `/etc/group` | Groups and members |

Group membership changes take effect at the user's next login.

## sudo: Least Privilege

Never edit `/etc/sudoers` directly. Use drop-in files, and always validate them.

```bash
sudo visudo -f /etc/sudoers.d/devops
```

```text title="/etc/sudoers.d/devops"
# Full sudo for the ops team, password required
%devops ALL=(ALL:ALL) ALL

# The deploy user may restart one service and nothing else, without a password
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart orders-api, /usr/bin/systemctl status orders-api
```

```bash
sudo visudo -c                           # validate every sudoers file
sudo -l -U deploy                        # what can deploy run?
```

!!! warning "Avoid shell escapes in NOPASSWD rules"
    Granting `NOPASSWD` on editors, pagers, `find`, `tar`, or scripts the user can edit is effectively full root — each can spawn a shell. Allow exact commands with exact arguments.

## Key-Based SSH

On your workstation:

```bash
ssh-keygen -t ed25519 -C "priya@laptop"
ssh-copy-id -i ~/.ssh/id_ed25519.pub priya@server.example.com
ssh priya@server.example.com
```

Permissions must be strict, or `sshd` ignores the keys:

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

A client config saves typing and centralizes bastion settings:

```text title="~/.ssh/config"
Host bastion
  HostName bastion.example.com
  User priya
  IdentityFile ~/.ssh/id_ed25519

Host app-*
  User priya
  ProxyJump bastion
  IdentityFile ~/.ssh/id_ed25519
```

## Harden `sshd`

Use a drop-in so package upgrades don't overwrite your settings. Ubuntu 24.04 and recent RHEL read `/etc/ssh/sshd_config.d/*.conf`.

```text title="/etc/ssh/sshd_config.d/10-hardening.conf"
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey

AllowGroups ssh-users
MaxAuthTries 3
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2

X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no      # set to yes on a bastion host that needs ProxyJump
```

Apply it without locking yourself out:

```bash
sudo groupadd -f ssh-users
sudo usermod -aG ssh-users priya         # make sure YOUR user is in the allowed group

sudo sshd -t                             # validate syntax; no output means OK
sudo systemctl reload ssh                # the service is "sshd" on RHEL-family systems

# Keep your current session open and test from a NEW terminal
ssh priya@server.example.com
```

!!! note "Changing the SSH port on Ubuntu 22.10 and later"
    Ubuntu uses socket activation for SSH by default, so `ssh.socket`, not the sshd process, owns the listening port. On 24.04 a systemd generator copies `Port` and `ListenAddress` from `sshd_config` into the socket, but only on `daemon-reload`: after changing the port, run `sudo systemctl daemon-reload && sudo systemctl restart ssh.socket`. (On 22.10–23.10, override `ListenStream=` with `sudo systemctl edit ssh.socket` instead.) Open the new port in the firewall first. A non-standard port reduces log noise; it isn't a security control.

## Host Firewall

```bash
# Ubuntu: ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 10.0.0.0/16 to any port 22 proto tcp   # SSH from the VPC only
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose

# RHEL family: firewalld
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-rich-rule='rule family=ipv4 source address=10.0.0.0/16 service name=ssh accept'
sudo firewall-cmd --permanent --remove-service=ssh
sudo firewall-cmd --reload
```

In the cloud, security groups are the first layer; a host firewall is defense in depth when a security group is misconfigured.

## Brute-Force Protection

```bash
sudo apt install -y fail2ban
```

```ini title="/etc/fail2ban/jail.d/sshd.local"
[sshd]
enabled  = true
backend  = systemd
maxretry = 5
findtime = 10m
bantime  = 1h
```

```bash
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

With password authentication disabled, brute-force attempts can't succeed — fail2ban mostly reduces log noise and load.

## Audit Access

```bash
last -n 20                         # recent logins
lastb -n 20 2>/dev/null            # failed logins (needs root)
journalctl -u ssh --since today | grep -E 'Accepted|Failed'
sudo grep -h -v '^#' /etc/sudoers.d/* | grep -v '^$'   # current sudo grants
awk -F: '$3 == 0 {print $1}' /etc/passwd               # UID 0 accounts — should be only root
```

At scale, replace static `authorized_keys` files with short-lived SSH certificates or a session manager (for example AWS Systems Manager Session Manager), so access can be revoked centrally and every session is logged.

## What Most Engineers Miss

- **In `sshd_config`, the first value wins.** Unlike most config files, sshd uses the first setting it reads for each keyword. Ubuntu's `sshd_config` starts with `Include /etc/ssh/sshd_config.d/*.conf`, so a cloud-init file such as `50-cloud-init.conf` with `PasswordAuthentication yes` overrides your `no` further down. Check the effective configuration with `sudo sshd -T | grep -i passwordauthentication`, and put your hardening in a file that sorts first, such as `00-hardening.conf`.
- **`ssh -G host` prints the client's effective settings** after every `Host` and `Match` block is applied, which settles "which key and user is it really using?".
- **OpenSSH 10 changed defaults.** Version 10.0 (April 2025) removed DSA keys entirely and made the post-quantum hybrid `mlkem768x25519-sha256` the default key exchange. Since 10.1 (October 2025) the client prints a warning when a connection doesn't use a post-quantum key exchange; the fix is upgrading the server, not silencing `WarnWeakCrypto`.
- **`sudo` may be the Rust rewrite.** Ubuntu 25.10 and 26.04 LTS use `sudo-rs` by default, with the original still installed as `sudo.ws`. Most sudoers files work unchanged, but test unusual options before a fleet upgrade.
- **sudo itself needs patching.** CVE-2025-32463 in sudo 1.9.14 to 1.9.17 let local users gain root through the `--chroot` option; it's fixed in 1.9.17p1 and in CISA's catalog of exploited vulnerabilities ([advisory](https://www.sudo.ws/security/advisories/chroot_bug/)).

!!! incident "Real incident: the xz backdoor (2024) and sshd's hidden dependency"
    `sshd` doesn't use xz compression, yet the backdoored xz 5.6.0 and 5.6.1 reached it: several distributions patch OpenSSH to link `libsystemd` for service notifications, and `libsystemd` pulled in `liblzma`. It was caught because SSH logins on one test machine had become measurably slower. Run `ldd "$(command -v sshd)"` to see what your SSH server really loads. The full story is in [Real Outages](../real-world-outages.md#xz-utils-2024-a-backdoor-noticed-because-ssh-got-slower).

## Common Mistakes

- `usermod -G` without `-a`, silently removing a user from every other group — including `sudo`.
- Disabling password authentication before confirming key login works, from a session you then close.
- Editing `/etc/sudoers` with a normal editor, introducing a syntax error that breaks `sudo` for everyone.
- `NOPASSWD: ALL` for automation accounts, or `NOPASSWD` on commands that can spawn a shell.
- Sharing one SSH key or one account across a team, so access can't be revoked per person and logs show no individual.
- Leaving SSH open to `0.0.0.0/0` because "keys are secure anyway".

## Check Yourself

!!! quiz "Password logins still work"
    You set `PasswordAuthentication no` at the end of `/etc/ssh/sshd_config` on Ubuntu and restarted sshd, but password logins still work. Why?

    - [ ] The restart didn't happen; `reload` is required
    - [x] A file in `/etc/ssh/sshd_config.d/` sets it to `yes`, and sshd keeps the first value it reads
    - [ ] `PasswordAuthentication` only applies to root

    The `Include` line is near the top of the main file, so drop-ins are read first. `sshd -T` shows the value sshd actually uses.

## Interview Questions

- How do you give a deploy user permission to restart a single service and nothing else?
- Walk through hardening SSH on a new server without locking yourself out.
- What's the difference between a system account and a regular user?
- Why is `NOPASSWD` on `vim` or `less` dangerous?
- How would you manage SSH access for 200 servers and 50 engineers?

## Next

Continue to [Packages and Patching](06-package-management-and-updates.md).
