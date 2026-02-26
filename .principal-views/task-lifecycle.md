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
- The `@backlog-md/core` library handles all file operations
- File tree updates trigger automatic Kanban refresh

## Common workflow patterns

1. **View and edit**: Select task -> View details -> Make changes -> Auto-save
2. **Assign to AI**: Select task -> Assign to Claude -> GitHub issue created -> Status updated
3. **Clean up**: Select task -> Delete -> File removed -> Board refreshes
