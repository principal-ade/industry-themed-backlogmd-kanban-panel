# Attribution

This code is copied from [Backlog.md](https://github.com/MrLesk/Backlog.md)

- Source commit: 9b2b4aa4ce7c9dc454215419413109f3efb04708
- Source date: 2025-11-15
- Source path: src/board.ts
- License: MIT
- Original author: Alex Gavrilescu (@MrLesk)

## Migration Plan

Once Backlog.md publishes `@backlog/core`, this directory will be removed
and replaced with:

```typescript
import {
  buildKanbanStatusGroups,
  sortTasksByOrdinalAndDate,
} from '@backlog/core';
```

**Status:** Tracking migration opportunity. See KANBAN_PANEL_DESIGN.md for details.
