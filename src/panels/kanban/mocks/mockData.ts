/**
 * Mock Data Generator for Kanban Panel Testing
 *
 * Provides raw markdown file contents from the Backlog.md CLI project.
 * These are passed to Core for parsing, testing the actual extraction logic.
 */

import type { Task } from '@backlog-md/core';

/**
 * Raw markdown file contents from Backlog.md project
 * The Core instance will parse these to extract description, acceptance criteria, etc.
 */
export const rawTaskMarkdownFiles: Record<string, string> = {
  'backlog/tasks/task-259 - Add-task-list-filters-for-Status-and-Priority.md': `---
id: task-259
title: Add task list filters for Status and Priority
status: To Do
assignee: []
created_date: '2025-09-06 23:39'
labels:
  - tui
  - filters
  - ui
dependencies: []
priority: medium
---

## Description

Add two filter selectors in the Task List view:

- Status filter: choose from configured statuses (To Do, In Progress, Done or custom)
- Priority filter: choose from high, medium, low

The filters should be accessible from the task list pane and update the list immediately. Keep controls minimal to match the simplified footer.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Status filter is available in the task list and lists statuses from backlog/config.yml
- [ ] #2 Priority filter is available in the task list and lists: high, medium, low
- [ ] #3 Applying a filter updates the task list immediately and can be cleared to show all tasks
- [ ] #4 Filters persist during the current TUI session and reset on exit
- [ ] #5 Works alongside existing navigation; minimal footer remains uncluttered
- [ ] #6 Tests cover filtering logic for status and priority; type-check and lint pass
<!-- AC:END -->
`,

  'backlog/tasks/task-222 - Improve-task-and-subtask-visualization-in-web-UI.md': `---
id: task-222
title: Improve task and subtask visualization in web UI
status: To Do
assignee: []
created_date: '2025-08-03'
labels: []
dependencies: []
---

## Description

The current web UI doesn't effectively visualize the parent-child relationship between tasks and subtasks. While the data model supports hierarchical tasks through parentTaskId and subtasks fields, the UI presents all tasks at the same level without clear visual hierarchy.

## Acceptance Criteria

- [ ] Parent tasks visually indicate they have subtasks (badge or icon)
- [ ] Subtasks are displayed with visual hierarchy (indentation or nesting)
- [ ] Users can expand/collapse subtask groups in the board view
- [ ] Parent task cards show subtask completion progress (e.g. "3/5 complete")
- [ ] Subtasks can be created directly from parent task cards
- [ ] Task hierarchy is preserved when dragging tasks between columns
- [ ] Board view has toggle option to show/hide subtasks
- [ ] Parent-child relationships are clear and intuitive to users
- [ ] Agent instructions improved to reflect usage of subtasks
`,

  'backlog/tasks/task-260 - Web-UI-Add-filtering-to-All-Tasks-view.md': `---
id: task-260
title: 'Web UI: Add filtering to All Tasks view'
status: To Do
assignee: []
created_date: '2025-09-07'
labels:
  - ui
  - filters
dependencies: []
priority: medium
---

## Description

Add filtering capabilities to the All Tasks view in the web UI to help users find and organize their tasks more effectively.

## Acceptance Criteria

- [ ] Filter by status (To Do, In Progress, Done)
- [ ] Filter by priority (High, Medium, Low)
- [ ] Filter by assignee
- [ ] Filter by labels
- [ ] Filters can be combined (AND logic)
- [ ] Clear all filters button
- [ ] Filter state persists during session
- [ ] URL updates to reflect current filters (shareable links)
`,

  'backlog/tasks/task-24.1 - cli-kanban-board-milestone-view.md': `---
id: task-24.1
title: 'CLI: Kanban board milestone view'
status: In Progress
assignee:
  - '@codex'
created_date: '2025-06-09'
updated_date: '2025-12-17 21:47'
labels: []
dependencies: []
parent_task_id: task-24
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a backlog board view --milestones or -m to view the board based on milestones (non-TTY/markdown output only)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 \`backlog board view --milestones\` or \`-m\` outputs milestone-grouped markdown when piped or in non-TTY mode
- [x] #2 Documentation updated if necessary
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
- Add \`-m/--milestones\` flag to \`backlog board view\`
- Group tasks by milestone (including "No milestone") in milestone view output
- Update docs/help text for the new flag
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added -m/--milestones flag to CLI board command. When used with non-TTY output (piped to file or \`| cat\`), generates milestone-grouped markdown board. The flag is passed to the TUI but milestone swimlanes are NOT implemented in the interactive terminal view - the flag is effectively ignored in TTY mode.

DoD verification: ran \`bun test\`, \`bunx tsc --noEmit\`, \`bun run check .\`.
<!-- SECTION:NOTES:END -->
`,

  'backlog/tasks/task-173 - Add-CLI-command-to-export-Kanban-board-to-markdown.md': `---
id: task-173
title: Add CLI command to export Kanban board to markdown
status: Done
assignee:
  - '@claude'
created_date: '2025-07-15'
labels:
  - cli
  - feature
dependencies: []
priority: medium
---

## Description

Add a CLI command to export the current Kanban board state to a markdown file. This allows users to share board snapshots in documentation, READMEs, or issue trackers.

## Acceptance Criteria

- [x] \`backlog board export\` command creates a markdown file
- [x] Export includes all columns and task cards
- [x] Task details (ID, title, assignees, labels) are included
- [x] Output file path can be specified with --output flag
- [x] Default output is backlog.md in project root
`,

  'backlog/tasks/task-169 - Fix-browser-and-board-crashes.md': `---
id: task-169
title: Fix browser and board crashes
status: Done
assignee:
  - '@claude'
created_date: '2025-07-10'
labels:
  - bug
dependencies: []
priority: high
---

## Description

Critical crashes have been reported in the browser and board view components. Users experience application freezes and unresponsive UI when:
- Loading large backlogs (50+ tasks)
- Rapidly switching between views
- Dragging tasks between columns

## Acceptance Criteria

- [x] No crashes when loading backlogs with 100+ tasks
- [x] View switching completes without errors
- [x] Drag and drop operations are stable
- [x] Error boundaries catch and display friendly messages
- [x] Performance profiling shows no memory leaks
`,

  'backlog/tasks/task-168 - Fix-editor-integration-issues-with-vim-nano.md': `---
id: task-168
title: Fix editor integration issues with vim/nano
status: Done
assignee:
  - '@claude'
created_date: '2025-07-08'
labels:
  - bug
  - cli
dependencies: []
priority: high
---

## Description

Users report issues when opening tasks in vim or nano:
- Terminal state not restored after closing editor
- ANSI escape codes appearing in task content
- Cursor position issues after editor closes

## Acceptance Criteria

- [x] vim integration works without terminal corruption
- [x] nano integration works without terminal corruption
- [x] Terminal state fully restored after editor closes
- [x] Works on macOS, Linux, and Windows (WSL)
- [x] EDITOR and VISUAL environment variables respected
`,

  'backlog/tasks/task-95 - Add-priority-field-to-tasks.md': `---
id: task-95
title: Add priority field to tasks
status: Done
assignee:
  - '@claude'
created_date: '2025-06-20'
labels:
  - enhancement
dependencies: []
priority: medium
---

## Description

Add a priority field to tasks to help users organize and prioritize their work. Priority should be visible in both CLI and web UI.

## Acceptance Criteria

- [x] Priority field added to task schema (high, medium, low)
- [x] \`backlog task create --priority high\` works
- [x] Priority displayed in task list with color coding
- [x] Priority filter available in CLI (\`--priority high\`)
- [x] Web UI shows priority indicator on cards
- [x] Priority can be edited via \`backlog task edit --priority\`

## Implementation Notes

Used color coding:
- High: Red border
- Medium: Yellow/orange border
- Low: Blue border
- None: Default gray border
`,

  'backlog/tasks/task-91 - Fix-Windows-issues-empty-task-list-and-weird-Q-character.md': `---
id: task-91
title: 'Fix Windows issues: empty task list and weird Q character'
status: Done
assignee:
  - '@MrLesk'
created_date: '2025-06-18'
labels:
  - bug
  - windows
  - regression
dependencies: []
priority: high
---

## Description

Windows users report two issues:
1. Task list appears empty even when tasks exist
2. Random "Q" character appears in the terminal output

These issues are Windows-specific and don't occur on macOS or Linux.

## Acceptance Criteria

- [x] Task list displays correctly on Windows
- [x] No spurious characters in terminal output
- [x] TUI renders correctly in Windows Terminal
- [x] TUI renders correctly in PowerShell
- [x] TUI renders correctly in cmd.exe

## Implementation Notes

Root cause: blessed library's tput detection was failing on Windows, causing fallback to incorrect terminal codes. Fixed by disabling tput on Windows and using direct ANSI sequences.
`,

  'backlog/tasks/task-77 - Migrate-from-blessed-to-bblessed.md': `---
id: task-77
title: Migrate from blessed to bblessed for better Bun and Windows support
status: Done
assignee:
  - '@ai-agent'
created_date: '2025-06-10'
labels:
  - refactoring
  - dependencies
  - windows
dependencies: []
priority: high
---

## Description

The blessed library has compatibility issues with Bun runtime and Windows. The bblessed fork addresses these issues and is actively maintained.

## Acceptance Criteria

- [x] Replace blessed with bblessed in package.json
- [x] Update all imports to use bblessed
- [x] Verify TUI works on macOS
- [x] Verify TUI works on Linux
- [x] Verify TUI works on Windows
- [x] Verify TUI works with Bun runtime
- [x] No visual regressions in any view

## Implementation Notes

Migration was straightforward - bblessed is API-compatible with blessed. Main changes:
1. Updated package.json dependency
2. Changed import statements
3. Removed workarounds that were only needed for blessed
`,

  'backlog/tasks/task-100 - Add-embedded-web-server-to-Backlog-CLI.md': `---
id: task-100
title: Add embedded web server to Backlog CLI
status: Done
assignee: []
created_date: '2025-06-25'
labels:
  - feature
dependencies: []
priority: high
---

## Description

Add an embedded web server to the Backlog CLI that serves the web UI locally. This allows users to access a rich web interface without external hosting.

## Acceptance Criteria

- [x] \`backlog browser\` command starts local web server
- [x] Web UI served at http://localhost:3000 (configurable port)
- [x] Auto-opens browser on command execution
- [x] Hot-reload when task files change
- [x] Graceful shutdown on Ctrl+C
- [x] Works offline without internet connection

## Implementation Plan

1. Bundle web UI assets into CLI binary
2. Create HTTP server using Bun's native server
3. Implement file watcher for live reload
4. Add browser launch logic (cross-platform)
5. Handle port conflicts gracefully
`,

  'backlog/tasks/task-75 - Fix-task-selection-in-board-view.md': `---
id: task-75
title: Fix task selection in board view - opens wrong task
status: Done
assignee:
  - '@ai-agent'
created_date: '2025-06-08'
labels:
  - bug
  - ui
  - board
dependencies: []
priority: high
---

## Description

When clicking on a task card in the board view, the wrong task details are displayed. This appears to be an index mismatch between the visual representation and the underlying data.

## Acceptance Criteria

- [x] Clicking a task opens the correct task details
- [x] Keyboard navigation selects the correct task
- [x] Works correctly after drag and drop operations
- [x] Works correctly after filtering
- [x] Works correctly after sorting
`,

  'backlog/tasks/task-98 - Invert-task-order-in-Done-column-only.md': `---
id: task-98
title: Invert task order in Done column only
status: Done
assignee:
  - '@Cursor'
created_date: '2025-06-22'
labels:
  - ui
  - enhancement
dependencies: []
priority: low
---

## Description

In the Done column, newer completed tasks should appear at the top so users can see their recent accomplishments first. Other columns should maintain the default ordering (oldest first or by priority).

## Acceptance Criteria

- [x] Done column shows newest tasks at top
- [x] To Do column maintains default order
- [x] In Progress column maintains default order
- [x] Order updates correctly when task moves to Done
- [x] Order persists after page refresh
`,
};

