---
description: Learn image layers, metadata, tags, digests, content-addressable storage, and copy-on-write.
---

# 16. Container Images

An image is metadata plus ordered filesystem layers. Layers are content-addressed: a digest identifies specific content, while a tag is a movable human-friendly name. One image can create many containers; each gets its own writable layer through copy-on-write behavior.

Use immutable digests where deployment identity matters. `latest` is only a tag and may later point to different content. Images package application userspace, not persistent application state.
