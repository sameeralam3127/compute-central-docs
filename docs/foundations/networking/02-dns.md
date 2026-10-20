---
title: "DNS for DevOps: Resolution, Records, TTLs, and Debugging"
icon: lucide/signpost
description: Understand DNS end to end — recursive and authoritative servers, record types, TTLs and caching, Linux resolvers, Kubernetes ndots, safe migrations, and dig.
tags:
  - Networking
  - DNS
---

# DNS

## What You'll Learn

- How a name becomes an IP address, step by step
- The record types you'll manage, and the rules that trip people up
- How TTLs and caching control how quickly changes take effect
- How Linux and Kubernetes resolve names, and how to debug DNS with `dig`

## How Resolution Works

```mermaid
sequenceDiagram
    autonumber
    participant App as Application
    participant Stub as Local resolver (systemd-resolved)
    participant Rec as Recursive resolver (VPC DNS, 1.1.1.1)
    participant Root as Root servers
    participant TLD as .com servers
    participant Auth as Authoritative (Route 53)
    App->>Stub: api.example.com?
    Stub->>Rec: api.example.com?
    Rec->>Root: api.example.com?
    Root-->>Rec: ask the .com servers
    Rec->>TLD: api.example.com?
    TLD-->>Rec: ask ns-123.awsdns-45.com
    Rec->>Auth: api.example.com?
    Auth-->>Rec: A 203.0.113.10, TTL 300
    Rec-->>Stub: 203.0.113.10 (cached 300s)
    Stub-->>App: 203.0.113.10
```

- **Authoritative servers** hold the real records for a zone. Route 53, Cloudflare, and your registrar's DNS are authoritative.
- **Recursive resolvers** walk the tree on behalf of clients and cache answers. Your VPC's resolver, your ISP's, and public resolvers such as `1.1.1.1` are recursive.
- Every layer caches — including the application runtime, sometimes indefinitely.

## Record Types

| Type | Maps a name to | Example |
|---|---|---|
| `A` | An IPv4 address | `api.example.com. 300 A 203.0.113.10` |
| `AAAA` | An IPv6 address | `api.example.com. 300 AAAA 2001:db8::10` |
| `CNAME` | Another name (an alias) | `www.example.com. 300 CNAME example.com.` |
| `MX` | Mail servers, with priority | `example.com. 3600 MX 10 mail.example.com.` |
| `TXT` | Arbitrary text: domain verification, SPF, DKIM | `example.com. 300 TXT "v=spf1 include:_spf.google.com ~all"` |
| `NS` | The authoritative name servers for a zone | `example.com. 172800 NS ns-123.awsdns-45.com.` |
| `SOA` | Zone metadata, including the negative-caching TTL | |
| `SRV` | Service host and port | `_sip._tcp.example.com. SRV 10 5 5060 sip.example.com.` |
| `CAA` | Which certificate authorities may issue for the domain | `example.com. CAA 0 issue "letsencrypt.org"` |
| `PTR` | Reverse lookup: IP to name | Used by mail servers and logs |

### Rules that catch people out

- **No CNAME at the zone apex.** `example.com` itself can't be a CNAME because it must also hold `SOA` and `NS` records. Providers offer alias records instead — Route 53 **Alias**, Cloudflare CNAME flattening — to point the apex at a load balancer.
- **A CNAME can't coexist with other records at the same name.** You can't have a CNAME and a TXT on `api.example.com`.
- **Trailing dots matter in zone files.** `example.com.` is fully qualified; `example.com` without the dot may get the zone name appended.

## TTLs and Caching

The **TTL** (time to live) tells resolvers how many seconds to cache an answer.

| TTL | Trade-off |
|---|---|
| 60–300 seconds | Changes take effect quickly; more queries |
| 3,600+ seconds | Fewer queries and resilience if DNS has an outage; changes are slow |

**Negative answers are cached too.** If a name doesn't exist (`NXDOMAIN`), resolvers cache that for the duration set in the zone's `SOA` record. Querying a new record *before* you create it can keep it "missing" for that long.

### Changing a record safely

