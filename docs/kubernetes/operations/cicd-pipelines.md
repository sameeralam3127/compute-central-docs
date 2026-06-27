---
description: Build Kubernetes and OpenShift CI/CD workflows with Jenkins, Tekton, Argo CD, GitHub Actions, deployment strategies, and pipeline troubleshooting patterns.
---

# Kubernetes and OpenShift CI/CD Pipelines Guide

## 1. CI/CD Fundamentals

### Continuous Integration/Continuous Delivery Pipeline
```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Source  │───▶│  Build   │───▶│   Test   │───▶│  Deploy  │───▶│ Monitor  │
│  Control │    │  & Image │    │  & Scan  │    │   to K8s │    │ & Alert  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### Key Principles
- **Automation**: Minimize manual intervention
- **Version Control**: Everything as code
- **Testing**: Automated at every stage
- **Fast Feedback**: Quick build and test cycles
- **Reproducibility**: Consistent environments
- **Security**: Scanning and compliance checks

---

## 2. Jenkins Pipeline for Kubernetes

### Jenkinsfile - Declarative Pipeline
```groovy
pipeline {
    agent {
        kubernetes {
            yaml """
apiVersion: v1
kind: Pod
metadata:
  labels:
    jenkins: agent
spec:
  containers:
  - name: docker
    image: docker:20.10
    command:
    - cat
    tty: true
    volumeMounts:
    - name: docker-sock
      mountPath: /var/run/docker.sock
  - name: kubectl
    image: bitnami/kubectl:latest
    command:
    - cat
    tty: true
  volumes:
  - name: docker-sock
    hostPath:
      path: /var/run/docker.sock
"""
        }
    }
    
    environment {
        DOCKER_REGISTRY = 'docker.io'
        IMAGE_NAME = 'myorg/myapp'
        KUBECONFIG = credentials('kubeconfig-prod')
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                    env.IMAGE_TAG = "${env.BUILD_NUMBER}-${env.GIT_COMMIT_SHORT}"
                }
            }
        }
        
        stage('Build') {
            steps {
                container('docker') {
                    script {
                        sh """
                            docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .
                            docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:latest
                        """
                    }
                }
            }
        }
        
        stage('Test') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        container('docker') {
                            sh 'docker run --rm ${IMAGE_NAME}:${IMAGE_TAG} npm test'
                        }
                    }
                }
                stage('Security Scan') {
                    steps {
                        container('docker') {
                            sh """
                                docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
                                    aquasec/trivy image ${IMAGE_NAME}:${IMAGE_TAG}
                            """
                        }
                    }
                }
                stage('Lint') {
                    steps {
                        container('docker') {
                            sh 'docker run --rm ${IMAGE_NAME}:${IMAGE_TAG} npm run lint'
                        }
                    }
                }
            }
        }
        
        stage('Push Image') {
            steps {
                container('docker') {
                    withCredentials([usernamePassword(
                        credentialsId: 'docker-hub',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )]) {
                        sh """
                            echo \$DOCKER_PASS | docker login -u \$DOCKER_USER --password-stdin
                            docker push ${IMAGE_NAME}:${IMAGE_TAG}
                            docker push ${IMAGE_NAME}:latest
                        """
                    }
                }
            }
        }
        
        stage('Deploy to Dev') {
            steps {
                container('kubectl') {
                    sh """
                        kubectl set image deployment/myapp \
                            myapp=${IMAGE_NAME}:${IMAGE_TAG} \
                            -n dev
                        kubectl rollout status deployment/myapp -n dev
                    """
                }
            }
        }
        
        stage('Integration Tests') {
            steps {
                container('kubectl') {
                    sh """
                        kubectl run test-pod --rm -i --restart=Never \
                            --image=curlimages/curl:latest \
                            -- curl -f http://myapp-service.dev.svc.cluster.local:8080/health
                    """
                }
            }
        }
        
        stage('Deploy to Staging') {
            when {
                branch 'main'
            }
            steps {
                container('kubectl') {
                    sh """
                        kubectl set image deployment/myapp \
                            myapp=${IMAGE_NAME}:${IMAGE_TAG} \
                            -n staging
                        kubectl rollout status deployment/myapp -n staging
                    """
                }
            }
        }
        
        stage('Approval for Production') {
            when {
                branch 'main'
            }
            steps {
                input message: 'Deploy to Production?', ok: 'Deploy'
            }
        }
        
        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                container('kubectl') {
                    sh """
                        kubectl set image deployment/myapp \
                            myapp=${IMAGE_NAME}:${IMAGE_TAG} \
                            -n production
                        kubectl rollout status deployment/myapp -n production
                    """
                }
            }
        }
    }
    
    post {
        success {
            slackSend(
                color: 'good',
                message: "Pipeline succeeded: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
            )
        }
        failure {
            slackSend(
                color: 'danger',
                message: "Pipeline failed: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
            )
        }
        always {
            cleanWs()
        }
    }
}
```

### Jenkins Configuration as Code (JCasC)
```yaml
jenkins:
  systemMessage: "Jenkins configured automatically by JCasC"
  numExecutors: 0
  
  clouds:
    - kubernetes:
        name: "kubernetes"
        serverUrl: "https://kubernetes.default"
        namespace: "jenkins"
        jenkinsUrl: "http://jenkins:8080"
        jenkinsTunnel: "jenkins-agent:50000"
        containerCapStr: "10"
        podLabels:
          - key: "jenkins"
            value: "agent"
        templates:
          - name: "default"
            namespace: "jenkins"
            label: "jenkins-agent"
            nodeUsageMode: NORMAL
            containers:
              - name: "jnlp"
                image: "jenkins/inbound-agent:latest"
                workingDir: "/home/jenkins/agent"
                resourceRequestCpu: "500m"
                resourceRequestMemory: "512Mi"
                resourceLimitCpu: "1"
                resourceLimitMemory: "1Gi"

