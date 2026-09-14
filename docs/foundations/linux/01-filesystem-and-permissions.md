---
title: "Linux Filesystem and Permissions: Ownership, Modes, and ACLs"
icon: lucide/folder-lock
description: Learn the Linux directory layout, file ownership, permission modes, setuid, setgid, and sticky bits, umask, ACLs, and how to debug "Permission denied" errors.
tags:
  - Linux
  - Permissions
---

# Filesystem and Permissions

## What You'll Learn

- Where things live in the Linux directory tree, and why it matters in operations
- How ownership and `rwx` permissions decide who can do what
- What setuid, setgid, and the sticky bit do, and why they're security-sensitive
- How `umask` and ACLs work, and how to debug "Permission denied" methodically

## The Directory Layout

Linux follows the Filesystem Hierarchy Standard. Knowing it tells you where to look during an incident.

| Path | Contains | Operational note |
|---|---|---|
| `/etc` | System and application configuration | Back it up; manage it with Ansible instead of hand edits |
| `/var/log` | Log files | A common cause of full disks |
| `/var/lib` | Application state: databases, Docker, containerd | Often needs its own volume |
| `/opt` | Self-contained third-party software | Where tarball installs like SonarQube go |
| `/usr/bin`, `/usr/sbin` | Installed programs | Owned by the package manager — don't edit |
| `/usr/local` | Software you installed outside the package manager | |
| `/home`, `/root` | User home directories | |
| `/tmp` | Temporary files, often cleared on reboot | World-writable with the sticky bit |
| `/proc`, `/sys` | Virtual filesystems exposing kernel and process state | Read them to inspect the live system |
| `/dev` | Device files for disks, terminals, and more | |

## Reading `ls -l`

```bash
$ ls -l /etc/shadow /usr/bin/passwd deploy.sh
-rw-r-----  1 root root   1284 Sep 10 09:12 /etc/shadow
-rwsr-xr-x  1 root root  64152 May 30 12:01 /usr/bin/passwd
-rwxr-x---  1 app  devops  812 Sep 14 08:40 deploy.sh
```

```text
-rwxr-x---  1  app  devops  812  Sep 14 08:40  deploy.sh
│└┬┘└┬┘└┬┘     │    │
│ │  │  │      │    └── group owner
│ │  │  │      └─────── user owner
│ │  │  └── other: no access
│ │  └───── group: read and execute
│ └──────── user: read, write, execute
└────────── type: - file, d directory, l symlink
```

## What `r`, `w`, and `x` Mean

The same letters mean different things on files and directories. Most permission surprises come from the directory column.

| Permission | On a file | On a directory |
|---|---|---|
| `r` (4) | Read contents | List names inside (`ls`) |
| `w` (2) | Modify contents | Create, delete, and rename entries inside |
| `x` (1) | Execute as a program | Enter it and access entries by name (`cd`, open files inside) |

Two consequences worth remembering:

- To read `/srv/app/config.yml`, a user needs `x` on `/srv`, `/srv/app`, **and** `r` on the file.
- Anyone with `w` on a directory can delete files in it, even files they don't own — unless the sticky bit is set.

## Changing Ownership and Modes

```bash
sudo chown app:devops deploy.sh      # user and group
sudo chown -R app:app /srv/app       # recursively

chmod 750 deploy.sh                  # rwx r-x ---
chmod u+x,g-w,o= deploy.sh           # symbolic form: add, remove, set
chmod -R g+rX /srv/app               # capital X: execute only on directories
                                     # and files that are already executable
```

| Octal | Symbolic | Typical use |
|---|---|---|
| `600` | `rw-------` | Private keys, `.env` files with secrets |
| `640` | `rw-r-----` | Config readable by a service group |
| `644` | `rw-r--r--` | Normal files |
| `700` | `rwx------` | `~/.ssh`, private directories |
| `750` | `rwxr-x---` | Scripts and directories shared with a group |
| `755` | `rwxr-xr-x` | Programs and public directories |

