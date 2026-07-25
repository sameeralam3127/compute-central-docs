---
description: Learn IP addresses, loopback, subnets, gateways, DNS, ports, TCP, and listening sockets.
---

# 12. Networking Foundations

An IP address identifies an interface. Private addresses are routed internally; public addresses can be routed on the internet. `127.0.0.1` means “this network namespace,” not always “the physical host.”

| Term | Meaning |
| --- | --- |
| subnet | address range sharing a network prefix |
| gateway | next hop to other networks |
| DNS | name-to-address lookup |
| port | numbered TCP/UDP endpoint |
| listener | process waiting for connections |

Traffic normally follows DNS lookup → destination IP → TCP port → listening process. Linux tools such as `ss`, `ip`, `getent`, and `curl` make those stages observable.
