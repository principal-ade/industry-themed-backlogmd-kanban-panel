# Kanban Panel

The Kanban panel provides a visual task management interface for Backlog.md projects, allowing users to view, organize, and modify tasks through an intuitive drag-and-drop board.

## What Problem Does This Solve?

Backlog.md stores tasks as markdown files in a directory structure. While this is great for version control and text-based workflows, it lacks visual organization. The Kanban panel bridges this gap by:

- Providing a familiar board-based view of tasks grouped by status
- Enabling quick status changes via drag-and-drop
- Supporting task creation, editing, and deletion without leaving the visual interface
- Integrating with the panel framework for multi-panel workflows

## Available Operations

### Task Loading
Tasks are loaded lazily from the backlog directory. The panel detects whether the current project is a Backlog.md project and loads tasks accordingly, supporting pagination for large backlogs.

### Task Interactions
- **Selection**: Click a task to view details or trigger cross-panel focus
- **Movement**: Drag tasks between columns to change status
- **CRUD**: Create new tasks, edit existing ones, or delete tasks

### Panel Integration
The Kanban panel participates in the panel framework's focus system, allowing coordinated interactions with other panels (e.g., selecting a task focuses related content in adjacent panels).

## Design Choices

1. **Lazy Loading**: Tasks load incrementally to handle large backlogs without performance degradation
2. **Optimistic Updates**: UI updates immediately on user actions, with background sync to files
3. **Event-Driven Architecture**: All state changes emit events for observability and cross-panel coordination

## Common Workflow Patterns

1. **Triage Flow**: Load tasks → Review in To Do column → Drag to In Progress
2. **Completion Flow**: Select task → Mark complete → Task moves to Done column
3. **Creation Flow**: Click add button → Fill task details → Task appears in target column

## Error Scenarios

- **Load Failure**: If backlog directory is inaccessible, panel shows empty state with retry option
- **Save Failure**: If file write fails, UI reverts optimistic update and shows error notification
- **Invalid Project**: Non-backlog projects show informative message about setup requirements
