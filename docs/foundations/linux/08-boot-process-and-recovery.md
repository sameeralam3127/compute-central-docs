---
title: "Linux Boot Process and Recovery: GRUB, initramfs, Rescue Mode"
icon: lucide/life-buoy
description: "How Linux boots from firmware to systemd, and how to recover: GRUB kernel arguments, rescue mode, a broken fstab, a lost root password, and cloud instances."
tags:
  - Linux
  - Troubleshooting
---

# Boot Process and Recovery

A Linux server boots in five stages: firmware, the GRUB bootloader, the kernel, the initramfs, and systemd. When a machine won't come up, the last message on the console tells you which stage failed, and each stage has its own fix.

## What You'll Learn

- What happens between power-on and a login prompt, and where each stage can fail
- How to change kernel arguments for one boot, or permanently
- How to boot into rescue or emergency mode, and the difference between them
- How to fix the most common unbootable states: a bad `fstab`, a broken initramfs, and a lost password
- How to recover a cloud instance that has no keyboard or screen

## Mental Model

> Each boot stage has one job: find and start the next stage. Firmware finds the bootloader, GRUB loads the kernel and initramfs, the initramfs finds and mounts the real root filesystem, and systemd starts everything else. Recovery means stopping the chain at the stage *before* the broken one and fixing it from there.

```mermaid
flowchart LR
    A["Firmware<br>UEFI or BIOS"] --> B["GRUB<br>picks a kernel"]
    B --> C["Kernel<br>hardware, drivers"]
    C --> D["initramfs<br>finds the root disk"]
    D --> E["systemd (PID 1)<br>mounts, services"]
    E --> F["default.target<br>login prompt"]
```

| Stage | Lives in | Typical failure | Symptom |
|---|---|---|---|
| Firmware | Motherboard or hypervisor | No bootable disk, Secure Boot rejects the bootloader | "No bootable device", firmware menu |
| GRUB | `/boot/efi` and `/boot` | Missing config or files after a bad upgrade | `grub>` or `grub rescue>` prompt |
| Kernel | `/boot/vmlinuz-*` | Missing driver, bad kernel argument | Kernel panic |
| initramfs | `/boot/initrd.img-*` (Ubuntu), `/boot/initramfs-*.img` (RHEL) | Can't find the root device, stale image | "Unable to mount root fs", dracut emergency shell |
| systemd | `/etc/fstab`, unit files | A required mount fails, a critical unit hangs | "You are in emergency mode" |

## Inspect the Current Boot

```bash
cat /proc/cmdline                       # the kernel arguments this boot used
uname -r                                # the running kernel
ls /boot                                # installed kernels and initramfs images
systemctl get-default                   # the target the system boots into
journalctl --list-boots                 # boots the journal remembers
journalctl -b -1 -p err                 # errors from the previous boot
[ -d /sys/firmware/efi ] && echo UEFI || echo BIOS
mokutil --sb-state                      # is Secure Boot on?
```

