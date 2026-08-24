---
description: Install Jenkins on Ubuntu, configure the first setup, create a practical CI/CD pipeline, understand Jenkins concepts, and troubleshoot common pipeline issues.
---

# Jenkins CI/CD Installation and First Pipeline on Ubuntu

Jenkins is an open-source automation server used to build, test, and deploy software. It is one of the most widely used CI/CD tools because it supports pipelines as code, integrates with a large plugin ecosystem, and can automate everything from simple shell scripts to full production delivery workflows.

!!! info "What Jenkins is commonly used for"
    - Continuous integration for application builds and tests
    - Continuous delivery and deployment pipelines
    - Scheduled automation jobs
    - Infrastructure and operations workflows
    - Integration with Git, Docker, Kubernetes, SonarQube, Slack, and cloud platforms

---

## Core Concepts

Before installing Jenkins, it helps to understand a few common terms:

- **Controller**: The main Jenkins server that manages jobs, pipelines, plugins, credentials, and connected agents
- **Agent**: A worker machine or runtime where Jenkins executes jobs
- **Job**: A configured task in Jenkins
- **Pipeline**: A multi-stage workflow defined in the Jenkins UI or a `Jenkinsfile`
- **Stage**: A logical section of a pipeline such as build, test, or deploy
- **Plugin**: An extension that adds features and integrations

!!! tip "Why pipelines matter"
    Jenkins pipelines let you version your delivery process in code, review it in Git, and keep environments consistent across teams.

---

## Prerequisites

Before installing Jenkins on Ubuntu, make sure you have:

- A supported Ubuntu system
- `sudo` access
- Internet access to download packages and plugins
- At least 2 GB RAM for light usage
- Java installed, because Jenkins runs on the JVM

You can confirm the OS version with:

```bash
lsb_release -a
```

---

## Install Jenkins on Ubuntu

### 1. Update system packages

```bash
sudo apt update
sudo apt upgrade -y
```

### 2. Install Java

Jenkins requires Java. On modern Ubuntu systems, OpenJDK 17 is a safe default for current Jenkins releases.

```bash
sudo apt install openjdk-17-jdk -y
```

Verify Java:

```bash
java -version
```

### 3. Add the Jenkins repository

Import the Jenkins repository key:

```bash
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | sudo tee \
  /usr/share/keyrings/jenkins-keyring.asc > /dev/null
```

Add the Jenkins package source:

```bash
echo deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
  https://pkg.jenkins.io/debian-stable binary/ | sudo tee \
  /etc/apt/sources.list.d/jenkins.list > /dev/null
```

### 4. Install Jenkins

```bash
sudo apt update
sudo apt install jenkins -y
```

### 5. Start and enable Jenkins

```bash
sudo systemctl enable jenkins
sudo systemctl start jenkins
```

Check service status:

```bash
sudo systemctl status jenkins
```

!!! note "Default port"
    Jenkins listens on port `8080` by default.

---

## Access Jenkins for the First Time

Open Jenkins in your browser:

```text
http://localhost:8080
```

If Jenkins is running on a remote server, replace `localhost` with the server IP or DNS name.

### Unlock Jenkins

Retrieve the initial administrator password:

