---
title: "Kubernetes Outages: 11 Real Postmortems and the Fix for Each"
icon: lucide/siren
description: "Eleven real Kubernetes outages, from Reddit's Pi Day to OpenAI's API server overload and IngressNightmare: what broke, and what to check in your own cluster."
tags:
  - Kubernetes
  - Case Studies
  - Incidents
---

# Kubernetes Outages: What 11 Real Incidents Teach

Kubernetes outages rarely come from exotic bugs. They come from a label an upgrade removed, an agent that ran on every node at once, a DNS dependency nobody drew on the architecture diagram, or a dashboard left open to the internet. These eleven are public postmortems and disclosures from Reddit, Datadog, OpenAI, Google Cloud, Tesla, Spotify, and others. Each one ends with what to check in your own cluster.

| Incident | What broke | Check in your cluster |
|---|---|---|
| [Reddit, 2023](#reddit-2023-a-removed-node-label-took-down-pod-networking) | An upgrade removed a label the CNI selected on | Selectors and tolerations that use removed labels |
| [Datadog, 2023](#datadog-2023-an-os-patch-deleted-the-cnis-routes) | An OS patch deleted the CNI's routing rules | How node OS updates are rolled out |
| [OpenAI, 2024](#openai-2024-telemetry-on-every-node-overloaded-the-api-servers) | A DaemonSet overloaded the API servers, then DNS failed | Per-node agents' API load; break-glass access |
| [Google Cloud, 2025](#google-cloud-2025-a-crash-loop-with-no-backoff) | Crashing tasks restarted without backoff | Client retries with jittered backoff |
| [IngressNightmare, 2025](#ingressnightmare-2025-the-admission-webhook-was-reachable-from-any-pod) | Any Pod could reach an admission webhook and run code | Who can reach webhooks; ingress-nginx versions |
| [Bitnami, 2025](#bitnami-2025-the-images-charts-pointed-at-moved) | Versioned images moved, pulls failed | Third-party images you don't mirror |
| [Tesla, 2018](#tesla-2018-a-dashboard-with-no-password) | An open dashboard leaked cloud credentials | Exposed consoles; credentials in Pods |
| [RBAC Buster, 2023](#rbac-buster-2023-anonymous-access-became-a-backdoor) | Anonymous API access became a persistent backdoor | Bindings to `system:anonymous` |
| [Spotify, 2019](#spotify-2019-production-clusters-deleted-twice) | Production clusters deleted by mistake, twice | Can you rebuild a cluster, and how long does it take? |
| [Indeed, 2019](#indeed-2019-cpu-limits-throttled-services-that-werent-busy) | CPU limits throttled services that weren't busy | Throttling ratio per Pod |
| [DNS timeouts, 2018](#dns-timeouts-2018-lookups-that-took-exactly-five-seconds) | DNS lookups took exactly five seconds | conntrack races and `ndots` |

## Reddit, 2023: A Removed Node Label Took Down Pod Networking

On March 14, 2023 (Pi Day), Reddit upgraded its oldest and largest Kubernetes cluster from 1.23 to 1.24. The cluster's Calico route reflectors, the nodes that redistribute Pod routes over BGP, were chosen by the label `node-role.kubernetes.io/master`. Kubernetes had been moving from "master" to "control-plane" since the 1.20 series, and in 1.24 the old label was removed, even from nodes in running clusters. The selector matched zero nodes, Pod-to-Pod routing collapsed across the cluster, and Reddit was down for 314 minutes. Kubernetes doesn't support downgrades, so the team restored the cluster from backup.

The cluster had been hand-configured years earlier and differed from Reddit's standard builds. That's the usual shape of an upgrade outage: the release notes said exactly what would change, and the thing that depended on it was somewhere nobody thought to look.

**In your cluster**, before every minor upgrade, search everything that selects nodes, not only your own manifests:

```bash
# Workloads that select or tolerate the old label or taint
kubectl get deploy,ds,sts,job -A -o yaml | grep -n "node-role.kubernetes.io/master"

# CNI and other add-on configuration lives in custom resources too
kubectl get crd -o name | grep -i -E "calico|cilium|bgp"
kubectl get bgppeers,bgpconfigurations -o yaml 2>/dev/null | grep -n "node-role"
```

Then read the "Urgent Upgrade Notes" section of the target version's changelog, and rehearse the upgrade on a copy of the cluster that has the same add-ons. [Cluster Upgrades](../cluster-administration/04-cluster-upgrades.md) has the full checklist.

## Datadog, 2023: An OS Patch Deleted the CNI's Routes

On March 8, 2023, a systemd security update reached Datadog's Ubuntu 22.04 nodes. Ubuntu's default unattended upgrades were still active, so every host installed it in the same hour, between 06:00 and 07:00 UTC. The upgrade restarted `systemd-networkd`, and since systemd v248, networkd deletes routing rules it doesn't manage when it starts. That included the rules Cilium had installed for Pod networking, and on every provider it removed the `lookup local` rule the host itself needed. More than 60% of Datadog's instances dropped off the network across multiple regions on AWS, Azure, and Google Cloud.

Nothing had caught it in testing because freshly booted nodes were fine: networkd always starts before the CNI installs its rules. The failure only happens when networkd restarts on a node that's already running.

**In your cluster**, tell systemd-networkd to leave routes and rules it didn't create alone:

```ini title="/etc/systemd/networkd.conf.d/10-cni.conf"
[Network]
ManageForeignRoutes=no
ManageForeignRoutingPolicyRules=no
```

And treat node OS patching as a rollout, a few nodes at a time with a health check after each batch, rather than a timer firing on every node at once. The [Ansible version of that rollout](../../ansible/case-studies/08-automation-outages-and-guardrails.md#datadog-2023-every-node-patched-in-the-same-hour) is twenty lines.

## OpenAI, 2024: Telemetry on Every Node Overloaded the API Servers

On December 11, 2024, OpenAI deployed a new telemetry service to collect detailed Kubernetes control plane metrics. Its configuration made every node in each cluster run resource-intensive Kubernetes API operations, and their cost scaled with the size of the cluster. With thousands of nodes doing that at once, the API servers in most of OpenAI's large clusters were overwhelmed.

The data plane should have kept running, but DNS-based service discovery depends on the API server. Node-level DNS caches kept serving stale records for about 20 minutes, which hid the problem long enough for the rollout to continue to every cluster. When the caches expired, services failed. Removing the telemetry service required the API servers it had just overloaded, so engineers were locked out of the fix. ChatGPT, the API, and Sora were degraded or down from 3:16 to 7:38 PM PST.

**In your cluster:**

- Any agent that runs on every node multiplies its API load by the node count. Make it watch only its own node, through an informer, instead of listing everything:

    ```yaml
    env:
      - name: NODE_NAME
        valueFrom:
          fieldRef:
            fieldPath: spec.nodeName
    # then list/watch Pods with fieldSelector=spec.nodeName=$(NODE_NAME)
    ```

- Give heavy clients their own lane in API Priority and Fairness, so they queue behind themselves instead of starving everyone else:

    ```yaml
    apiVersion: flowcontrol.apiserver.k8s.io/v1
    kind: FlowSchema
    metadata:
      name: node-telemetry
    spec:
      priorityLevelConfiguration:
        name: workload-low
      matchingPrecedence: 1000
      distinguisherMethod:
        type: ByUser
      rules:
        - subjects:
            - kind: ServiceAccount
              serviceAccount:
                name: telemetry-agent
                namespace: monitoring
          resourceRules:
            - verbs: ["get", "list", "watch"]
              apiGroups: ["*"]
              resources: ["*"]
              clusterScope: true
              namespaces: ["*"]
    ```

- Roll DaemonSet changes out one cluster at a time, and wait longer than your DNS cache TTL before moving on.
- Keep break-glass access to the control plane that works when the API servers are saturated, and practice using it.

[DaemonSets](../workloads-and-scheduling/03-daemonsets.md#what-most-engineers-miss) and [DNS and CoreDNS](../networking/05-dns-and-coredns.md#what-most-engineers-miss) cover both halves of this incident.

## Google Cloud, 2025: A Crash Loop With No Backoff

On June 12, 2025, a policy change containing unintended blank fields replicated globally, within seconds, into the data that Google Cloud's Service Control binary reads. A code path added two weeks earlier had no error handling and no feature flag, so it hit a null pointer and crashed the binary in every region. Google's report adds the part that made it worse: as Service Control tasks restarted, they created a herd effect on the Spanner table they depend on, because Service Control "did not have the appropriate randomized exponential backoff." us-central1 took up to about 2 hours 40 minutes to fully recover.

**In your cluster**, this is the failure CrashLoopBackOff exists to prevent. The kubelet waits 10 seconds, then 20, then 40, doubling up to 5 minutes between restarts, so a crashing container doesn't hammer whatever it depends on. Your own clients need the same discipline when they retry: exponential backoff **with jitter**, so a thousand Pods that failed together don't retry together. Since Kubernetes v1.35, administrators can lower the restart cap per node (`crashLoopBackOff.maxContainerRestartPeriod` in the kubelet config). Only do that if the dependencies can take the extra load.

## IngressNightmare, 2025: The Admission Webhook Was Reachable From Any Pod

On March 24, 2025, Wiz disclosed a set of vulnerabilities in the ingress-nginx controller. The worst, CVE-2025-1974 (CVSS 9.8), let anyone who could reach the controller's admission webhook over the Pod network run code inside the controller. The controller can read Secrets, and in a default installation it can read all of them cluster-wide. Fixed versions were v1.11.5 and v1.12.1. Eight months later, Kubernetes SIG Network announced that ingress-nginx would be retired, and maintenance ended in March 2026, so the next vulnerability won't get a fix.

**In your cluster:**

```bash
# Which ingress-nginx versions are running?
kubectl get pods -A -l app.kubernetes.io/name=ingress-nginx \
  -o jsonpath='{range .items[*]}{.metadata.namespace}{"\t"}{.spec.containers[0].image}{"\n"}{end}'

# Every admission webhook, and the Service it's served from
kubectl get validatingwebhookconfigurations,mutatingwebhookconfigurations \
  -o custom-columns='NAME:.metadata.name,SERVICE:.webhooks[*].clientConfig.service.name'
```

Only the API server needs to call an admission webhook. Restrict the webhook port with a NetworkPolicy that admits the control plane's addresses and nothing else, and plan the move from ingress-nginx to [Gateway API](../networking/07-gateway-api.md).

## Bitnami, 2025: The Images Charts Pointed At Moved

In 2025 Bitnami, now part of Broadcom, changed its free container catalog: versioned images moved out of `docker.io/bitnami` into a frozen `docker.io/bitnamilegacy` repository that gets no updates, leaving only a small set of `latest` tags behind. The cutoff, first set for August 28, slipped to September 29, 2025. Running clusters kept working until something forced a fresh pull: a replaced node, a rescheduled Pod, a redeployed chart. Then `bitnami/postgresql:<tag>` failed with `ImagePullBackOff`.

**In your cluster**, list every image you depend on and where it comes from:

```bash
kubectl get pods -A -o jsonpath='{range .items[*]}{range .spec.containers[*]}{.image}{"\n"}{end}{end}' \
  | sort -u | grep -E "^(docker\.io/)?bitnami/"
```

Mirror third-party images into a registry you control, pin them by digest, and remember that `imagePullPolicy: IfNotPresent` hides a vanished image until the first node that doesn't have it cached. [ImagePullBackOff](../troubleshooting/imagepullbackoff.md) covers the diagnosis.

## Tesla, 2018: A Dashboard With No Password

In February 2018, researchers at RedLock found Tesla's Kubernetes administrative console reachable from the internet without a password. Inside one of its Pods were credentials for Tesla's AWS environment, which reached S3 buckets holding sensitive data, including vehicle telemetry. Attackers had already found it and were mining cryptocurrency on Tesla's cluster. They hid well: their own mining pool software behind Cloudflare instead of a public pool, and CPU usage kept low to avoid notice. RedLock said it had found hundreds of Kubernetes consoles exposed the same way.

**In your cluster:**

- Never expose a dashboard or the API server publicly. Reach them through `kubectl port-forward`, a VPN, or an identity-aware proxy.
- A dashboard's ServiceAccount should have read-only RBAC, not `cluster-admin`.
- Keep cloud credentials out of Pods and Secrets entirely: use workload identity (IRSA or EKS Pod Identity, GKE Workload Identity, Azure Workload Identity) so a compromised Pod gets short-lived, scoped credentials at most.

## RBAC Buster, 2023: Anonymous Access Became a Backdoor

In April 2023, Aqua Security's Nautilus team reported a campaign that had compromised at least 60 clusters whose API servers accepted anonymous requests with privileges. The attackers created a ClusterRole with near-admin rights, a ServiceAccount named `kube-controller` in `kube-system`, and a binding between the two: a backdoor that keeps working after the anonymous access is removed. Then they ran a DaemonSet with a typosquatted image, `kuberntesio/kube-controller:1.0.1`, to mine Monero on every node.

**In your cluster**, check what an unauthenticated request can do, and look for bindings that grant it anything:

```bash
kubectl auth can-i --list --as=system:anonymous --as-group=system:unauthenticated

kubectl get clusterrolebindings,rolebindings -A -o json \
  | jq -r '.items[] | select(any(.subjects[]?; .name == "system:anonymous" or .name == "system:unauthenticated"))
           | "\(.kind) \(.metadata.namespace // "-")/\(.metadata.name) -> \(.roleRef.name)"'
```

On a healthy cluster the only result is the built-in `system:public-info-viewer` binding for health and version endpoints, plus, on kubeadm clusters, `kubeadm:bootstrap-signer-clusterinfo`, which lets new nodes read the public `cluster-info` ConfigMap. Anything else deserves a hard look. Alert on every new ClusterRoleBinding, and only admit images from registries you trust. [RBAC](../security/02-rbac.md) includes a tool that turns any `Forbidden` error into a least-privilege Role.

## Spotify, 2019: Production Clusters Deleted, Twice

During its migration to Google Kubernetes Engine, Spotify accidentally deleted production clusters, twice. David Xia told the story in a KubeCon Europe 2019 keynote titled "How Spotify Accidentally Deleted All its Kube Clusters with No User Impact." Users didn't notice because services still ran on Spotify's previous platform in parallel, and service definitions lived outside the clusters. Rebuilding exposed the real gap: restoring a cluster took 3.25 hours, through cluster-creation scripts with bugs and documentation that was incomplete.

**In your cluster**, the question isn't whether you have backups but how long it takes to get a working cluster back:

- Define clusters as code (Terraform, Cluster API), so creating and deleting them is a reviewed change rather than a console click.
- Keep every workload in Git, so a new cluster can be repopulated by a [GitOps](../cicd-and-gitops/04-gitops-with-argocd-and-flux.md) controller instead of from memory.
- Back up what Git doesn't hold, such as PersistentVolumes and some Secrets, with a tool like Velero, and time a full restore on a schedule.

## Indeed, 2019: CPU Limits Throttled Services That Weren't Busy

For years, teams saw latency spikes on services with CPU limits even though the services used a fraction of their limit. Dave Chiluk at Indeed traced it to a Linux kernel bug in CFS bandwidth control: quota handed out to individual CPUs expired unused, so multi-threaded applications on machines with many cores were throttled despite low overall usage. The fix landed in Linux 5.4 and was backported to stable kernels (4.14.154+, 4.19.84+, 5.3.9+). Indeed reported worst-case latency in one application dropping from more than two seconds to 30 milliseconds.

**In your cluster**, the kernel fix is old news, but throttling isn't: a CPU limit still pauses a container for the rest of each 100 ms period once it uses its quota, even when the node is idle. Measure it per Pod:

```promql
sum by (namespace, pod) (rate(container_cpu_cfs_throttled_periods_total[5m]))
  /
sum by (namespace, pod) (rate(container_cpu_cfs_periods_total[5m]))
```

A ratio above a few percent on a latency-sensitive service is worth investigating. [Requests, Limits, and QoS](../workloads-and-scheduling/05-resource-requests-limits-and-qos.md) covers when to drop CPU limits and rely on requests.

## DNS Timeouts, 2018: Lookups That Took Exactly Five Seconds

In 2018, teams across the community chased Kubernetes DNS lookups that intermittently took exactly five seconds. The cause was worked out in Kubernetes issue #56903 and a widely shared Weaveworks analysis. glibc sends the A and AAAA queries for a name at the same time, from the same UDP socket. A race in the Linux kernel's connection tracking, which handles the DNAT to the DNS Service, could drop one of the two packets, and the resolver only retries after its 5-second timeout. With the default `ndots:5`, every external name is tried against several search domains first, multiplying the number of lookups and the chances of hitting the race.

**In your cluster:**

- Run NodeLocal DNSCache: Pods talk to a cache on their own node, which skips the DNAT and connection tracking where the race lived.
- For Pods that call external APIs heavily, lower `ndots` or use fully qualified names with a trailing dot (`api.example.com.`).
- If you can't change the cluster, glibc's `single-request-reopen` option sends the two queries from different sockets (images built on musl, such as Alpine, ignore it):

    ```yaml
    spec:
      dnsConfig:
        options:
          - name: single-request-reopen
          - name: ndots
            value: "2"
    ```

## Patterns Across All Eleven

| Pattern | Incidents | Defense |
|---|---|---|
| The control plane sits in the data path | OpenAI | DNS caches buy time, not safety; break-glass access; API Priority and Fairness |
| Upgrades remove things quietly | Reddit, Bitnami, ingress-nginx | Read urgent upgrade notes; grep for removed labels and APIs; mirror images |
| Node OS changes break networking | Datadog | Patch nodes in waves; keep networkd away from CNI routes |
| Everything changes at once | OpenAI, Google Cloud, Datadog | Phased rollouts, feature flags, jittered backoff |
| Control surfaces exposed | Tesla, RBAC Buster, IngressNightmare | No anonymous bindings; private dashboards; NetworkPolicy on webhooks |
| Defaults that bite under load | Indeed, DNS timeouts | Measure throttling; NodeLocal DNSCache |
| A cluster you can't rebuild quickly | Spotify | Clusters as code; workloads in Git; timed restores |

For many more, Henning Jacobs maintains [Kubernetes Failure Stories](https://k8s.af/), a long-running list of public Kubernetes postmortems.

## Check Yourself

!!! quiz "Why did DNS keep working at first?"
    In the OpenAI incident, the API servers were overwhelmed, yet services kept resolving names for about 20 minutes. Why?

    - [ ] CoreDNS doesn't depend on the API server
    - [x] Node-level DNS caches served stale records until they expired
    - [ ] Pods resolve names through the cloud provider's DNS, not the cluster's

    CoreDNS learns Services and endpoints by watching the API server. Caches hid the failure for a while, which also let the rollout continue. When they expired, resolution failed across the clusters.

!!! quiz "The label that vanished"
    A DaemonSet uses `nodeSelector: node-role.kubernetes.io/master: ""`. What does it do on a cluster built with a current kubeadm?

    - [ ] Runs on control-plane nodes, as before
    - [ ] Fails validation when you apply it
    - [x] Applies cleanly and runs nowhere, because no node carries that label

    The selector is valid; it just matches zero nodes. Nothing errors, which is why Reddit's route reflectors silently disappeared. The current label is `node-role.kubernetes.io/control-plane`.

!!! quiz "Backoff and the herd"
    A thousand Pods crash at the same moment because a shared dependency returned bad data. What keeps them from restarting in lockstep forever?

    - [ ] The scheduler spreads restarts across nodes
    - [x] Exponential backoff between restarts, which is why CrashLoopBackOff exists
    - [ ] Liveness probes stop the Pods from restarting

    The kubelet delays each restart longer than the last, up to five minutes, and each container's timer is its own. Your application's own retries need jitter on top, or they reconnect to the dependency in synchronized waves.

## Sources

- Reddit: [You Broke Reddit: The Pi-Day Outage](https://www.reddit.com/r/RedditEng/comments/11xx5o0/you_broke_reddit_the_piday_outage/)
- Datadog: [2023-03-08 incident: a deep dive into the platform-level impact](https://www.datadoghq.com/blog/engineering/2023-03-08-deep-dive-into-platform-level-impact/)
- OpenAI: [API, ChatGPT and Sora facing issues, incident write-up](https://status.openai.com/incidents/ctrsv3lwd797/write-up) (December 2024)
- Google Cloud: [Service Health incident report](https://status.cloud.google.com/incidents/ow5i3PPK96RduMcb1SsW) (June 2025)
- Kubernetes: [Ingress-nginx CVE-2025-1974: what you need to know](https://kubernetes.io/blog/2025/03/24/ingress-nginx-cve-2025-1974/) and [Ingress NGINX retirement](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/)
- RedLock: [Tesla's cloud environment compromised for cryptomining](https://www.infosecurity-magazine.com/news/tesla-falls-to-cryptojackers/) (coverage of the February 2018 report)
- Aqua Security: [First-ever attack leveraging Kubernetes RBAC to backdoor clusters](https://www.aquasec.com/blog/leveraging-kubernetes-rbac-to-backdoor-clusters/)
- Spotify at KubeCon Europe 2019: [How Spotify accidentally deleted all its Kube clusters with no user impact](https://www.youtube.com/watch?v=ix0Tw8uinWs)
- Indeed Engineering: [Unthrottled: fixing CPU limits in the cloud](https://engineering.indeedblog.com/blog/2019/12/unthrottled-fixing-cpu-limits-in-the-cloud/)
- Kubernetes: [DNS intermittent delays of 5s (issue #56903)](https://github.com/kubernetes/kubernetes/issues/56903) and [NodeLocal DNSCache](https://kubernetes.io/docs/tasks/administer-cluster/nodelocaldns/)

## Related

- [Case Study: Debugging a CrashLoopBackOff Incident](06-debugging-a-crashloopbackoff-incident.md)
- [Production Readiness Checklist](../production-engineering/05-production-readiness-checklist.md)
- [Automation Outages: 9 Real Incidents and the Ansible Fix](../../ansible/case-studies/08-automation-outages-and-guardrails.md)

## Next

Continue to [Troubleshooting](../troubleshooting/index.md).
