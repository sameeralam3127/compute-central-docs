---
icon: lucide/code
description: Use a practical Jenkins pipeline example to run SonarQube analysis, pass scanner parameters, publish quality gate results, and improve CI code quality checks.
tags:
  - Pipeline
  - Groovy
---

# SonarQube Jenkins Pipeline Example

This example shows the basic flow for checking out code, running a SonarQube scan, waiting for the quality gate, and then continuing the build.

## Example Pipeline

```groovy
pipeline {
    agent any

    environment {
        SONAR_TOKEN = credentials('sonar-token')
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/your-repo.git'
            }
        }

        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh '''
                        sonar-scanner \
                          -Dsonar.projectKey=your-project-key \
                          -Dsonar.sources=. \
                          -Dsonar.host.url=http://your-sonarqube:9000 \
                          -Dsonar.token=$SONAR_TOKEN
                    '''
                }
            }
        }

        stage('Quality Gate') {
            steps {
                timeout(time: 10, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Build') {
            steps {
                sh 'mvn clean package'
            }
        }
    }
}
```

## How to Use It

1. Create a Jenkins Pipeline job.
2. Paste this script or store it in a `Jenkinsfile`.
3. Add `sonar-token` as a secret text credential in Jenkins.
4. Replace the sample repository, project key, and SonarQube URL.

## Practical Tip

Keep `waitForQualityGate` in the pipeline so code quality becomes part of delivery, not a separate report nobody checks.
