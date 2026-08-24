---
title: "Fix Kubernetes Service, DNS, and Ingress Networking Problems"
icon: lucide/network
description: Diagnosing Services with no endpoints, DNS failures inside pods, Ingress 404/502/503 errors, and traffic dropped by NetworkPolicy.
tags:
  - Kubernetes
  - Troubleshooting
  - Networking
---

# Networking and Service Problems

Kubernetes networking failures nearly always sit at one of four layers: the Service has nothing to send traffic to, DNS can't resolve the name in the first place, the Ingress can't reach a healthy backend, or a NetworkPolicy is silently dropping packets that would otherwise arrive fine. Work through them in that order.

## Service Has No Endpoints

```bash
kubectl get endpoints myapp-service
# NAME            ENDPOINTS   AGE
# myapp-service   <none>      10m
```

An empty `ENDPOINTS` list means the Service exists but has found zero matching, ready pods — this is the single most common "service unreachable" cause and it isn't a networking bug at all.

**Likely causes:**

1. The Service's `selector` doesn't match the labels actually on the pods.
2. The pods match the selector but are failing their `readinessProbe`, so they're excluded from endpoints on purpose.
3. The Service's `targetPort` doesn't match the container's actual listening port.

**Diagnosis:**

```bash
kubectl get svc myapp-service -o jsonpath='{.spec.selector}{"\n"}'
kubectl get pods --show-labels -l app=myapp
kubectl get pods -l app=myapp -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}{"\n"}'
kubectl get svc myapp-service -o jsonpath='{.spec.ports}{"\n"}'
```

**Fix:**

```bash
# Selector/label mismatch
kubectl label pod myapp-5d4b8c7f9-abc12 app=myapp --overwrite

# Port mismatch — targetPort must match containerPort
kubectl patch svc myapp-service -p '{"spec":{"ports":[{"port":80,"targetPort":8080}]}}'
```

**Prevention:** generate the Service selector and the Deployment's pod template labels from the same source (a Helm value, a Kustomize label, a shared variable) so they can't drift apart.

## DNS Resolution Failures Inside Pods

```bash
kubectl run dns-test --rm -it --restart=Never --image=busybox:1.36.1 -- nslookup myapp-service
# ;; connection timed out; no servers could be reached
```

**Likely causes:**

1. CoreDNS pods are unhealthy or not running.
2. The pod's `/etc/resolv.conf` is wrong — usually from a custom `dnsPolicy` set for another reason.
3. The Service being queried genuinely doesn't exist, or is being queried without its namespace suffix from outside that namespace.

**Diagnosis:**

```bash
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=50
kubectl exec myapp-5d4b8c7f9-abc12 -- cat /etc/resolv.conf
kubectl get svc myapp-service -n other-namespace   # confirm it exists where you think it does
```

**Fix:**

```bash
# CoreDNS unhealthy — restart and watch it come back
kubectl rollout restart deployment/coredns -n kube-system
kubectl rollout status deployment/coredns -n kube-system

# Cross-namespace lookups need the full form
# myapp-service.other-namespace.svc.cluster.local
```

**Prevention:** avoid overriding `dnsPolicy`/`dnsConfig` unless you have a specific reason, and always use the fully-qualified `<service>.<namespace>.svc.cluster.local` form when a Deployment might later move namespaces.

## Ingress Returning 404, 502, or 503

Each status code narrows the search:

| Code | Where it's coming from | What it means |
|---|---|---|
| `404` | The ingress controller itself | No rule matched the request's host/path |
| `502` | The ingress controller | It reached a backend, but the backend closed/refused the connection |
| `503` | The ingress controller | It found no healthy/ready endpoints to send the request to at all |

**Diagnosis:**

```bash
kubectl get ingress myapp-ingress -o yaml         # confirm host, path, backend service/port
kubectl describe ingress myapp-ingress            # events show backend resolution problems
kubectl get pods -n ingress-nginx
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx --tail=100

# Bypass the Ingress to isolate it from the Service
kubectl run curl-test --rm -it --restart=Never --image=curlimages/curl:8.8.0 -- \
  curl -sv http://myapp-service.default.svc.cluster.local
```

If the direct-to-Service `curl` works but the Ingress still fails, the problem is in the Ingress resource or controller, not the application.

**Fix:**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx   # a missing ingressClassName is a common cause of silent 404s
  rules:
    - host: myapp.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: myapp-service
                port:
                  number: 80
```

**Prevention:** always set `ingressClassName` explicitly rather than relying on a cluster default, and confirm the backend Service has ready endpoints before blaming the Ingress.

## Traffic Silently Dropped by a NetworkPolicy

Unlike the other failures here, a NetworkPolicy drop produces no error at the application layer — connections simply hang until they time out, because the packets never arrive.

**Likely causes:**

1. A default-deny policy exists in the namespace and the traffic's source isn't covered by any `allow` rule.
2. A policy targets the right pods but the port in the `ingress`/`egress` rule doesn't match the actual traffic's port.

**Diagnosis:**

```bash
kubectl get networkpolicy -n myns
kubectl describe networkpolicy default-deny -n myns
kubectl run policy-test --rm -it --restart=Never --image=curlimages/curl:8.8.0 -- \
  curl -sv --max-time 5 http://myapp-service.myns.svc.cluster.local
```

A connection that times out (rather than refuses or 404s) after a NetworkPolicy was recently added is the strongest signal that the policy — not the app or Service — is the cause.

**Fix:**

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: myns
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - protocol: TCP
          port: 8080
```

**Prevention:** whenever you add a default-deny policy, add its matching `allow` rules in the same change, and test connectivity from an actual pod with the real labels — not from outside the mesh of policies entirely.

## Quick Reference

| Symptom | Layer | Fix starting point |
|---|---|---|
| `kubectl get endpoints` shows `<none>` | Service selector/readiness | Compare selector to pod labels, check readiness |
| DNS lookup times out | CoreDNS/resolv.conf | Check CoreDNS pods and logs |
| Ingress `404` | Ingress rule/class | Check host/path match and `ingressClassName` |
| Ingress `502`/`503` | Backend health | Confirm Service has ready endpoints |
| Connection times out, no error | NetworkPolicy | `kubectl describe networkpolicy`, check allow rules |

## Interview Questions

- A Service shows healthy pods but `kubectl get endpoints` returns nothing — what are the two most likely explanations?
- What's the practical difference between a `502` and a `503` from an Ingress controller, in terms of what's actually broken?
- How do you tell a NetworkPolicy-caused connection failure apart from a DNS failure, when both can look like "the app can't reach the service"?

## Next

Continue to [Storage Problems](03-storage-problems.md).
