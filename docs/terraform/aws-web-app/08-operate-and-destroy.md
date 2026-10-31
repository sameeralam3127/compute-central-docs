---
title: "Operate, Troubleshoot, and Destroy a Terraform-Managed ECS App"
icon: lucide/wrench
description: "Step 8 of the Terraform AWS project: deploy and roll back by image tag, debug inside the VPC with ECS Exec, detect drift, troubleshoot common ECS and ALB failures, and tear everything down in the right order."
tags:
  - Terraform
  - AWS
  - Troubleshooting
  - Lab
---

# Step 8: Operate, Troubleshoot, and Destroy

## What You'll Learn

- How to deploy, and roll back, by changing one variable
- How to get a shell inside a private task with ECS Exec
- What drift detection catches, and what it misses
- How to diagnose the failures you're most likely to hit
- How to tear everything down without leaving resources or orphaned state behind

## Deploy and Roll Back

A deploy is a new `image_tag`. Because tags are immutable, a rollback is the old tag, and you get exactly the image that ran before:

```bash
cd webapp/infra
terraform apply -var-file=dev.tfvars -var "image_tag=$NEW_TAG"   # deploy
terraform apply -var-file=dev.tfvars -var "image_tag=$OLD_TAG"   # roll back
```

The plan for either shows the task definition replaced and the service updated. Watch the rolling deploy while it runs:

```bash
aws ecs describe-services --cluster webapp-dev --services webapp-dev \
  --query 'services[0].deployments[].[status,taskDefinition,runningCount,desiredCount,rolloutState]' \
  --output table
```

You'll see a `PRIMARY` deployment with the new task definition growing while the `ACTIVE` one with the old definition drains. If the new tasks never get healthy, the circuit breaker sets `rolloutState` to `FAILED` and rolls back on its own, and `terraform apply` reports the error.

With the pipeline from step 7, a rollback is `git revert` and a merge, which keeps the deploy history in Git.

## Debug Inside the VPC With ECS Exec

The tasks and the database have no public addresses. To look around from inside, open a shell in a running task. Install the [Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html) for the AWS CLI first:

```bash
TASK=$(aws ecs list-tasks --cluster webapp-dev --service-name webapp-dev --query 'taskArns[0]' --output text)

aws ecs execute-command --cluster webapp-dev --task "$TASK" \
  --container web --interactive --command "/bin/sh"
```

Inside the container, the environment ECS built is available, including the injected secrets:

```bash
python -c "
import os, psycopg
c = psycopg.connect(host=os.environ['DB_HOST'], dbname=os.environ['DB_NAME'],
                    user=os.environ['DB_USER'], password=os.environ['DB_PASSWORD'], sslmode='require')
print(c.execute('SELECT count(*), max(at) FROM visits').fetchone())"
```

ECS Exec works because of two things in `ecs.tf`: `enable_execute_command = true` on the service, and the `ssmmessages` permissions on the task role. Every session is recorded in CloudTrail. In production, restrict who can call `ecs:ExecuteCommand`, because anyone who can open a shell can read the injected secrets.

## Detect Drift

Change something in the console that Terraform manages: open **CloudWatch**, **Log groups**, `/ecs/webapp-dev`, and change the retention to 1 week. Then:

```bash
terraform plan -refresh-only -var-file=dev.tfvars -var "image_tag=$TAG"
```

```text
  # aws_cloudwatch_log_group.app has changed
  ~ resource "aws_cloudwatch_log_group" "app" {
      ~ retention_in_days = 14 -> 7
    }
```

A normal `terraform apply` puts it back to 14. Now try one that Terraform *won't* notice: add an inbound rule for port 22 to the `webapp-dev-app` security group in the console, and run the plan again. Nothing shows up. This stack manages each rule as its own resource, so a rule created outside Terraform isn't part of any resource Terraform tracks. Drift detection only covers attributes of resources in state. Catch out-of-band changes with AWS Config rules or Security Hub, and delete that rule by hand.

## Troubleshooting

