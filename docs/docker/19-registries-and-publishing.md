---
description: Learn registries, repositories, tags, digests, authentication, naming, and publishing images safely.
---

# 19. Image Registries and Publishing

A registry stores images. A repository groups image versions; a tag names a version; a digest identifies exact content. A typical name is `registry.example.com/team/payment-api:v1.2.0`.

The publish sequence is source → Dockerfile → build → local test → tag → authenticate → push → pull on another machine → run. Use `docker login`, `docker tag`, `docker push`, and `docker pull`; avoid exposing tokens in shell history or Dockerfiles. Production deployment should prefer a reviewed digest or immutable release tag over a blind `latest` reference.
