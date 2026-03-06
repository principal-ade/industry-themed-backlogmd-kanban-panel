# Programmatic Control via Events

This document describes how to control the Kanban and TaskDetail panels programmatically using the panel event system. This is useful for building guided tours, automated testing, or integrating with external systems.

## Event System Overview

Panels communicate via a `PanelEventEmitter` that supports pub/sub messaging:

```typescript
interface PanelEvent<T = unknown> {
  type: string;           // Event type identifier
  source: string;         // Origin of the event (e.g., 'kanban-panel', 'tour-control')
  timestamp: number;      // Unix timestamp
  payload: T;             // Event-specific data
}

interface PanelEventEmitter {
  emit<T>(event: PanelEvent<T>): void;
  on<T>(type: string, handler: (event: PanelEvent<T>) => void): () => void;
  off<T>(type: string, handler: (event: PanelEvent<T>) => void): void;
}
```

## Supported Events

### Task Selection

#### `task:selected`

Selects a task on the Kanban board. When emitted from an external source, triggers the full selection flow including telemetry and event re-emission.

```typescript
events.emit({
  type: 'task:selected',
  source: 'tour-control',  // Use a unique source identifier
  timestamp: Date.now(),
  payload: { taskId: 'task-259' },
});
```

**Payload:**
| Field | Type | Description |
|-------|------|-------------|
| `taskId` | `string` | The ID of the task to select |

**Behavior:**
- KanbanPanel highlights the task card
- TaskDetailPanel displays the task details
- Telemetry span `board.interaction` is emitted with `task.selected` event
- Event is re-emitted with `source: 'kanban-panel'` for other listeners

#### `task:deselected`

Clears the current task selection.

```typescript
events.emit({
  type: 'task:deselected',
  source: 'tour-control',
  timestamp: Date.now(),
  payload: {},
});
```

**Behavior:**
- KanbanPanel clears the selection highlight
- TaskDetailPanel returns to empty state

---

### Task Deletion (TaskDetailPanel)

The delete flow requires two events for safety - one to open the confirmation modal and one to confirm the deletion.

#### `task:delete-open-modal`

Opens the delete confirmation modal for the currently selected task.

```typescript
events.emit({
  type: 'task:delete-open-modal',
  source: 'tour-control',
  timestamp: Date.now(),
  payload: { taskId: 'task-259' },  // Optional: validates against selected task
});
```

**Payload:**
| Field | Type | Description |
|-------|------|-------------|
| `taskId` | `string` (optional) | If provided, only opens modal if this matches the selected task |

**Prerequisites:**
- A task must be selected in the TaskDetailPanel

#### `task:delete-confirm`

Confirms and executes the task deletion.

```typescript
events.emit({
  type: 'task:delete-confirm',
  source: 'tour-control',
  timestamp: Date.now(),
  payload: { taskId: 'task-259' },  // Optional: validates against selected task
});
```

**Payload:**
| Field | Type | Description |
|-------|------|-------------|
| `taskId` | `string` (optional) | If provided, only confirms if this matches the selected task |

**Prerequisites:**
- Delete confirmation modal must be open
- A task must be selected

**Emitted Events:**
- `task:deleted` - Emitted after successful deletion with `{ taskId: string }`

---

## Example: Guided Tour Integration

```typescript
// Step 1: Select a task
events.emit({
  type: 'task:selected',
  source: 'landing-page-tour',
  timestamp: Date.now(),
  payload: { taskId: 'task-259' },
});

// Step 2: Wait for user to read the task details
await delay(3000);

// Step 3: Open delete modal to demonstrate the flow
events.emit({
  type: 'task:delete-open-modal',
  source: 'landing-page-tour',
  timestamp: Date.now(),
  payload: {},
});

// Step 4: Close without confirming (user clicks cancel in UI)
// Or programmatically deselect to close
events.emit({
  type: 'task:deselected',
  source: 'landing-page-tour',
  timestamp: Date.now(),
  payload: {},
});
```

## Storybook Demo

The `Stories/ProgrammaticControl` story in Storybook demonstrates all programmatic control features with an interactive control panel.

Run Storybook:
```bash
npm run storybook
```

Navigate to **Stories > ProgrammaticControl > SelectTask** to see the demo.

## Source Filtering

Events emitted by a panel are ignored when received by the same panel to prevent infinite loops. The `source` field is used for this filtering:

- `kanban-panel` - Events from KanbanPanel
- `task-detail-panel` - Events from TaskDetailPanel

When emitting events from external systems, use a unique source identifier (e.g., `tour-control`, `landing-page-tour`, `test-harness`).