1. **Days before:** lower the TTL of the record you'll change (for example, from 3600 to 60). Wait at least the **old** TTL so every cache has picked up the short one.
2. **Change the record.** Most clients switch within about a minute.
3. **Keep the old target running** for a while — some clients and runtimes ignore TTLs.
4. **After it's stable:** raise the TTL again.

## Resolution on Linux

```bash
cat /etc/nsswitch.conf | grep hosts    # hosts: files dns — /etc/hosts first, then DNS
cat /etc/hosts
cat /etc/resolv.conf                   # on Ubuntu: nameserver 127.0.0.53 (systemd-resolved stub)
resolvectl status                      # the real upstream DNS servers per interface
resolvectl query api.example.com
resolvectl flush-caches
getent hosts api.example.com           # resolves exactly as applications do, including /etc/hosts
```

`dig` talks straight to DNS and skips `/etc/hosts` and `nsswitch`. When `dig` works but the application doesn't, compare with `getent hosts`.

## Kubernetes DNS and `ndots`

Pods get an `/etc/resolv.conf` like this:

```text
nameserver 10.96.0.10
search shop.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
```

With `ndots:5`, any name with **fewer than five dots** is tried with each search domain first. Looking up `api.stripe.com` (two dots) from a pod queries:

```text
api.stripe.com.shop.svc.cluster.local     → NXDOMAIN
api.stripe.com.svc.cluster.local          → NXDOMAIN
api.stripe.com.cluster.local              → NXDOMAIN
api.stripe.com                            → answer
```

That's four queries, twice over when both `A` and `AAAA` are requested, for every uncached lookup. At scale this overloads CoreDNS and adds latency. Fixes:

- Use fully qualified names with a trailing dot for external hosts: `api.stripe.com.`
- Lower `ndots` for workloads that mostly call external services:

```yaml
spec:
  dnsConfig:
    options:
      - name: ndots
        value: "2"
```

- Run NodeLocal DNSCache to cache on every node.

See [DNS and CoreDNS](../../kubernetes/networking/05-dns-and-coredns.md) for more.

## Debugging With `dig`

```bash
dig api.example.com                      # full answer with TTL and the server that answered
dig +short api.example.com               # just the addresses
dig api.example.com AAAA
dig @1.1.1.1 api.example.com             # ask a specific resolver
dig @ns-123.awsdns-45.com api.example.com   # ask the authoritative server directly — bypasses caches
dig +trace api.example.com               # walk the delegation chain from the root
dig -x 203.0.113.10                      # reverse lookup
dig example.com NS +short                # which name servers are authoritative?
dig example.com SOA                      # includes the negative-caching TTL
```

Reading the answer:

```text
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 4412
;; ANSWER SECTION:
api.example.com.   287   IN   A   203.0.113.10
;; SERVER: 127.0.0.53#53(127.0.0.53) (UDP)
```

| Status | Meaning |
|---|---|
| `NOERROR` with answers | Resolved |
| `NOERROR` with no answers | The name exists but not with that record type |
| `NXDOMAIN` | The name doesn't exist |
| `SERVFAIL` | The resolver couldn't get an answer — often broken DNSSEC or unreachable authoritative servers |
| `REFUSED` | The server won't answer you, such as a private resolver queried from outside |

A TTL counting down (`287`) means the answer came from a cache.

## Common DNS Incidents

| Symptom | Likely cause |
|---|---|
| Some users see the old site after a change | Long TTL, or clients ignoring TTLs |
| A new subdomain stays `NXDOMAIN` for an hour | Negative caching after an early lookup |
| Works from your laptop, fails inside the VPC | Split-horizon DNS: a private hosted zone answers differently |
| Intermittent 5-second delays | Lost UDP DNS packets and resolver retries, or `conntrack` races on busy nodes |
| Certificate issuance fails | A `CAA` record doesn't allow the certificate authority |
| Domain stops resolving entirely | Registration expired, or `NS` records at the registrar don't match the hosted zone |

## What Most Engineers Miss

