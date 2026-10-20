---
title: "Real Outages Behind Linux, Shell, DNS, TLS, and Git"
icon: lucide/siren
description: "Real incidents behind the fundamentals, from Steam's rm -rf and the 2012 leap second to Slack's DNSSEC outage and PyTorch's dependency confusion, each with its guardrail."
tags:
  - Foundations
  - Incidents
  - Case Studies
---

# Real Outages Behind the Fundamentals

Most famous outages weren't caused by anything exotic. They came from an empty shell variable, a leap second, a certificate nobody watched, a DNS record that stayed in caches, or a package index that trusted the wrong source. Each one maps to a chapter in this track, and each has a guardrail you can apply this week.

Every incident here comes from a public postmortem, advisory, or court record, linked in its section.

| Incident | The fundamental | Guardrail |
|---|---|---|
| [Steam for Linux, 2015](#steam-for-linux-2015-an-empty-variable-deleted-home-directories) | Shell expansion | `${VAR:?}` before every destructive path |
| [Bumblebee, 2011](#bumblebee-2011-one-space-deleted-usr) | Word splitting | Review the arguments, not the line |
| [GitLab.com, 2017](#gitlabcom-2017-a-delete-on-the-wrong-database-server) | Destructive commands, backups | Host-aware prompts; tested restores |
| [Leap second, 2012](#leap-second-2012-servers-spun-at-100-cpu) | Time and the kernel | Leap smearing; patched kernels |
| [Cloudflare DNS, 2017](#cloudflare-2017-time-went-backwards) | Wall-clock vs monotonic time | Measure durations with a monotonic clock |
| [xz Utils, 2024](#xz-utils-2024-a-backdoor-noticed-because-ssh-got-slower) | Supply chain, sshd | Treat odd latency as a signal |
| [Dirty Pipe, 2022](#dirty-pipe-2022-corrupted-logs-revealed-a-kernel-bug) | Kernel patching | Reboot into patched kernels on a schedule |
| [Ubuntu 25.10, 2025](#ubuntu-2510-2025-automatic-updates-silently-stopped) | Patching you can't see | Alert on the age of the last update |
| [Cloudflare regex, 2019](#cloudflare-2019-one-regular-expression-used-every-cpu) | Regular expressions | Linear-time regex engines |
| [Slack DNSSEC, 2021](#slack-2021-a-dns-rollback-took-24-hours) | DNS caching | Know which TTL controls your rollback |
| [Dyn, 2016](#dyn-2016-one-dns-provider-many-dark-sites) | DNS as a dependency | A second DNS provider |
| [Let's Encrypt root, 2021](#lets-encrypt-2021-an-expired-root-broke-old-clients) | TLS chains, trust stores | Update `ca-certificates`; test old clients |
| [Ericsson, 2018](#ericsson-2018-an-expired-certificate-took-mobile-data-offline) | Certificate expiry | Inventory every certificate |
| [Jenkins, 2013](#jenkins-2013-a-force-push-rewound-186-repositories) | Git force-push | Branch protection |
| [Toyota and Uber](#toyota-2022-and-uber-2016-keys-in-repositories) | Secrets in Git | Rotate first; push protection |
| [PyTorch, 2022](#pytorch-2022-pip-chose-the-wrong-index) | Package indexes | One index, or uv's `first-index` |

## Steam for Linux, 2015: An Empty Variable Deleted Home Directories

In January 2015 a user reported that launching Steam had deleted every file their account owned, including a backup drive mounted under `/media`. Steam's launcher script contained this line ([issue #3671](https://github.com/ValveSoftware/steam-for-linux/issues/3671)):

```bash
rm -rf "$STEAMROOT/"*
```

`STEAMROOT` was computed with `cd` and `$PWD`. When Steam's directory had been moved, the `cd` failed, `STEAMROOT` became an **empty string**, and the quoted part collapsed to `/`. The unquoted `*` then expanded to every top-level directory. GNU `rm` refuses `rm -rf /`, but that protection (`--preserve-root`) covers only `/` itself, never `/*`.

**Guardrail:** make the expansion fail instead of collapsing. `${VAR:?}` stops the script when the variable is empty or unset, and [ShellCheck's SC2115](https://www.shellcheck.net/wiki/SC2115) flags the original pattern. `set -u` would not have helped, because an empty variable is set.

```bash
rm -rf "${STEAMROOT:?}/"*
cd "$target" || exit 1
```

See it in the [Bash argument viewer](shell-scripting/01-bash-fundamentals.md#how-bash-turns-a-line-into-arguments): choose **Steam 2015**, then **…with the guard**.

## Bumblebee, 2011: One Space Deleted /usr

The installer of Bumblebee, a project for NVIDIA Optimus laptops, shipped with this line ([fix commit](https://github.com/MrMEEE/bumblebee-Old-and-abbandoned/commit/a047be85247755cdbe0acce6f1dafc8beb84f2ac)):

```bash
rm -rf /usr /lib/nvidia-current/xorg/xorg
```

The author meant `/usr/lib/nvidia-current/xorg/xorg`. One space split a path into two arguments, and `rm` removed `/usr`.

**Guardrail:** for destructive commands, review what the program receives, not what the line looks like. Build paths from a checked prefix (`rm -rf -- "${PREFIX:?}/lib/nvidia-current"`), and run installers in a disposable VM or container first.

## GitLab.com, 2017: A Delete on the Wrong Database Server

On 31 January 2017, an engineer fighting replication lag ran a recursive delete of the PostgreSQL data directory, intending it for the secondary. The terminal was connected to the **primary**. About 300 GB was gone in seconds. Then the backups failed one after another: the scheduled `pg_dump` had been silently producing nothing because of a PostgreSQL version mismatch, and the failure emails were being rejected. GitLab restored from a six-hour-old snapshot taken by chance, and lost about six hours of data ([postmortem](https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/)).

**Guardrail:** make the host impossible to miss (hostname and role in the prompt, a red prompt on production), make destructive scripts check where they are running, and alert when a backup is *missing*, not only when one fails. A backup you've never restored is a hope, not a backup.

```bash
[[ "$(hostname -s)" == db-replica-* ]] || { echo "refusing: not a replica" >&2; exit 1; }
```

## Leap Second, 2012: Servers Spun at 100% CPU

A leap second was inserted at 23:59:60 UTC on 30 June 2012. On many Linux kernels, the clock change wasn't propagated to the high-resolution timer subsystem, so timers fired immediately and repeatedly. Programs that sleep on futexes, notably Java applications and MySQL, woke in a tight loop and pinned every CPU. Setting the clock (`date -s "$(date)"`) forced the timer update and stopped it ([LWN](https://lwn.net/Articles/504744/)).

**Guardrail:** time is an input that can jump. Large providers now *smear* leap seconds over hours instead of inserting them, and in 2022 the General Conference on Weights and Measures voted to stop adding leap seconds by 2035. On your own fleet, sync with chrony from a smearing source, or none at all, but never mix smeared and unsmeared servers.

## Cloudflare, 2017: Time Went Backwards

At midnight UTC on 1 January 2017, another leap second. Cloudflare's DNS service measured round-trip times as `time.Now().Sub(start)` and passed the result to a random-number function that panics on negative input. During the leap second the wall clock stepped back, a duration came out negative, and the service crashed for some queries until a fix rolled out about six hours later ([postmortem](https://blog.cloudflare.com/how-and-why-the-leap-second-affected-cloudflare-dns/)). Go 1.9 later added monotonic clock readings to `time.Time`, so subtracting two `time.Now()` values became safe.

**Guardrail:** measure elapsed time with a monotonic clock, never the wall clock: `time.monotonic()` in Python, `CLOCK_MONOTONIC` in C, `$SECONDS` in Bash for coarse timing. See [CLI Tools and subprocess](python/02-cli-tools-and-subprocess.md#what-most-engineers-miss).

## xz Utils, 2024: A Backdoor Noticed Because SSH Got Slower

On 29 March 2024, Andres Freund, a PostgreSQL developer, reported that SSH logins on a Debian testing machine were using noticeably more CPU and producing Valgrind errors. He traced it to xz Utils 5.6.0 and 5.6.1, whose release tarballs had been backdoored after a years-long effort to gain maintainer trust (CVE-2024-3094, [oss-security post](https://www.openwall.com/lists/oss-security/2024/03/29/4)). `sshd` doesn't use xz itself; several distributions patch it to link `libsystemd`, which pulled in `liblzma`. The affected versions had reached only testing and rolling-release distributions.

**Guardrail:** a performance regression nobody can explain is worth chasing. Know your dependency graph (`ldd $(command -v sshd)`), prefer distribution packages that rebuild from source, and keep production on stable releases rather than the newest upstream tarball.

## Dirty Pipe, 2022: Corrupted Logs Revealed a Kernel Bug

Max Kellermann at CM4all investigated gzip log archives that failed their CRC checks, month after month. The cause was a Linux kernel bug in pipe buffers, present since 5.8, that let data be written into the page cache of files the process could only read. It became CVE-2022-0847, a local privilege escalation, fixed in 5.16.11, 5.15.25, and 5.10.102 ([write-up](https://dirtypipe.cm4all.com/)). It is in CISA's catalog of vulnerabilities exploited in the wild.

**Guardrail:** "weird corruption" is sometimes the kernel. Installing a kernel update does nothing until you reboot (or live-patch), so track the *running* kernel: compare `uname -r` with the newest installed kernel, as in [Packages and Patching](linux/06-package-management-and-updates.md#what-most-engineers-miss).

## Ubuntu 25.10, 2025: Automatic Updates Silently Stopped

Ubuntu 25.10 replaced GNU coreutils with the Rust rewrite, uutils. In October 2025 users found that unattended upgrades had stopped checking for updates. The scheduler compares a stamp file's age using `date -r FILE`, and the Rust `date` returned the current time instead of the file's, so the last check always looked fresh. Manual `apt` runs were unaffected, which is why nobody noticed; the fix shipped in `rust-coreutils` 0.2.2-0ubuntu2.1 ([Phoronix](https://www.phoronix.com/news/Ubuntu-25.10-Broken-Upgrade)).

**Guardrail:** monitor the outcome, not the mechanism. Alert when `/var/lib/apt/periodic/update-success-stamp` is older than two days, and test scripts against both GNU and uutils coreutils before an Ubuntu 26.04 upgrade, which ships the Rust tools by default.

## Cloudflare, 2019: One Regular Expression Used Every CPU

On 2 July 2019 Cloudflare deployed a new web-application firewall rule. Its regular expression contained `.*(?:.*=.*)`, which causes catastrophic backtracking in a backtracking engine: on some inputs the work grows explosively. CPU on every machine serving HTTP traffic hit 100%, and Cloudflare was down globally for 27 minutes ([postmortem](https://blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/)). The fix was to move to regex engines that guarantee linear time.

**Guardrail:** `grep`, `sed`, and `awk` mostly use automata, but `grep -P`, Python's `re`, Perl, and PCRE backtrack. Avoid nested quantifiers over the same characters (`(.*)*`, `.*.*=`), anchor patterns, and when matching untrusted input use RE2-style engines (Go's `regexp`, Rust's `regex`, Python's `google-re2`). See [Text Processing](shell-scripting/02-text-processing.md#what-most-engineers-miss).

## Slack, 2021: A DNS Rollback Took 24 Hours

On 30 September 2021 Slack enabled DNSSEC on `slack.com` (its third attempt) and published the DS record in the `.com` zone. A Route 53 bug with wildcard records produced signed "no such record" answers for some queries, and resolvers that cache such proofs, including Google Public DNS, concluded names didn't exist. Slack pulled the DS record and unsigned its zones, but resolvers that had cached the DS record (which `.com` lets resolvers keep for 24 hours) kept validating against keys that no longer existed and returned `SERVFAIL`. Under 1% of users were affected, for about 24 hours ([postmortem](https://slack.engineering/what-happened-during-slacks-dnssec-rollout/)).

**Guardrail:** before a DNS change, ask which TTL controls the rollback, including records in the *parent* zone you don't host. Test with validating resolvers (`dig @8.8.8.8`, `dig +dnssec`), and lower TTLs a full old-TTL in advance. See [DNS](networking/02-dns.md#what-most-engineers-miss).

## Dyn, 2016: One DNS Provider, Many Dark Sites

On 21 October 2016, a botnet of compromised cameras and routers (Mirai) flooded Dyn, a managed DNS provider. Sites that used Dyn as their only authoritative DNS, including Twitter, GitHub, Reddit, Spotify, and PayPal, were unreachable for hours, mostly on the US East Coast ([KrebsOnSecurity](https://krebsonsecurity.com/2016/10/ddos-on-dyn-impacts-twitter-spotify-reddit/)).

**Guardrail:** authoritative DNS is a single point of failure unless the domain's `NS` set spans two providers. Longer TTLs also keep cached answers working through a provider outage, a trade-off against how fast you can change records.

## Let's Encrypt, 2021: An Expired Root Broke Old Clients

The root certificate DST Root CA X3 expired on 30 September 2021 at 14:01:15 UTC. Let's Encrypt's chain had already moved to ISRG Root X1, but clients with outdated trust stores, and OpenSSL 1.0.2, which tried the expired path and gave up, began failing to connect, including many servers and containers calling APIs ([Let's Encrypt](https://letsencrypt.org/docs/dst-root-ca-x3-expiration-september-2021/)).

**Guardrail:** the client side of TLS needs patching too. Keep `ca-certificates` current in base images, and before a CA changes chains, test from your oldest client: an old base image, an appliance, a Java runtime with its own trust store.

## Ericsson, 2018: An Expired Certificate Took Mobile Data Offline

On 6 December 2018, software in Ericsson's SGSN-MME, part of the mobile core, failed in about 11 countries. O2 in the UK lost mobile data for most of a day, and SoftBank in Japan for over four hours. Ericsson's initial root cause: an expired certificate in the software versions those operators ran ([TelecomTV](https://www.telecomtv.com/content/mobile/ericsson-apologises-for-software-fault-that-brought-down-cellular-networks-33522/)).

**Guardrail:** certificates hide in appliances, internal services, client certificates, and vendor software, not only on websites. Inventory them all and alert on expiry. With public certificate lifetimes falling to 47 days by 2029, the [certificate lifetime planner](networking/03-http-and-tls.md#certificate-lifetimes-and-automation) shows what manual renewal will cost.

## Jenkins, 2013: A Force-Push Rewound 186 Repositories

On 10 November 2013, a Jenkins developer started a local Gerrit server whose replication plugin was pointed at GitHub and at a directory of 186 stale clones of the project's repositories. The plugin pushed with force by default, so it rewound branches across the Jenkins organization to old commits. The newer commits still existed on GitHub, just unreferenced; branches were restored from developers' up-to-date clones, with help from GitHub support and a script that found the rest ([Jenkins report](https://www.jenkins.io/blog/2013/11/25/summary-report-git-repository-disruption-incident-of-nov-10th/)).

**Guardrail:** block force-pushes to shared branches on the server, because client discipline doesn't scale. When you must force-push your own branch, use `git push --force-with-lease --force-if-includes`, which refuses if the remote has commits you haven't seen. See [Everyday Workflow](git/02-everyday-workflow.md#what-most-engineers-miss).

## Toyota 2022 and Uber 2016: Keys in Repositories

In October 2022 Toyota disclosed that a contractor had published part of the T-Connect source code to a **public** GitHub repository in December 2017. It contained an access key for a server holding customer data; for nearly five years, 296,019 email addresses and customer numbers were exposed ([TechCrunch](https://techcrunch.com/2022/10/12/toyota-customer-email-addresses-exposed/)).

Uber's 2016 breach began with cloud credentials found in a **private** GitHub repository. The attackers used them to copy data on 57 million riders and drivers from cloud storage. Uber paid them $100,000 to stay quiet and later agreed to a $148 million settlement with US states ([Security Affairs](https://securityaffairs.com/76587/security/uber-data-breach-settlement.html)).

**Guardrail:** private doesn't mean safe, and deleting doesn't mean gone: GitHub keeps commits from deleted forks reachable by hash across the fork network ([Truffle Security](https://www.trufflesecurity.com/blog/anyone-can-access-deleted-and-private-repo-data-github)). Rotate a leaked key first, then clean history. Turn on push protection so the next one never lands. See [Repository Hygiene](git/05-collaboration-and-repository-hygiene.md#responding-to-a-leaked-secret).

## PyTorch, 2022: pip Chose the Wrong Index

Between 25 and 30 December 2022, anyone who installed PyTorch nightly builds on Linux with pip received a malicious `torchtriton` package. PyTorch's install instructions used `--extra-index-url`, and pip treats every index as equal, picking the best version from all of them. An attacker had uploaded a `torchtriton` to PyPI, and pip installed it. It collected system information and files such as SSH keys and sent them out over DNS ([PyTorch](https://pytorch.org/blog/compromised-nightly-dependency/)). This is **dependency confusion**.

**Guardrail:** use one index that proxies PyPI, or a resolver with index priority. uv's default `first-index` strategy takes a package only from the first index that has it, which blocks this attack. Pin hashes in a lock file. See [Project Setup](python/01-project-setup.md#what-most-engineers-miss).

## Check Yourself

!!! quiz "The empty variable"
    A script runs `rm -rf "$BUILD_DIR/"*` with `set -euo pipefail` at the top. `BUILD_DIR` was assigned from a command that printed nothing. What happens?

    - [ ] `set -u` stops the script before `rm` runs
    - [x] `rm` receives every top-level directory as an argument
    - [ ] GNU `rm` refuses because of `--preserve-root`

    `BUILD_DIR` is set, just empty, so `set -u` doesn't fire. The path collapses to `/*`, which the glob expands, and `--preserve-root` only protects `/` itself. `${BUILD_DIR:?}` is the fix.

!!! quiz "Rolling back DNS"
    You publish a DS record for DNSSEC, something breaks, and you delete the DS record from your registrar a minute later. When are all users fixed?

    - [ ] Within your zone's record TTL, typically 300 seconds
    - [ ] Immediately, because removing DNSSEC disables validation
    - [x] When resolvers' cached copy of the DS record expires, up to the parent zone's TTL (a day for `.com`)

    The DS record lives in the parent zone, so its TTL is set by the TLD, not you. That's why Slack's rollback took 24 hours.

!!! quiz "Durations"
    Which is the right way to time an operation in Python?

    - [ ] `time.time()` before and after
    - [x] `time.monotonic()` before and after
    - [ ] `datetime.now()` before and after

    The wall clock can step backwards (NTP corrections, leap seconds). A monotonic clock only moves forward, so a duration can never be negative.

## Next

Pick the track whose incident surprised you most: [Linux](linux/index.md), [Shell Scripting](shell-scripting/index.md), [Networking](networking/index.md), [Git](git/index.md), or [Python](python/index.md). For the same treatment of higher-level tools, see [Kubernetes Outages](../kubernetes/case-studies/07-real-world-outages-and-lessons.md) and [Ansible Outages](../ansible/case-studies/08-automation-outages-and-guardrails.md).