credentials:
  system:
    domainCredentials:
      - credentials:
          - usernamePassword:
              scope: GLOBAL
              id: "docker-hub"
              username: "${DOCKER_USERNAME}"
              password: "${DOCKER_PASSWORD}"
          - file:
              scope: GLOBAL
              id: "kubeconfig-prod"
              fileName: "kubeconfig"
              secretBytes: "${KUBECONFIG_BASE64}"

unclassified:
  location:
    url: "https://jenkins.example.com"
```

---

## 3. Tekton Pipelines (Cloud Native CI/CD)

### Task Definition
```yaml
apiVersion: tekton.dev/v1beta1
kind: Task
metadata:
  name: build-and-push
spec:
  params:
    - name: IMAGE
      description: Reference of the image to build
    - name: DOCKERFILE
      default: ./Dockerfile
    - name: CONTEXT
      default: .
  workspaces:
    - name: source
  steps:
    - name: build-and-push
      image: gcr.io/kaniko-project/executor:latest
      env:
        - name: DOCKER_CONFIG
          value: /tekton/home/.docker
      command:
        - /kaniko/executor
      args:
        - --dockerfile=$(params.DOCKERFILE)
        - --context=$(workspaces.source.path)/$(params.CONTEXT)
        - --destination=$(params.IMAGE)
        - --cache=true
```

### Pipeline Definition
```yaml
apiVersion: tekton.dev/v1beta1
kind: Pipeline
metadata:
  name: build-deploy-pipeline