```bash
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

Paste that password into the Jenkins unlock screen.

### Install plugins

After unlocking Jenkins, select **Install suggested plugins** for a good default setup.

This usually installs common plugins for:

- Pipeline support
- Git integration
- Credentials handling
- Build triggers
- Basic UI and administrative features

### Create the first admin user

After plugin installation, Jenkins prompts you to create an administrator account. Use a strong password and store it securely.

---

## Important First Configuration

Once Jenkins is running, a few settings are worth reviewing early.

### Manage plugins

Go to:

- **Manage Jenkins**
- **Plugins**

You can install tools such as:

- Git plugin
- Pipeline plugin
- Docker Pipeline
- Kubernetes plugin
- SonarQube Scanner
- Slack Notification plugin

### Configure tools

Go to:

- **Manage Jenkins**
- **Tools**

Common tool configuration includes:

- Git
- JDK
- Maven
- Gradle
- Node.js
- SonarScanner

### Configure credentials

Go to:

- **Manage Jenkins**
- **Credentials**

Store secrets such as:

- GitHub personal access tokens
- SSH private keys
- Docker registry credentials
- API tokens
- Cloud provider keys

!!! warning "Do not hardcode secrets"
    Keep secrets in Jenkins Credentials or an external secret manager, not inside the pipeline script.

---

## Jenkins Job Types

Jenkins supports multiple job styles:

- **Freestyle project**: Good for simple scripted jobs
- **Pipeline**: Best for modern CI/CD workflows
- **Multibranch Pipeline**: Automatically discovers branches and pull requests
- **Folder**: Helps organize jobs and permissions

For most teams, **Pipeline** or **Multibranch Pipeline** is the preferred approach.

---

## Create Your First Pipeline

### 1. Create a new pipeline job

In Jenkins:

1. Click **New Item**
2. Enter a name such as `first-pipeline`
3. Select **Pipeline**
4. Click **OK**

### 2. Add a simple pipeline script

In the **Pipeline** section, choose **Pipeline script** and paste:

```groovy
pipeline {
    agent any

    stages {
        stage('Check System Details') {
            steps {
                sh '''
                    echo "System Information:"
                    echo "--------------------"
                    hostnamectl
                    echo
                    df -h
                    echo
                    free -h
                    echo
                    uname -a
                '''
            }
        }
    }
}
```

Save the job and click **Build Now**.

### 3. Review the build

To inspect the result:

1. Open the job
2. Click the latest build number
3. Open **Console Output**

You should see the system information printed by the pipeline.

---

## Pipeline as Code with `Jenkinsfile`

For real projects, store the pipeline in your repository instead of writing it only in the Jenkins UI.

Example `Jenkinsfile`:

```groovy
pipeline {
    agent any

    environment {
        APP_NAME = 'demo-app'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build') {
            steps {
                sh 'echo Building ${APP_NAME}'
            }
        }

        stage('Test') {
            steps {
                sh 'echo Running tests'
            }
        }

        stage('Package') {
            steps {
                sh 'echo Packaging application'
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully'
        }
        failure {
            echo 'Pipeline failed'
        }
        always {
            cleanWs()
        }
    }
}
```

Benefits of using a `Jenkinsfile`:

- Pipeline changes are version-controlled
- Teams can review CI/CD changes through pull requests
- The same pipeline logic is reproducible across environments
- Multibranch pipelines can detect branch-specific changes automatically

---

## Declarative vs Scripted Pipeline

Jenkins supports two main pipeline styles:

- **Declarative Pipeline**: Cleaner and easier to maintain for most teams
- **Scripted Pipeline**: More flexible but also more complex

This guide uses Declarative Pipeline because it is the better default for most CI/CD setups.

---

## Working with Git Repositories

Most Jenkins pipelines start by pulling code from Git.

Typical setup:

1. Create a job or multibranch pipeline
2. Connect the Git repository URL
3. Add repository credentials if needed
4. Point Jenkins to the `Jenkinsfile`

Jenkins can integrate with:

- GitHub
- GitLab
- Bitbucket
- Self-hosted Git servers

Common webhook use cases:

- Trigger a build on push
- Trigger validation on pull requests
- Run branch-specific pipelines automatically

---

## Using Credentials in a Pipeline

Jenkins Credentials should be referenced securely from the pipeline.

Example with username and password credentials:

```groovy
pipeline {
    agent any

    stages {
        stage('Use Credentials') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                    sh 'echo "Using credential for ${DOCKER_USER}"'
                }
            }
        }
    }
}
```

Example with secret text:

```groovy
pipeline {
    agent any

    stages {
        stage('Token Example') {
            steps {
                withCredentials([string(credentialsId: 'api-token', variable: 'API_TOKEN')]) {
                    sh 'echo "Token is available for command use"'
                }
            }
        }
    }
}
```

---

## Running Jobs on Agents

In larger Jenkins environments, builds should run on agents instead of overloading the controller.

Example:

```groovy
pipeline {
    agent { label 'linux' }

    stages {
        stage('Build') {
            steps {
                sh 'echo Running on a Linux agent'
            }
        }
    }
}
```

This allows teams to:

- Separate workloads by operating system or tooling
- Scale build capacity horizontally
- Run specialized jobs on Docker, Kubernetes, or dedicated worker nodes

---

## Practical CI/CD Flow

A common Jenkins pipeline lifecycle looks like this:

1. Pull source code from Git
2. Install dependencies
3. Run linting and tests
4. Build the application artifact
5. Run code quality or security scans
6. Build and push a Docker image if needed
7. Deploy to staging or production
8. Send notifications and archive artifacts

Jenkins becomes especially powerful when combined with tools like Docker, SonarQube, Terraform, Ansible, and Kubernetes.

---

## Best Practices

- Prefer `Jenkinsfile` over UI-only pipeline definitions
- Use agents for builds instead of using the controller for everything
- Store credentials securely in Jenkins Credentials
- Organize jobs with folders and naming conventions
- Pin and review plugins carefully
- Back up Jenkins configuration and job definitions
- Keep the controller lean and avoid unnecessary workloads on it
- Use webhooks instead of frequent polling when possible
- Add post-build cleanup to reduce workspace clutter

!!! tip "Keep Jenkins maintainable"
    Jenkins can become difficult to manage if plugins, jobs, and credentials grow without structure. Standard naming, folder organization, and pipeline templates help a lot.

---

## Troubleshooting

### Jenkins service is not starting

Checks:

```bash
sudo systemctl status jenkins
sudo journalctl -u jenkins -n 100
```

Common causes:

- Java is missing or incompatible
- Port `8080` is already in use
- System memory is too low
- Package installation was incomplete

### Cannot access Jenkins in the browser

Checks:

```bash
sudo ss -tulpn | grep 8080
sudo ufw status
```

Common causes:

- Jenkins is not running
- Firewall blocks port `8080`
- Reverse proxy or DNS is misconfigured

### Plugin installation fails

Common causes:

- No internet connectivity
- Proxy restrictions
- Update center issues
- Version compatibility problems between Jenkins and plugins

### Git checkout fails

Checks:

- Confirm the repository URL
- Confirm the configured credentials
- Ensure the Git plugin is installed
- Test SSH keys or access tokens outside Jenkins if needed

### Pipeline fails at shell step

Common causes:

- Missing tools on the agent
- Wrong file permissions
- Script path does not exist in the workspace
- Environment variables are missing

Example check:

```groovy
steps {
    sh 'pwd && ls -la'
}
```

### Jenkins home is filling up

Common causes:

- Old workspaces not cleaned up
- Large archived artifacts
- Logs growing over time
- Too many retained builds

Useful actions:

- Configure build retention
- Clean workspaces after jobs
- Archive only necessary artifacts

---

## Quick Reference

```bash
sudo systemctl start jenkins
sudo systemctl enable jenkins
sudo systemctl status jenkins
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
java -version
sudo journalctl -u jenkins -n 100
sudo ss -tulpn | grep 8080
```

---

## FAQ

### What is Jenkins used for?

Jenkins is used to automate build, test, delivery, deployment, and operational workflows. It is most valuable when pipelines are stored as code in a `Jenkinsfile`.

### What is a Jenkins pipeline?

A Jenkins pipeline is a versioned workflow made of stages such as checkout, build, test, scan, package, and deploy. It helps teams review and repeat delivery steps consistently.

### How does Jenkins work with Kubernetes?

Jenkins can deploy workloads to Kubernetes with `kubectl`, Helm, or GitOps tools. Start with [Kubernetes CI/CD pipelines](../kubernetes/cicd-and-gitops/01-cicd-pipelines-for-kubernetes.md) after your first Jenkins pipeline works.

### How does Jenkins work with SonarQube?

Jenkins can run SonarQube analysis during CI and fail or pause delivery based on quality gates. See the [SonarQube Jenkins integration guide](../sonarqube/jenkins-integration.md).

## Related Learning

- [SonarQube code quality overview](../sonarqube/index.md)
- [Kubernetes CI/CD pipelines](../kubernetes/cicd-and-gitops/01-cicd-pipelines-for-kubernetes.md)
- [Shell scripting for SRE and DevOps automation](../shell-scripts/scripts.md)

## Next Steps

Once the first pipeline is working, the next useful improvements are:

- Connect Jenkins to a Git repository
- Move the pipeline into a `Jenkinsfile`
- Add build, test, and artifact stages
- Store secrets in Jenkins Credentials
- Integrate Docker, SonarQube, or Kubernetes
- Set up webhooks for automatic pipeline triggers