- **"Exactly five seconds" is the resolver timeout.** glibc waits `timeout:5` seconds for an answer before retrying, and makes `attempts:2` rounds. A lost UDP packet therefore shows up as a lookup that takes exactly 5 seconds, a clue worth recognizing in latency graphs.
- **Only three `nameserver` lines count.** glibc reads at most three (`MAXNS`); a fourth is ignored.
- **The negative-caching TTL is the smaller of two numbers:** the SOA record's own TTL and its MINIMUM field (RFC 2308). Look at both with `dig example.com SOA`.
- **Some changes live in the parent zone.** NS records at the registrar and DNSSEC's DS record are served by the TLD, with TTLs you don't control: a day is common for `.com`. A mistake there can't be undone faster than that.
- **Validating resolvers can infer that names don't exist.** Resolvers that implement aggressive NSEC caching (RFC 8198), such as Google Public DNS, use signed "no such name" proofs to answer *other* queries without asking you again. A bug in those proofs spreads further than one bad answer.
- **`dig` and your application can disagree.** `dig` skips `/etc/hosts` and `nsswitch.conf`; `getent ahosts name` resolves exactly as the C library does, including IPv6 ordering.

!!! incident "Real incident: Slack's DNSSEC rollout (2021)"
    On 30 September 2021 Slack signed `slack.com` and published its DS record. A Route 53 bug with wildcard records produced signed answers that some validating resolvers, including Google's 8.8.8.8, read as "this name doesn't exist". Slack removed the DS record within hours, but resolvers had cached it for up to 24 hours and kept validating against keys that were gone, returning `SERVFAIL`. Fewer than 1% of users were affected, for a day ([postmortem](https://slack.engineering/what-happened-during-slacks-dnssec-rollout/)). Before any DNS change, find the longest TTL that controls the rollback, including records in the parent zone.

!!! incident "Real incident: Dyn (2016)"
    A botnet of hijacked cameras and routers flooded Dyn's managed DNS on 21 October 2016. Twitter, GitHub, Reddit, Spotify, and others used Dyn as their only DNS provider and were unreachable for hours ([KrebsOnSecurity](https://krebsonsecurity.com/2016/10/ddos-on-dyn-impacts-twitter-spotify-reddit/)). Listing name servers from two providers in the domain's NS set keeps a site resolvable when one provider fails.

## Common Mistakes

- Changing a record with a 24-hour TTL and expecting it to take effect in minutes.
- Pointing the zone apex at a load balancer with a CNAME instead of an alias record.
- Debugging with `dig` against a public resolver when the application uses a private zone inside the VPC.
- Hard-coding IP addresses from a DNS lookup into configuration files or firewall rules for cloud load balancers, whose IPs change.
- Letting a domain registration or its auto-renew payment method expire.
- Ignoring `ndots` and search domains when external lookups from Kubernetes are slow.

## Check Yourself

!!! quiz "Five-second lookups"
    p99 latency for a service shows a cluster of requests taking just over 5 seconds, with no CPU or database load. What's the first suspect?

    - [ ] A garbage-collection pause
    - [x] A DNS query lost over UDP and retried after glibc's 5-second timeout
    - [ ] TCP's initial retransmission timeout

    Check with `strace -e trace=network` or a packet capture on port 53. In Kubernetes, conntrack races and `ndots` amplify it.

!!! quiz "The rollback that doesn't roll back"
    You change the NS records for `example.com` at your registrar to a new provider and break resolution. You revert within five minutes. How long can some users stay broken?

    - [ ] Five minutes
    - [ ] Your zone's SOA minimum
    - [x] Up to the TTL of the NS records in the parent zone, often 48 hours for `.com`

    Delegation records are served by the TLD with its TTL. Plan NS and DS changes like migrations, with the old setup kept working until caches expire.

## Interview Questions

- Walk through what happens when you type `api.example.com` into a browser, from a DNS point of view.
- What's the difference between a recursive resolver and an authoritative server?
- Why can't you use a CNAME at the zone apex, and what do you do instead?
- How do you migrate a DNS record to a new load balancer with minimal disruption?
- Why might external DNS lookups from Kubernetes pods be slow?

## Next

Continue to [HTTP and TLS](03-http-and-tls.md).
