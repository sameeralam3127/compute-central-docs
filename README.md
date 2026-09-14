# Compute Central

Source for [computecentral.in](https://computecentral.in/), a practical knowledge base for DevOps, cloud engineering, Kubernetes, automation, monitoring, AI engineering, and SRE work.

Pages prioritize working examples, useful commands, architecture patterns, and operational lessons that engineers can apply in labs and learning projects.

> **Read the site at [computecentral.in](https://computecentral.in/).** This repository exists only to build and publish it.

## Disclaimer

**This content is provided for educational and learning purposes only.**

- **Paid and commercial tools.** Many pages discuss paid, licensed, or SaaS products (for example SonarQube editions, SonarCloud, GitHub Advanced Security, Snyk, Veracode, Checkmarx, Red Hat OpenShift and Ansible Automation Platform, Docker Desktop, and cloud provider services). Compute Central is **not affiliated with, sponsored by, or endorsed by** any of these vendors, and no content is a paid promotion.
- **Trademarks.** All product names, logos, and brands are the property of their respective owners and are used only to identify the products being discussed.
- **Pricing, licensing, and features change.** Plans, prices, license terms, and capabilities described here may be outdated. Always check the vendor's official documentation and license terms before buying, deploying, or relying on any product.
- **Licensing is your responsibility.** Following a guide does not grant you a license to any commercial software. Make sure you hold valid licenses or subscriptions for any paid tool you use.
- **No warranty.** Content is provided "as is", without warranty of any kind. Commands, configurations, and code samples are learning examples. Review, test, and adapt them before using them on real systems, especially production, security-sensitive, or billable cloud environments. The author is not liable for any damage, data loss, downtime, or costs arising from their use.
- **Not professional advice.** Nothing here is legal, security-compliance, or purchasing advice. Views are the author's own and do not represent any employer.

## Contributions

This is a personally maintained project and **does not accept external contributions**. Pull requests will be closed without review. See [CONTRIBUTING.md](CONTRIBUTING.md).

To report a security issue, follow [SECURITY.md](SECURITY.md). Do not open a public issue.

## Copyright

Copyright © 2016–2026 Sameer Alam. All rights reserved.

No license is granted to copy, redistribute, republish, or create derivative works from the content of this repository without prior written permission. You are welcome to read the site and use what you learn in your own work.

## Building Locally

```bash
python3 -m venv venv
venv/bin/pip install zensical
venv/bin/zensical build --clean
```

GitHub Actions builds the site on every push to `main` and deploys it to GitHub Pages.

## About

Compute Central is maintained by **Sameer Alam**, a DevOps Engineer and SRE practitioner. It grew from personal learning notes started in 2016 into a structured knowledge base.

- **Website:** [computecentral.in](https://computecentral.in/)
- **GitHub:** [github.com/sameeralam3127](https://github.com/sameeralam3127)
- **Medium:** [medium.com/@sameeralam3127](https://medium.com/@sameeralam3127)
- **Blog archive:** [compute-central.blogspot.com](https://compute-central.blogspot.com/)