/**
 * Get file paths for all mock task files
 */
export function getMockTaskFilePaths(): string[] {
  return Object.keys(rawTaskMarkdownFiles);
}

/**
 * Get raw markdown content for a file path
 */
export function getMockFileContent(filePath: string): string | undefined {
  return rawTaskMarkdownFiles[filePath];
}

/**
 * Legacy function - returns empty array since we now use raw markdown
 * @deprecated Use rawTaskMarkdownFiles directly
 */
export function generateMockTasks(): Task[] {
  // Return empty - the Core instance will parse the raw markdown
  return [];
}

/**
 * Get default status columns for the kanban board
 */
export function getDefaultStatuses(): string[] {
  return ['To Do', 'In Progress', 'Done'];
}

/**
 * Get mock configuration for the kanban panel
 */
export function getMockPanelConfig() {
  return {
    dataSource: 'mock' as const,
    columns: getDefaultStatuses(),
    defaultColumn: 'To Do',
    showDescription: true,
    truncateLength: 150,
    showLabels: true,
    showAssignees: true,
    showPriority: true,
    enableDragDrop: true,
    enableEdit: false,
    enableCreate: false,
  };
}

/** Mock milestone data structure */
export interface MockMilestone {
  id: string;
  title: string;
  description: string;
  rawContent: string;
  tasks: string[];
  filePath: string;
}