Avoid `chmod 777`. It "fixes" a permission error by letting every process on the machine modify the file.

## Special Bits

| Bit | Octal | On a file | On a directory |
|---|---|---|---|
| **setuid** | `4000` | Runs with the file owner's privileges (`passwd` writes `/etc/shadow` as root) | No effect on Linux |
| **setgid** | `2000` | Runs with the file's group privileges | New files inherit the directory's group — ideal for shared team directories |
| **sticky** | `1000` | No effect on Linux | Only a file's owner (or root) can delete it — used on `/tmp` |

```bash
# A shared directory where everything stays in the devops group
sudo mkdir /srv/shared
sudo chown root:devops /srv/shared
sudo chmod 2775 /srv/shared          # setgid + rwxrwxr-x

# Audit setuid and setgid binaries — unexpected entries are a red flag
sudo find / -xdev -perm /6000 -type f -exec ls -l {} + 2>/dev/null
```

## `umask`: Default Permissions for New Files

New files start from `666` and directories from `777`, and `umask` removes bits.

```bash
$ umask
0022          # new files 644, new directories 755

$ umask 027   # new files 640, new directories 750
```

Set a service's `umask` in its systemd unit (`UMask=0027`) rather than relying on a login shell default.

## ACLs: Permissions for More Than One Group

Standard modes allow one owner and one group. Access control lists add named users and groups.

```bash
sudo apt install -y acl

# Let the "monitoring" group read application logs without changing ownership
sudo setfacl -R -m g:monitoring:rX /var/log/app
# Default ACL: files created later inherit it
sudo setfacl -R -d -m g:monitoring:rX /var/log/app

getfacl /var/log/app
```

A `+` at the end of the mode in `ls -l` (`drwxr-x---+`) tells you an ACL is present.

## Immutable Files

```bash
sudo chattr +i /etc/resolv.conf      # nobody, including root, can modify or delete it
lsattr /etc/resolv.conf
sudo chattr -i /etc/resolv.conf
```

Useful to stop automation from overwriting a critical file — and a classic cause of confusing "Operation not permitted" errors when someone forgets it's set.

## Debugging "Permission denied"

Work through the checks in order:

```bash
# 1. Who is the process actually running as?
ps -o user,group,pid,cmd -C nginx
id app

# 2. Check every directory in the path, not just the file
namei -l /srv/app/config/app.yml

# 3. Check for ACLs and attributes
getfacl /srv/app/config/app.yml
lsattr /srv/app/config/app.yml

# 4. Check mandatory access control
getenforce 2>/dev/null                            # SELinux (RHEL family)
sudo ausearch -m avc -ts recent 2>/dev/null
sudo aa-status 2>/dev/null                        # AppArmor (Ubuntu)
sudo journalctl -k | grep -i apparmor | tail

# 5. Check the mount options
findmnt -T /srv/app                               # look for ro or noexec
```

`namei -l` is the fastest win: it prints the owner and mode of every path component, so a missing `x` on a parent directory stands out immediately.

## Common Mistakes

- Running `chmod -R 777` to fix an error, and turning a single misconfiguration into a machine-wide security hole.
- Checking the file's permissions but not the parent directories' execute bit.
- Forgetting that `sudo` in front of a redirect doesn't apply to the redirect: `sudo echo x > /etc/file` fails; use `echo x | sudo tee /etc/file`.
- Deploying files as root with `600`, then wondering why the service user can't read them.
- Ignoring SELinux or AppArmor denials and disabling them entirely instead of fixing the label or profile.

## Interview Questions

- What does the execute bit mean on a directory?
- A user has `rw` on a file but still gets "Permission denied" when reading it. What do you check?
- What is setgid on a directory used for?
- Why is the sticky bit set on `/tmp`?
- How would you give a second group read access to a directory without changing its owner?

## Next

Continue to [Processes and Signals](02-processes-and-signals.md).