`journalctl -b -1` only works if the journal is persistent. See [systemd and journald](03-systemd-and-journald.md#keep-the-journal-from-filling-the-disk) for `Storage=persistent`.

## Targets: What systemd Boots Into

A target is a named group of units. These are the ones that matter for recovery:

| Target | What runs | Use it for |
|---|---|---|
| `graphical.target` | Everything, plus a desktop | Workstations |
| `multi-user.target` | Everything except a desktop | Servers (the normal default) |
| `rescue.target` | Basic system, local filesystems mounted, no network, root shell | Fixing services or config while filesystems are available |
| `emergency.target` | Almost nothing; root mounted read-only, other filesystems not mounted | Fixing `fstab` or a filesystem that stops `rescue.target` |

```bash
sudo systemctl set-default multi-user.target   # boot to a console, not a desktop
sudo systemctl isolate rescue.target           # drop a running system to rescue (disconnects SSH)
```

Both rescue and emergency mode ask for the **root password**. On Ubuntu the root account is locked by default, so they fail with "Cannot open access to console, the root account is locked." Use the `init=/bin/bash` method in [Reset a Lost Password](#reset-a-lost-password) instead.

## Change Kernel Arguments

### For one boot, from the GRUB menu

1. Show the menu. Ubuntu hides it by default: hold **Shift** (BIOS) or tap **Esc** (UEFI) as the machine starts.
2. Highlight the entry and press **e**.
3. Find the line that starts with `linux` and add your argument to the end.
4. Press **Ctrl+X** or **F10** to boot. The change is not saved.

| Argument | Effect |
|---|---|
| `systemd.unit=rescue.target` | Boot into rescue mode |
| `systemd.unit=emergency.target` | Boot into emergency mode |
| `rd.break` | Stop inside the initramfs, before the real root is mounted read-write (RHEL family) |
| `init=/bin/bash` | Skip systemd and start a root shell directly |
| `nomodeset` | Don't load graphics drivers (blank screen after GRUB) |
| `systemd.log_level=debug` | Verbose boot logging |

### Permanently

```bash
# Ubuntu and Debian: edit the defaults, then regenerate grub.cfg
sudo nano /etc/default/grub            # GRUB_CMDLINE_LINUX_DEFAULT="quiet splash"
sudo update-grub

# RHEL family: grubby edits every boot entry for you
sudo grubby --update-kernel=ALL --args="audit=1"
sudo grubby --update-kernel=ALL --remove-args="quiet"
sudo grubby --info=DEFAULT             # confirm
```

On RHEL 9, prefer `grubby` over editing `/etc/default/grub` and running `grub2-mkconfig`: boot entries are stored as separate files (Boot Loader Specification), and `grubby` updates them directly.

## Boot an Older Kernel

A bad kernel or driver update is easy to undo if an older kernel is still installed. In the GRUB menu, choose **Advanced options for Ubuntu** (or the older entry on RHEL) and pick the previous version. Once you're in:

```bash
uname -r                                       # confirm you're on the old kernel
# RHEL family: make it the default until a fixed kernel ships
sudo grubby --set-default /boot/vmlinuz-<version>
```

Package managers keep a few kernels for exactly this reason: Ubuntu keeps the running and previous kernel, and dnf keeps three (`installonly_limit=3` in `/etc/dnf/dnf.conf`). Don't remove old kernels manually to free space in `/boot` unless you've rebooted into the new one successfully.

## Rebuild the initramfs

The initramfs is a small filesystem with just enough drivers and tools to find the root disk: storage drivers, LVM, RAID, and disk encryption. Rebuild it after you change any of those, or if a kernel update was interrupted.

```bash
# Ubuntu and Debian
sudo update-initramfs -u                       # the running kernel
sudo update-initramfs -u -k all                # every installed kernel
lsinitramfs /boot/initrd.img-$(uname -r) | grep -i nvme   # is the driver inside?

# RHEL family
sudo dracut -f                                 # the running kernel
sudo dracut -f --regenerate-all
lsinitrd /boot/initramfs-$(uname -r).img | grep -i nvme
```

A kernel panic ending in `VFS: Unable to mount root fs on unknown-block(0,0)` usually means the initramfs is missing or doesn't match the kernel. Boot an older kernel, then rebuild the image for the broken one with `-k <version>` (Ubuntu) or `dracut -f --kver <version>` (RHEL).

## Fix a Broken `fstab`

A typo in `/etc/fstab` or a missing disk without `nofail` is the most common reason a server stops booting. systemd waits 90 seconds for the device, gives up, and prints:

```text
You are in emergency mode. After logging in, type "journalctl -xb" to view
system logs, "systemctl reboot" to reboot, "systemctl default" or "exit"
to boot into default mode.
```

```bash
journalctl -xb | grep -i -E 'mount|fstab|timed out'   # which entry failed
mount -o remount,rw /                  # root is read-only in emergency mode
nano /etc/fstab                        # fix the line, or comment it out
systemctl daemon-reload                # systemd generates mount units from fstab
findmnt --verify                       # checks fstab for syntax errors and missing devices
mount -a                               # mount everything; no output means success
systemctl default                      # continue booting
```

Run `findmnt --verify` and `mount -a` after **every** `fstab` change, before rebooting. Add `nofail` to any mount the system can boot without, as shown in [Storage, Disks, and LVM](04-storage-disks-and-lvm.md#add-and-mount-a-new-disk).

## Repair a Filesystem

Never run `fsck` on a mounted filesystem. Boot into emergency mode or a rescue system, where it isn't mounted, or attach the disk to another machine.

```bash
lsblk -f                               # find the device and filesystem type
sudo umount /dev/nvme1n1               # if it was mounted
sudo fsck.ext4 -f /dev/nvme1n1         # ext4: check and repair
sudo xfs_repair /dev/nvme1n1           # XFS: repair (it has no fsck)
```

If `xfs_repair` refuses because the log is dirty, mount and unmount the filesystem once to replay the log, then run it again. Use `xfs_repair -L`, which discards the log, only as a last resort: you lose the most recent changes.

## Reset a Lost Password

### RHEL family: `rd.break`

1. Add `rd.break` to the `linux` line in GRUB and boot.
2. At the `switch_root:/#` prompt:

```bash
mount -o remount,rw /sysroot
chroot /sysroot
passwd root                            # or: passwd <admin-user>
touch /.autorelabel                    # SELinux must relabel the changed /etc/shadow
exit
exit                                   # boot continues
```

The first boot after `/.autorelabel` relabels the whole filesystem and can take several minutes. Skip that step and SELinux will block logins because `/etc/shadow` has the wrong label.

### Ubuntu: `init=/bin/bash`

1. Add `init=/bin/bash` to the `linux` line in GRUB and boot.
2. You get a root shell before systemd starts:

```bash
mount -o remount,rw /
passwd ubuntu                          # reset the admin user's password
sync
exec /sbin/init                        # continue a normal boot
```

Anyone with console access can do this, which is why physical and hypervisor console access must be protected like root access. A GRUB password or full-disk encryption closes the gap.

## Recovering Cloud Instances

Cloud instances usually have no GRUB menu you can reach, so recovery works differently:

| Method | How | When |
|---|---|---|
| **Serial console** | EC2 Serial Console, Google Cloud serial console, Azure Serial Console | The instance boots far enough to show a prompt, and you have a user with a password |
| **Rescue instance** | Stop the instance, detach its root volume, attach it to a working instance, fix it, reattach | Anything that prevents booting or SSH |
| **Snapshot first** | Snapshot the root volume before touching it | Always |

Working on a volume attached to a rescue instance:

```bash
lsblk -f                                         # the broken root shows up as a second disk
sudo mkdir -p /mnt/rescue
sudo mount /dev/nvme1n1p1 /mnt/rescue            # use the root partition, not the whole disk
sudo nano /mnt/rescue/etc/fstab                  # fix fstab, sshd_config, and so on

# To run commands as if booted from it (reinstall a kernel, rebuild initramfs):
for d in dev proc sys run; do sudo mount --bind /$d /mnt/rescue/$d; done
sudo chroot /mnt/rescue
```

If the volume uses XFS and the rescue instance was launched from the same image, the two filesystems share a UUID and the mount fails. Add `-o nouuid` to the `mount` command.

## Common Mistakes

- Rebooting after an `fstab` change without running `findmnt --verify` and `mount -a` first.
- Removing old kernels to free `/boot` space before confirming the new kernel boots.
- Forgetting `touch /.autorelabel` after resetting a password with `rd.break`, so SELinux blocks every login.
- Running `fsck` or `xfs_repair` on a mounted filesystem.
- Editing a broken cloud instance's volume without taking a snapshot first.
- Editing `grub.cfg` directly: it's generated, and the next kernel update overwrites it.

## Interview Questions

- Walk through what happens from power-on to a login prompt.
- What is the initramfs for, and when do you need to rebuild it?
- What's the difference between `rescue.target` and `emergency.target`?
- A server drops into emergency mode after a reboot. How do you find and fix the cause?
- How do you recover a cloud instance that fails to boot and has no console access?

## Next

Continue to [SELinux and AppArmor](09-selinux-and-apparmor.md).
