---
description: Learn writable layers, volumes, bind mounts, tmpfs, permissions, persistence, and backup planning.
---

# Storage and Persistent Data

Removing a container removes its writable layer. Important database data must use deliberate persistent storage.

| Type | Best for | Caveat |
| --- | --- | --- |
| named volume | managed service data | back it up deliberately |
| bind mount | host-controlled development/config | host path/permissions affect portability |
| tmpfs | temporary sensitive/fast data | disappears on stop |

Use database-supported backup and restore workflows; copying live data files is not automatically a safe backup. Match UID/GID ownership between process and mounted files, keep secrets out of images, and test restores.
