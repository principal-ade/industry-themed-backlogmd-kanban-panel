# Attribution

This code is copied from [Backlog.md](https://github.com/MrLesk/Backlog.md)

- Source commit: 9b2b4aa4ce7c9dc454215419413109f3efb04708
- Source date: 2025-11-15
- Source paths:
  - src/web/components/Board.tsx
  - src/web/components/TaskCard.tsx
  - src/web/components/TaskColumn.tsx
- License: MIT
- Original author: Alex Gavrilescu (@MrLesk)

## Migration Plan

Once Backlog.md publishes `@backlog/components` or similar, this directory may be
replaced with official React components:

```typescript
import { Board, TaskCard, TaskColumn } from '@backlog/components'
```

**Status:** Tracking migration opportunity. See KANBAN_PANEL_DESIGN.md for details.

## Note

These components have been copied without modification and will require adaptation
to work with the industry-themed panel framework (ThemeProvider integration, etc.).