/**
 * Generate mock milestones for testing the milestone view
 */
export function generateMockMilestones(): MockMilestone[] {
  return [
    {
      id: 'm-0',
      title: 'Web UI Improvements',
      description: 'Web UI enhancements including task visualization, filtering, and subtask support.',
      rawContent: '',
      tasks: ['task-259', 'task-222', 'task-260'],
      filePath: 'backlog/milestones/m-0.md',
    },
    {
      id: 'm-1',
      title: 'CLI Stability & Bug Fixes',
      description: 'Critical bug fixes for CLI including git operations, editor integration, and crashes.',
      rawContent: '',
      tasks: ['task-169', 'task-168', 'task-75'],
      filePath: 'backlog/milestones/m-1.md',
    },
    {
      id: 'm-2',
      title: 'CLI Enhancements',
      description: 'New CLI features including notes, priority, and Kanban export.',
      rawContent: '',
      tasks: ['task-24.1', 'task-173', 'task-95', 'task-100'],
      filePath: 'backlog/milestones/m-2.md',
    },
    {
      id: 'm-3',
      title: 'Windows & Cross-Platform Support',
      description: 'Windows compatibility fixes and cross-platform improvements.',
      rawContent: '',
      tasks: ['task-91', 'task-77', 'task-98'],
      filePath: 'backlog/milestones/m-3.md',
    },
  ];
}