spec:
  params:
    - name: git-url
      type: string
    - name: git-revision
      type: string
      default: main
    - name: image-name
      type: string
    - name: deployment-name
      type: string
    - name: namespace
      type: string
      default: default
  
  workspaces:
    - name: shared-workspace
    - name: docker-credentials
  
  tasks:
    - name: fetch-repository
      taskRef:
        name: git-clone
      workspaces:
        - name: output
          workspace: shared-workspace
      params:
        - name: url
          value: $(params.git-url)
        - name: revision
          value: $(params.git-revision)
    
    - name: run-tests
      taskRef:
        name: npm-test
      runAfter:
        - fetch-repository
      workspaces:
        - name: source
          workspace: shared-workspace
    
    - name: build-image
      taskRef:
        name: build-and-push
      runAfter:
        - run-tests
      workspaces:
        - name: source
          workspace: shared-workspace
        - name: dockerconfig
          workspace: docker-credentials
      params:
        - name: IMAGE
          value: $(params.image-name):$(tasks.fetch-repository.results.commit)
    
    - name: deploy-to-cluster
      taskRef:
        name: kubernetes-actions
      runAfter:
        - build-image
      params:
        - name: script
          value: |
            kubectl set image deployment/$(params.deployment-name) \
              $(params.deployment-name)=$(params.image-name):$(tasks.fetch-repository.results.commit) \
              -n $(params.namespace)
            kubectl rollout status deployment/$(params.deployment-name) -n $(params.namespace)
```

### PipelineRun
```yaml
apiVersion: tekton.dev/v1beta1
kind: PipelineRun
metadata:
  name: build-deploy-run-1
spec:
  pipelineRef:
    name: build-deploy-pipeline
  params:
    - name: git-url
      value: https://github.com/myorg/myapp.git
    - name: git-revision
      value: main
    - name: image-name
      value: docker.io/myorg/myapp
    - name: deployment-name
      value: myapp
    - name: namespace
      value: production
  workspaces:
    - name: shared-workspace
      volumeClaimTemplate:
        spec:
          accessModes:
            - ReadWriteOnce
          resources:
            requests:
              storage: 1Gi
    - name: docker-credentials
      secret:
        secretName: docker-credentials
```

### Tekton Triggers
```yaml
apiVersion: triggers.tekton.dev/v1beta1
kind: EventListener
metadata:
  name: github-listener
spec:
  serviceAccountName: tekton-triggers-sa
  triggers:
    - name: github-push
      interceptors:
        - github:
            secretRef:
              secretName: github-secret
              secretKey: secretToken
            eventTypes:
              - push
      bindings:
        - ref: github-push-binding
      template:
        ref: build-deploy-template

---
apiVersion: triggers.tekton.dev/v1beta1
kind: TriggerBinding
metadata:
  name: github-push-binding
spec:
  params:
    - name: git-url
      value: $(body.repository.clone_url)
    - name: git-revision
      value: $(body.head_commit.id)

---
apiVersion: triggers.tekton.dev/v1beta1
kind: TriggerTemplate
metadata:
  name: build-deploy-template
spec:
  params:
    - name: git-url
    - name: git-revision
  resourcetemplates:
    - apiVersion: tekton.dev/v1beta1
      kind: PipelineRun
      metadata:
        generateName: build-deploy-run-
      spec:
        pipelineRef:
          name: build-deploy-pipeline
        params:
          - name: git-url
            value: $(tt.params.git-url)
          - name: git-revision
            value: $(tt.params.git-revision)
```

---

## 4. GitOps with ArgoCD

### Application Definition
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp
  namespace: argocd
spec:
  project: default
  
  source:
    repoURL: https://github.com/myorg/myapp-config.git
    targetRevision: HEAD
    path: k8s/overlays/production
    
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
  
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas
```

### Multi-Environment Setup
```yaml
# Application Set for multiple environments
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: myapp-environments
  namespace: argocd
spec:
  generators:
    - list:
        elements:
          - env: dev
            cluster: https://dev-cluster.example.com
          - env: staging
            cluster: https://staging-cluster.example.com
          - env: production
            cluster: https://prod-cluster.example.com
  
  template:
    metadata:
      name: 'myapp-{{env}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/myorg/myapp-config.git
        targetRevision: HEAD
        path: 'k8s/overlays/{{env}}'
      destination:
        server: '{{cluster}}'
        namespace: 'myapp-{{env}}'
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
```

---

## 5. Travis CI Configuration

