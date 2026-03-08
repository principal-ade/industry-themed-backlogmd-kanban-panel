# Task Lifecycle

The task lifecycle manages how tasks flow through the Kanban panel, from user interactions to data persistence.

## What problem does this solve?

Users need to manage tasks visually - selecting tasks to view details, assigning them to Claude for AI-assisted work, and deleting completed or obsolete tasks. The lifecycle ensures all these operations are coordinated across UI components and persisted correctly.

## Available operations

- **Select task**: Click a task card to view its details in the detail panel
- **Deselect task**: Close the detail panel to return focus to the Kanban board
- **Assign to Claude**: Create a GitHub issue and update task status for AI-assisted work
- **Delete task**: Remove the task file and update the file tree

## Design choices

- Events are used for loose coupling between components (Kanban board, detail panel)
- File tree updates trigger automatic Kanban refresh

## External interface: @backlog-md/core

The panel depends on `@backlog-md/core` as a peer dependency for all task operations:

```
Panel Component → Core → PanelFileSystemAdapter → Host Actions
```

- **Core** (`@backlog-md/core`): External library providing task CRUD, parsing, and domain logic. This is the contract we depend on.
- **PanelFileSystemAdapter**: Bridges Core's `FileSystemAdapter` interface to host panel actions (`readFile`, `writeFile`, `deleteFile`, `createDir`).
- **Host Actions**: The actual file system implementation provided by the host environment (VS Code extension, web app, etc.)

This adapter pattern allows the panel to work in any host environment that provides the required actions, while Core handles all Backlog.md-specific logic.

## Common workflow patterns

1. **View and edit**: Select task -> View details -> Make changes -> Auto-save
2. **Assign to AI**: Select task -> Assign to Claude -> GitHub issue created -> Status updated
3. **Clean up**: Select task -> Delete -> File removed -> Board refreshes
