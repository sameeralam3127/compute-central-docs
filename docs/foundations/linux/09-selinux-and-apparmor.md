---
title: "SELinux and AppArmor: Fix Denials Without Disabling Them"
icon: lucide/shield-check
description: "Fix SELinux and AppArmor denials without disabling them: contexts, restorecon, semanage, booleans, audit2why, AppArmor profiles, and container labels."
tags:
  - Linux
  - Security
---

# SELinux and AppArmor

SELinux and AppArmor add a second permission check after normal file permissions. A process can own a file, have `rwx` on it, and still get "Permission denied" because the security policy says that program shouldn't touch that path or port. The fix is almost always a label, a port definition, or a boolean, not turning the system off.

## What You'll Learn

- How mandatory access control differs from normal Linux permissions
- How to tell whether SELinux or AppArmor caused a denial
- The four SELinux fixes that solve nearly every real problem
- How to read and adjust an AppArmor profile
- How both systems affect containers and Kubernetes

## Mental Model

> Normal permissions ask "does this **user** have access to this file?" Mandatory access control (MAC) asks "is this **program** allowed to do this at all?" Both must say yes. When MAC denies something, it writes an audit record, so you never have to guess.

| | SELinux | AppArmor |
|---|---|---|
| Default on | RHEL, Rocky, AlmaLinux, Fedora, CentOS Stream | Ubuntu, Debian |
| Rules are based on | **Labels** stored on every file, process, and port | **Paths** listed in a per-program profile |
| Moving a file | Keeps its old label (can cause denials) | Rules follow the new path |
| Covers | Labels everything; the default *targeted* policy confines system services, while logged-in users run unconfined | Only programs that have a profile |
| Denials logged to | `/var/log/audit/audit.log` | Kernel log, or `audit.log` if `auditd` runs |

## Is MAC the Cause?