### .travis.yml
```yaml
language: node_js
node_js:
  - "16"

services:
  - docker

env:
  global:
    - DOCKER_REGISTRY=docker.io
    - IMAGE_NAME=myorg/myapp
    - KUBE_NAMESPACE=production

before_install:
  - echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin
  - curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
  - chmod +x kubectl
  - sudo mv kubectl /usr/local/bin/

install:
  - npm ci

script:
  - npm test
  - npm run lint
  - npm run build

after_success:
  - export IMAGE_TAG=${TRAVIS_BUILD_NUMBER}-${TRAVIS_COMMIT:0:7}
  - docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .
  - docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:latest
  - docker push ${IMAGE_NAME}:${IMAGE_TAG}
  - docker push ${IMAGE_NAME}:latest

deploy:
  provider: script
  script: bash scripts/deploy.sh
  on:
    branch: main

notifications:
  slack:
    rooms:
      - secure: "encrypted-slack-token"
    on_success: change
    on_failure: always
```

### Deploy Script (scripts/deploy.sh)
```bash
#!/bin/bash
set -e

echo "Deploying to Kubernetes..."

# Setup kubectl
echo "$KUBE_CONFIG" | base64 -d > kubeconfig
export KUBECONFIG=./kubeconfig

# Update deployment
kubectl set image deployment/myapp \
  myapp=${IMAGE_NAME}:${IMAGE_TAG} \
  -n ${KUBE_NAMESPACE}

# Wait for rollout
kubectl rollout status deployment/myapp -n ${KUBE_NAMESPACE}

# Verify deployment
kubectl get pods -n ${KUBE_NAMESPACE} -l app=myapp

echo "Deployment completed successfully!"
```

---

## 6. GitHub Actions

### .github/workflows/ci-cd.yml
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '16'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Run linter
        run: npm run lint
      
      - name: Build
        run: npm run build
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    permissions:
      contents: read
      packages: write
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
            type=semver,pattern={{version}}
      
      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'latest'
      
      - name: Configure kubectl
        run: |
          echo "${{ secrets.KUBE_CONFIG }}" | base64 -d > kubeconfig
          echo "KUBECONFIG=$(pwd)/kubeconfig" >> $GITHUB_ENV
      
      - name: Deploy to Kubernetes
        run: |
          IMAGE_TAG="${GITHUB_REF##*/}-${GITHUB_SHA::7}"
          kubectl set image deployment/myapp \
            myapp=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${IMAGE_TAG} \
            -n production
          kubectl rollout status deployment/myapp -n production
      
      - name: Verify deployment
        run: |
          kubectl get pods -n production -l app=myapp
          kubectl get service myapp -n production
```

---

## 7. Deployment Strategies

### Blue-Green Deployment
```yaml
# Blue deployment (current)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-blue
  labels:
    app: myapp
    version: blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      version: blue
  template:
    metadata:
      labels:
        app: myapp
        version: blue
    spec:
      containers:
      - name: myapp
        image: myapp:v1.0

---
# Green deployment (new)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-green
  labels:
    app: myapp
    version: green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      version: green
  template:
    metadata:
      labels:
        app: myapp
        version: green
    spec:
      containers:
      - name: myapp
        image: myapp:v2.0

---
# Service (switch by changing selector)
apiVersion: v1
kind: Service
metadata:
  name: myapp-service
spec:
  selector:
    app: myapp
    version: blue  # Change to 'green' to switch
  ports:
  - port: 80
    targetPort: 8080
```

### Canary Deployment
```yaml
# Stable deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-stable
spec:
  replicas: 9
  selector:
    matchLabels:
      app: myapp
      track: stable
  template:
    metadata:
      labels:
        app: myapp
        track: stable
    spec:
      containers:
      - name: myapp
        image: myapp:v1.0

---
# Canary deployment (10% traffic)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-canary
spec:
  replicas: 1
  selector:
    matchLabels:
      app: myapp
      track: canary
  template:
    metadata:
      labels:
        app: myapp
        track: canary
    spec:
      containers:
      - name: myapp
        image: myapp:v2.0

---
# Service (routes to both)
apiVersion: v1
kind: Service
metadata:
  name: myapp-service
