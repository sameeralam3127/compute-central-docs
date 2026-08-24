---
title: "Kubernetes Jobs and CronJobs: Batch and Scheduled Workloads"
icon: lucide/clock
description: Job completions, parallelism, and backoffLimit; CronJob schedule syntax, concurrencyPolicy, and startingDeadlineSeconds; and when to reach for each instead of a Deployment.
tags:
  - Kubernetes
  - Core Concepts
---

# Jobs and CronJobs

## What You'll Learn

- Why a Deployment is the wrong tool for run-to-completion work, and what a Job does instead
- The Job fields that control how much work runs, how much runs at once, and how many failures are tolerated
- CronJob scheduling syntax and the settings that prevent overlapping or pileup runs

## Why This Matters

A Deployment's entire model is "keep N replicas running forever" — feed it a container that's supposed to run once and exit, and it will restart that container forever, which is exactly wrong for batch work. Jobs and CronJobs exist because "run this to completion" and "run this on a schedule" are genuinely different reconciliation problems from "keep this running."

## Job: Run to Completion

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
spec:
  completions: 1
  parallelism: 1
  backoffLimit: 3
  template:
    spec:
      restartPolicy: OnFailure
      containers:
        - name: migrate
          image: myapp-migrate:1.4.2
          command: ["./migrate.sh"]
```

| Field | Controls |
|---|---|
| `completions` | How many successful Pod completions satisfy the Job overall — `1` for a single task, higher for a fixed batch of independent units of work |
| `parallelism` | How many Pods can run at once while working toward `completions` |
| `backoffLimit` | How many times a failing Pod is retried before the Job itself is marked `Failed` (with an exponential backoff between retries) |
| `restartPolicy` | Must be `OnFailure` or `Never` for a Job's Pod template — `Always` (the Deployment default) isn't valid here, since it would fight the whole "run to completion" model |

```bash
kubectl create job one-off-task --image=busybox:1.36 -- sh -c "echo done"
kubectl get jobs
kubectl logs job/one-off-task
```

A Job with `completions: 5, parallelism: 2` runs at most 2 Pods concurrently until 5 have succeeded in total — useful for a fixed amount of independent, parallelizable work like processing a batch of files.

## CronJob: Jobs on a Schedule

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-cleanup
spec:
  schedule: "0 2 * * *"
  concurrencyPolicy: Forbid
  startingDeadlineSeconds: 300
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      backoffLimit: 2
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: cleanup
              image: myapp-cleanup:1.2.0
              command: ["./cleanup.sh"]
```

A CronJob is a template that creates a new Job object on the schedule you give it — `schedule` uses standard five-field cron syntax (minute, hour, day-of-month, month, day-of-week; `0 2 * * *` means 2 a.m. daily).

| Field | Controls |
|---|---|
| `concurrencyPolicy` | What happens if the previous scheduled run is still going when the next one is due — `Allow` (default, runs both), `Forbid` (skip the new run), `Replace` (kill the old run, start the new one) |
| `startingDeadlineSeconds` | How late a missed run can start and still be considered on-time — past this, the run is skipped and counted as missed, rather than run late |
| `successfulJobsHistoryLimit` / `failedJobsHistoryLimit` | How many completed Job objects to keep around for inspection before garbage collection |

```bash
kubectl get cronjobs
kubectl get jobs --watch                    # watch new Jobs appear as the schedule fires
kubectl create job --from=cronjob/nightly-cleanup manual-run-now   # trigger one run immediately, outside the schedule
```

## Use Cases

- **Job**: database migrations run once per deploy, one-off data backfills, batch image/video processing split across parallel workers, CI-triggered test runs.
- **CronJob**: nightly backups, periodic cache warming, scheduled report generation, certificate renewal checks, cleaning up expired records.

## Common Mistakes

- Using a Deployment for a task meant to run once and exit — it will restart the container in a loop forever, since a Deployment has no concept of "done."
- Setting `concurrencyPolicy: Allow` (the default) for a job that isn't safe to run twice concurrently — e.g., two overlapping backup jobs writing to the same location.
- Forgetting `restartPolicy: OnFailure` or `Never` on a Job's Pod template — leaving the field unset does not default to something Job-compatible in every context, and `Always` is rejected.
- Not setting `successfulJobsHistoryLimit`/`failedJobsHistoryLimit`, letting years of completed Job and Pod objects accumulate and clutter `kubectl get jobs` output.

## Interview Questions

- Why can't you just use a Deployment for a batch task, mechanically?
- What's the difference between `completions` and `parallelism` on a Job?
- What does `concurrencyPolicy: Forbid` protect against on a CronJob, and when would `Replace` be more appropriate instead?

See [Interview Prep](../interview-prep/index.md) for full answers.

## Next

This closes out Core Concepts. Continue to [Workloads and Scheduling](../workloads-and-scheduling/index.md) for DaemonSets, StatefulSets, deployment strategies, autoscaling, and scheduling controls like affinity and taints/tolerations.