Check this when permissions, ownership, and ACLs all look right (see [Debugging "Permission denied"](01-filesystem-and-permissions.md#debugging-permission-denied)):

```bash
# SELinux
getenforce                                     # Enforcing, Permissive, or Disabled
sudo ausearch -m AVC,USER_AVC -ts recent       # denials in the last 10 minutes

# AppArmor
sudo aa-status                                 # loaded profiles and their modes
sudo journalctl -k | grep 'apparmor="DENIED"'
```

A quick test: switch to permissive mode, retry, and switch back. If it works while permissive, MAC is the cause.

```bash
sudo setenforce 0       # SELinux permissive until reboot; denials are logged, not enforced
# ...retry the failing operation...
sudo setenforce 1       # back to enforcing
```

## SELinux

### Modes

| Mode | Effect |
|---|---|
| `Enforcing` | Denies and logs violations. The production setting. |
| `Permissive` | Logs violations but allows them. Use it for diagnosis. |
| `Disabled` | No policy loaded and no labels maintained. |

The persistent mode is `SELINUX=` in `/etc/selinux/config`. Going from disabled back to enforcing needs a full relabel (`sudo touch /.autorelabel && sudo reboot`), because files created while SELinux was off have no labels. On RHEL 9, fully disabling SELinux requires the `selinux=0` kernel argument; setting `SELINUX=disabled` in the config file is not enough. You almost never need to do either.

You can make a single domain permissive while the rest of the system stays enforcing:

```bash
sudo semanage permissive -a httpd_t      # only the web server is permissive
sudo semanage permissive -d httpd_t      # undo
```

### Contexts

Every file, process, and port has a label in the form `user:role:type:level`. In the default *targeted* policy, only the **type** matters: a process in the `httpd_t` type can read files with the `httpd_sys_content_t` type.

```bash
ls -Z /var/www/html/index.html
# unconfined_u:object_r:httpd_sys_content_t:s0 /var/www/html/index.html

ps -eZ | grep nginx
# system_u:system_r:httpd_t:s0    1234 ?  00:00:00 nginx

sudo semanage port -l | grep -w http_port_t
# http_port_t   tcp   80, 81, 443, 488, 8008, 8009, 8443, 9000
```

Install the management tools if `semanage` is missing:

```bash
sudo dnf install -y policycoreutils-python-utils setroubleshoot-server
```

### Read a denial

```bash
sudo ausearch -m AVC -ts recent
```

```text
type=AVC msg=audit(1759830000.123:412): avc:  denied  { read } for  pid=1234
comm="nginx" name="index.html" dev="nvme0n1p4" ino=8812
scontext=system_u:system_r:httpd_t:s0
tcontext=unconfined_u:object_r:user_home_t:s0 tclass=file permissive=0
```

Read it as: the `nginx` process (`scontext` type `httpd_t`) was denied `read` on a file labeled `user_home_t` (`tcontext`). A web server reading a file labeled as a home directory file: the file was moved out of someone's home directory.

Let the tools explain it and suggest the fix:

```bash
sudo ausearch -m AVC -ts recent | audit2why
sudo sealert -a /var/log/audit/audit.log       # from setroubleshoot-server; plain-English advice
```

### Fix 1: restore the default label

Files moved with `mv` keep the label from where they were created. `cp` gives the copy the destination's default label. When a file "looks right" but is denied, restore its label:

```bash
sudo restorecon -Rv /var/www/html
# Relabeled /var/www/html/index.html from unconfined_u:object_r:user_home_t:s0
#   to unconfined_u:object_r:httpd_sys_content_t:s0
```

### Fix 2: label a custom path

Serving content from a non-standard directory like `/srv/www`? Tell the policy what that path is, then apply it:

```bash
sudo semanage fcontext -a -t httpd_sys_content_t "/srv/www(/.*)?"
sudo restorecon -Rv /srv/www

# Writable paths need the read-write type
sudo semanage fcontext -a -t httpd_sys_rw_content_t "/srv/www/uploads(/.*)?"
sudo restorecon -Rv /srv/www/uploads

sudo semanage fcontext -l -C              # list your local customizations
```

Don't use `chcon` for permanent fixes. It changes the label directly, and the next `restorecon` or relabel reverts it.

### Fix 3: allow a non-standard port

A service that fails to bind with "Permission denied" on a port it should be able to use usually needs the port added to its type:

```bash
sudo semanage port -a -t http_port_t -p tcp 8081
sudo semanage port -a -t ssh_port_t -p tcp 2222    # moving sshd to another port
```

### Fix 4: turn on a boolean

Booleans are switches for common optional behavior. The classic case: Nginx as a reverse proxy returns `502 Bad Gateway`, and its error log says `connect() to 127.0.0.1:8000 failed (13: Permission denied)`.

```bash
getsebool -a | grep httpd                          # list the web server booleans
sudo setsebool -P httpd_can_network_connect on     # -P makes it survive reboots
```

| Boolean | Allows |
|---|---|
| `httpd_can_network_connect` | Web server connecting to any port (reverse proxies) |
| `httpd_can_network_connect_db` | Web server connecting to database ports only |
| `httpd_use_nfs` | Web server serving files from NFS |
| `container_manage_cgroup` | Containers that run systemd inside |

### Last resort: a local policy module

If none of the four fixes apply, generate a small policy module from the denials, **read it**, then install it:

```bash
sudo ausearch -c 'orders-api' --raw | audit2allow -M orders-api-local
cat orders-api-local.te                            # check exactly what it allows
sudo semodule -i orders-api-local.pp
```

`audit2allow` allows whatever was denied, including things that should stay denied. If the `.te` file grants broad access, such as writing to `etc_t` or `shadow_t`, fix the real problem instead.

Some denials are hidden by `dontaudit` rules. If an operation fails with no AVC logged, run `sudo semodule -DB` to log everything, reproduce the problem, then `sudo semodule -B` to restore normal logging.

## AppArmor

AppArmor confines programs that have a profile in `/etc/apparmor.d/`. Programs without a profile run unconfined.

```bash
sudo aa-status                          # profiles in enforce and complain mode, and confined processes
ls /etc/apparmor.d/
sudo apt install -y apparmor-utils      # aa-complain, aa-enforce, aa-logprof
```

### Modes

| Mode | Effect |
|---|---|
| `enforce` | Denies and logs violations |
| `complain` | Logs violations but allows them |

```bash
sudo aa-complain /usr/sbin/mysqld       # diagnose
sudo aa-enforce /usr/sbin/mysqld        # back to enforcing
```

### Read a denial

```bash
sudo journalctl -k | grep 'apparmor="DENIED"' | tail -3
```

```text
audit: type=1400 apparmor="DENIED" operation="open" profile="/usr/sbin/mysqld"
name="/data/mysql/ibdata1" pid=2211 comm="mysqld" requested_mask="r" denied_mask="r"
```

The `mysqld` profile doesn't allow reading `/data/mysql/`: the data directory was moved and the profile still lists the old path.

### Allow a new path

Don't edit the packaged profile; a package upgrade replaces it. Packaged profiles include a matching file under `/etc/apparmor.d/local/` for your additions:

```text title="/etc/apparmor.d/local/usr.sbin.mysqld"
/data/mysql/ r,
/data/mysql/** rwk,
```

```bash
sudo apparmor_parser -r /etc/apparmor.d/usr.sbin.mysqld    # reload the profile
```

`sudo aa-logprof` reads recent denials and walks you through adding rules interactively.

### Unprivileged user namespaces on Ubuntu 24.04

Ubuntu 24.04 uses AppArmor to restrict unprivileged user namespaces. Programs that create them without root, such as some browser sandboxes, rootless container tools, and build tools, fail unless an AppArmor profile allows it. Check the setting with `sysctl kernel.apparmor_restrict_unprivileged_userns`, and prefer adding a profile for the program over setting it to `0`.

## Containers and Kubernetes

Both systems confine containers by default:

- **SELinux:** container processes run as `container_t` and can only use files labeled `container_file_t`. A bind-mounted host directory is denied until you relabel it. Podman and Docker do this with a volume suffix: `:Z` for a private label (one container), `:z` for a shared label (several containers).

```bash
podman run -v /srv/app-data:/data:Z registry.example.com/app:1.4
```

- **AppArmor:** Docker applies its `docker-default` profile to every container. In Kubernetes, set a profile per pod or container with `securityContext.appArmorProfile`.

Never use `:Z` on a system directory such as `/home` or `/etc`. It relabels everything under it for one container, and the host's own services lose access.

## Common Mistakes

- Disabling SELinux or AppArmor to fix one denial, instead of fixing the label, port, or boolean.
- Using `chcon` for a permanent change; the next relabel reverts it.
- Moving files into a web root with `mv` and forgetting `restorecon`.
- Installing an `audit2allow` module without reading what it allows.
- Editing a packaged AppArmor profile instead of the file under `/etc/apparmor.d/local/`.
- Forgetting `-P` on `setsebool`, so the fix disappears at the next reboot.

## Interview Questions

- How is mandatory access control different from file permissions?
- A web server returns 403 for files with correct permissions on a RHEL host. How do you investigate?
- What's the difference between `chcon` and `semanage fcontext` followed by `restorecon`?
- Nginx can't connect to its upstream on RHEL and logs "Permission denied." What's the fix?
- What do the `:z` and `:Z` volume options do?

## Next

Continue to [Kernel Tuning: sysctl, Modules, and Limits](10-kernel-tuning-sysctl-and-modules.md).