spec:
  selector:
    app: myapp  # Matches both stable and canary
  ports:
  - port: 80
    targetPort: 8080
```

### Rolling Update with Readiness Gates
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 10
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2
      maxUnavailable: 1
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: myapp:v2.0
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
          successThreshold: 1
          failureThreshold: 3
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
      readinessGates:
      - conditionType: "example.com/feature-flag-enabled"
```

---

## 8. Interview Preparation - CI/CD

### Key Talking Points

**1. End-to-End CI/CD Implementation**
- Source control integration (webhooks, polling)
- Build automation (Docker, buildpacks)
- Testing stages (unit, integration, e2e)
- Security scanning (Trivy, Snyk, Clair)
- Artifact management (registries, versioning)
- Deployment automation (kubectl, Helm, Kustomize)
- Monitoring and rollback

**2. Pipeline Optimization**
- Parallel execution
- Caching strategies
- Incremental builds
- Resource allocation
- Build time reduction techniques

**3. Security in CI/CD**
- Secrets management (Vault, Sealed Secrets)
- Image scanning
- SAST/DAST tools
- Compliance checks
- Signed commits and images

### Common Interview Questions

**Q: How do you implement zero-downtime deployments?**
A: Multiple strategies:
1. Rolling updates with proper readiness probes
2. Blue-green deployments with service switching
3. Canary deployments with gradual traffic shift
4. Use of PreStop hooks for graceful shutdown
5. Connection draining
6. Health checks at load balancer level

**Q: Explain your approach to managing secrets in CI/CD.**
A:
1. Never commit secrets to Git
2. Use external secret managers (Vault, AWS Secrets Manager)
3. Kubernetes Secrets with encryption at rest
4. Sealed Secrets for GitOps
5. Short-lived credentials
6. RBAC for secret access
7. Audit logging
8. Regular rotation

**Q: How do you handle database migrations in CI/CD?**
A:
1. Version-controlled migration scripts
2. Run migrations as init containers or jobs
3. Backward-compatible changes
4. Blue-green for major schema changes
5. Rollback procedures
6. Testing in staging environment
7. Monitoring during migration

**Q: Describe your experience with Jenkins/Tekton/ArgoCD.**
A: Be ready to discuss:
- Pipeline architecture
- Integration with Kubernetes
- Scaling considerations
- Security configurations
- Troubleshooting experiences
- Performance optimizations
- Multi-environment management

**Q: How do you ensure pipeline reliability?**
A:
1. Idempotent operations
2. Retry mechanisms with exponential backoff
3. Proper error handling
4. Health checks at each stage
5. Rollback capabilities
6. Monitoring and alerting
7. Regular pipeline testing
8. Documentation and runbooks

### Hands-on Scenarios

**Scenario 1: Build a complete CI/CD pipeline**
- Git webhook triggers build
- Run tests in parallel
- Build and scan Docker image
- Deploy to dev automatically
- Manual approval for production
- Rollback capability

**Scenario 2: Troubleshoot failing pipeline**
- Image pull errors
- Test failures
- Deployment timeouts
- Resource constraints
- Network issues

**Scenario 3: Implement GitOps workflow**
- Separate config repository
- ArgoCD application setup
- Multi-environment sync
- Automated and manual sync policies

---

## Quick Reference

### Jenkins Pipeline Syntax
```groovy
// Declarative
pipeline {
    agent any
    stages {
        stage('Build') {
            steps {
                sh 'make build'
            }
        }
    }
}

// Scripted
node {
    stage('Build') {
        sh 'make build'
    }
}
```

### Tekton Commands
```bash
# List pipelines
tkn pipeline list

# Start pipeline
tkn pipeline start build-deploy-pipeline

# View logs
tkn pipelinerun logs -f

# Describe pipeline
tkn pipeline describe build-deploy-pipeline
```

### ArgoCD Commands
```bash
# Login
argocd login <server>

# Create app
argocd app create myapp --repo <repo> --path <path> --dest-server <server>

# Sync app
argocd app sync myapp

# Get app status
argocd app get myapp

# Rollback
argocd app rollback myapp