| Symptom | Likely cause | Check |
|---|---|---|
| `apply` waits at `aws_ecs_service.app: Still modifying...` for many minutes | New tasks keep failing; the circuit breaker hasn't given up yet | `aws ecs describe-services ... --query 'services[0].events[:5]'` |
| Task stops with `CannotPullContainerError` | Wrong tag, or private subnets have no route to the NAT gateway | `aws ecr describe-images --repository-name webapp`; check the private route tables |
| Task stops with `exec format error` in the logs | Image architecture doesn't match `cpu_architecture` | `docker buildx imagetools inspect $REPO:$TAG` |
| `ResourceInitializationError: unable to pull secrets` | Execution role can't read the secret, or no route to Secrets Manager | The `execution_db_secret` policy; NAT |
| Targets `unhealthy` in the target group | Wrong port or health path, or the app SG doesn't allow the ALB | `describe-target-health`; the app's logs |
| ALB returns `503 Service Temporarily Unavailable` | No healthy targets at all | Same as above |
| Page says "Database unavailable" | App can't reach or log in to RDS | Task logs: the error text names the problem |
| `password authentication failed` after a week | The secret was rotated; running tasks have the old password | [The rotation trap](04-database.md#step-2-plan-and-apply); `aws ecs update-service --force-new-deployment` for now |
| `Error acquiring the state lock` | Another run is in progress, or one crashed holding the lock | Make sure nothing else is running, then `terraform force-unlock <ID>` |

## Destroy Everything

Destroy in reverse order: the app stack first, then the bootstrap stack.

### 1. The Application Stack

```bash
cd webapp/infra
terraform destroy -var-file=dev.tfvars -var "image_tag=$TAG"
```

```text
Plan: 0 to add, 0 to change, 39 to destroy.
```

`image_tag` is still required, because Terraform evaluates the configuration even when it destroys it. This takes about 10 minutes, mostly for RDS and the NAT gateway. In dev, there's no final snapshot and no deletion protection, so it goes through in one step. A production stack would stop at `deletion_protection`, which is the point.

### 2. The Bootstrap Stack

The bootstrap stack is harder to remove, on purpose: its state lives in the bucket it would delete, and the bucket has `prevent_destroy`. If you'll do this project again, keep it. It costs a few cents a month for S3 and ECR storage. To remove it completely:

1. **Move its state back to local.** Delete the `backend "s3"` block from `bootstrap/main.tf`, then:

    ```bash
    cd ../bootstrap
    terraform init -migrate-state
    ```

2. **Allow the bucket to be deleted.** In `aws_s3_bucket.state`, remove the `lifecycle { prevent_destroy = true }` block and add `force_destroy = true`, which deletes every object and version on destroy. Apply that change first, with the same variables as before:

    ```bash
    terraform apply -var "github_repository=your-github-user/webapp"
    ```

3. **Destroy:**

    ```bash
    terraform destroy -var "github_repository=your-github-user/webapp"
    ```

### 3. Check Nothing Is Left

```bash
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=webapp \
  --query 'ResourceTagMappingList[].ResourceARN'
```

An empty list means every tagged resource is gone. The tagging API can take a few minutes to catch up. Check the **Billing** console the next day.

## Where to Go Next

| Next step | Read |
|---|---|
| Split `infra/` into `network`, `database`, and `service` modules | [Modules](../modules.md) |
| Add `staging` and `prod` with their own state files and tfvars | [Environments and Workspaces](../environments-and-workspaces.md) |
| Add TFLint, Checkov, and saved-plan applies to the pipeline | [Testing and CI/CD](../testing-and-ci.md) |
| Run the same app on Kubernetes | [Kubernetes](../../kubernetes/index.md) |
| Add alarms and dashboards | [Observability with CloudWatch](../../cloud/aws/09-observability-cloudwatch.md) |

Other improvements worth making: VPC endpoints to cut NAT costs, AWS WAF on the ALB, a least-privilege database user for the app, and database migrations as a one-off ECS task before each deploy.

## What Most Engineers Miss

- **Rollback is only as good as your tags.** Immutable, commit-based tags make "deploy the previous version" exact. Without them, a rollback is a guess.
- **`terraform destroy` needs every variable** that `plan` needs, including ones that don't matter for deletion. Keep the tfvars file around.
- **Tag everything from the provider.** `default_tags` made the cleanup check above a single command.
- **Teardown is a feature.** If you can't destroy and rebuild an environment from code in an hour, you don't really know that your code describes it.

!!! quiz "Drift"
    Someone adds an inbound rule to a security group in the console. The group's rules are managed with separate `aws_vpc_security_group_ingress_rule` resources. What does `terraform plan` show?

    - [ ] The new rule, marked for removal
    - [x] Nothing, because the rule isn't a resource in Terraform's state
    - [ ] An error

    Terraform only compares resources it manages. Use AWS Config or Security Hub to catch unmanaged changes.

!!! quiz "Rollback"
    A deploy of tag `b7f3...` is live and broken. What's the fastest safe rollback in this setup?

    - [x] Apply with the previous tag, or revert the commit so CI does it
    - [ ] Rebuild the previous commit and push it as `latest`
    - [ ] Delete the ECS service and recreate it

    Immutable tags mean the previous image still exists exactly as it was tested.

## Common Mistakes

- Leaving the stack running after the lab and finding a $90 bill at the end of the month.
- Destroying the bootstrap stack first, which deletes the state of the stack that still exists.
- Debugging by opening the database to the internet instead of using ECS Exec.
- Assuming `terraform plan` detects every console change.
- Running `terraform force-unlock` while another apply is actually still running.

## Interview Questions

- How would you roll back a bad deployment of an ECS service managed by Terraform?
- How do you get shell access to a Fargate task in a private subnet?
- What kinds of drift can `terraform plan` detect, and what can't it see?
- In what order do you destroy a stack and the stack that holds its state?
- A deploy hangs at `Still modifying...` on the ECS service. How do you find out why?

## Next

Test yourself with the [Terraform Interview Questions](../interview-questions.md), or return to the [Terraform overview](../index.md).
