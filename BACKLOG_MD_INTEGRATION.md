# Backlog.md Integration Guide

This document explains how the Kanban Panel integrates with Backlog.md's file structure to display tasks in a kanban board.

## Table of Contents

- [Overview](#overview)
- [Backlog.md File Structure](#backlogmd-file-structure)
- [Task File Format](#task-file-format)
- [Accessing Files via PanelContext](#accessing-files-via-panelcontext)
- [Implementation Strategy](#implementation-strategy)
- [Parsing Task Files](#parsing-task-files)
- [Example Implementation](#example-implementation)

## Overview

Backlog.md is a markdown-native task management system that stores all tasks, documentation, and decisions as plain markdown files with YAML frontmatter. The Kanban Panel reads these files from the repository's file tree and renders them in a visual kanban board.

## Backlog.md File Structure

Backlog.md organizes files in a `/backlog/` directory at the root of the repository:

```
<repository-root>/
└── backlog/
    ├── config.yml           # Project configuration (statuses, labels, etc.)
    ├── tasks/               # Active tasks (To Do, In Progress)
    │   ├── task-200 - Add-Claude-Code-integration.md
    │   ├── task-172 - Order-tasks-by-status.md
    │   └── task-24.1 - CLI-Kanban-board-milestone-view.md
    ├── completed/           # Completed/Done tasks
    │   ├── task-173 - Add-CLI-command.md
    │   └── task-169 - Fix-browser-crashes.md
    ├── drafts/              # Draft tasks (not ready to start)
    ├── archive/             # Archived tasks
    ├── docs/                # Documentation files
    ├── decisions/           # Architecture decision records
    └── milestones/          # Milestone tracking
```

### Key Directories

- **`tasks/`** - Contains all active tasks (statuses: To Do, In Progress)
- **`completed/`** - Contains completed tasks (status: Done)
- **`drafts/`** - Tasks that haven't been promoted to active yet
- **`archive/`** - Old or cancelled tasks

### Config File (`config.yml`)

The `config.yml` file defines project-wide settings:

```yaml
project_name: 'My Project'
default_status: 'To Do'
statuses: ['To Do', 'In Progress', 'Done']
labels: ['bug', 'enhancement', 'feature']
milestones: []
date_format: yyyy-mm-dd hh:mm
default_editor: 'code'
auto_commit: false
zero_padded_ids: 3
```

**Key fields for Kanban Panel:**

- `statuses` - Array of status column names
- `project_name` - Project identifier
- `default_status` - Initial status for new tasks

## Task File Format

Each task is stored as a markdown file with YAML frontmatter:

### Filename Convention

```
task-<id> - <title-slug>.md
```

Examples:

- `task-200 - Add-Claude-Code-integration.md`
- `task-24.1 - CLI-Kanban-board-milestone-view.md` (subtask)
- `task-172 - Order-tasks-by-status.md`

### File Structure

```markdown
---
id: task-200
title: Add Claude Code integration with workflow commands during init
status: To Do
assignee: ['@codex']
created_date: '2025-07-23'
updated_date: '2025-09-06 21:22'
labels:
  - enhancement
  - developer-experience
dependencies:
  - task-24.1
  - task-208
priority: medium
---

## Description

Enable users to leverage Claude Code's custom commands feature...

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Claude Code template files are stored in src/templates/claude/
- [ ] #2 backlog init copies .claude directory to user's project
- [x] #3 Commands include: parse-prd, plan-task, etc.
<!-- AC:END -->

## Implementation Plan

1. Create template structure
2. Update init command
3. Add documentation
```

### YAML Frontmatter Fields

| Field          | Type     | Required | Description                                          |
| -------------- | -------- | -------- | ---------------------------------------------------- |
| `id`           | string   | Yes      | Unique task identifier (e.g., "task-200")            |
| `title`        | string   | Yes      | Task title                                           |
| `status`       | string   | Yes      | Current status (must match a status from config.yml) |
| `assignee`     | string[] | No       | Array of assignees (e.g., ["@codex", "@claude"])     |
| `created_date` | string   | Yes      | Creation date (YYYY-MM-DD or YYYY-MM-DD HH:mm)       |
| `updated_date` | string   | No       | Last update date                                     |
| `labels`       | string[] | No       | Array of labels (e.g., ["bug", "enhancement"])       |
| `dependencies` | string[] | No       | Array of task IDs this task depends on               |
| `priority`     | string   | No       | Priority level: "low", "medium", "high", "critical"  |
| `ordinal`      | number   | No       | Sort order within status column                      |
| `parent`       | string   | No       | Parent task ID for subtasks                          |

### Subtasks

Subtasks use a dotted ID convention:

- Parent: `task-24`
- Subtask: `task-24.1`, `task-24.2`, etc.

## Accessing Files via PanelContext

The Kanban Panel receives file data through the PanelContext, which provides a `fileTree` data slice.

### FileTree Slice Structure

```typescript
{
  root: "owner/repo",
  files: [
    { path: "backlog/config.yml", size: 375, lines: 17 },
    { path: "backlog/tasks/task-200 - Add-Claude-Code-integration.md", size: 1842, lines: 34 },
    { path: "backlog/tasks/task-172 - Order-tasks-by-status.md", size: 956, lines: 22 },
    { path: "backlog/completed/task-173 - Add-CLI-command.md", size: 1234, lines: 28 }
  ]
}
```

### Accessing the FileTree

```typescript
// In your panel component
const { context, actions } = usePanelProvider();

// Get the fileTree slice
const fileTreeSlice = context.getRepositorySlice<FileTreeData>('fileTree');

if (!fileTreeSlice) {
  console.error('FileTree slice not available');
  return;
}

// Access the data
const { data, loading, error } = fileTreeSlice;

if (loading) {
  // Show loading state
  return <LoadingSpinner />;
}

if (error) {
  // Show error state
  return <ErrorMessage error={error} />;
}

// Use the file list
const files = data?.files || [];
```

## Implementation Strategy

### Step 1: Find Backlog Files

Filter the fileTree to find relevant Backlog.md files:

```typescript
// Find config file
const configFile = files.find((f) => f.path === 'backlog/config.yml');

// Find task files (active tasks)
const taskFiles = files.filter(
  (f) =>
    f.path.startsWith('backlog/tasks/') &&
    f.path.endsWith('.md') &&
    f.path.match(/task-\d+/)
);

// Find completed tasks
const completedFiles = files.filter(
  (f) => f.path.startsWith('backlog/completed/') && f.path.endsWith('.md')
);
```

### Step 2: Fetch File Contents

Use the `actions.openFile()` method to fetch file contents:

```typescript
// Fetch config
const configContent = await fetchFileContent('backlog/config.yml');
const config = parseYaml(configContent);

// Fetch all task files
const taskPromises = taskFiles.map((file) => fetchFileContent(file.path));
const taskContents = await Promise.all(taskPromises);
```

### Step 3: Parse Task Files

Extract YAML frontmatter and parse it:

```typescript
function parseTaskFile(content: string) {
  // Match YAML frontmatter
  const match = content.match(/^---\n([\s\S]*?)\n---/);

  if (!match) {
    throw new Error('Invalid task file: missing frontmatter');
  }

  // Parse YAML
  const frontmatter = parseYaml(match[1]);

  // Extract markdown body
  const body = content.slice(match[0].length).trim();

  return {
    ...frontmatter,
    body,
  };
}
```

### Step 4: Group by Status

Organize tasks into kanban columns:

```typescript
const tasksByStatus = new Map<string, Task[]>();

// Initialize columns from config
config.statuses.forEach((status) => {
  tasksByStatus.set(status, []);
});

// Group tasks
tasks.forEach((task) => {
  const statusKey = task.status || config.default_status;
  const column = tasksByStatus.get(statusKey);
  if (column) {
    column.push(task);
  }
});

// Sort tasks within each column
tasksByStatus.forEach((tasks, status) => {
  tasks.sort((a, b) => {
    // Sort by ordinal if present
    if (a.ordinal !== undefined && b.ordinal !== undefined) {
      return a.ordinal - b.ordinal;
    }

    // Then by priority
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const aPriority = priorityOrder[a.priority] || 0;
    const bPriority = priorityOrder[b.priority] || 0;

    if (aPriority !== bPriority) {
      return bPriority - aPriority; // Higher priority first
    }

    // Finally by creation date (newest first)
    return (
      new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
    );
  });
});
```

## Parsing Task Files

### YAML Parser

You can use a library like `js-yaml` or implement a simple parser:

```typescript
import yaml from 'js-yaml';

function parseYaml(yamlString: string): any {
  try {
    return yaml.load(yamlString);
  } catch (error) {
    console.error('YAML parse error:', error);
    throw new Error('Failed to parse YAML frontmatter');
  }
}
```

### Complete Parser Example

```typescript
interface TaskMetadata {
  id: string;
  title: string;
  status: string;
  assignee?: string[];
  created_date: string;
  updated_date?: string;
  labels?: string[];
  dependencies?: string[];
  priority?: 'low' | 'medium' | 'high' | 'critical';
  ordinal?: number;
  parent?: string;
}

interface Task extends TaskMetadata {
  body: string;
  description?: string;
  acceptanceCriteria?: string[];
}

function parseTaskFile(content: string, filepath: string): Task {
  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  if (!frontmatterMatch) {
    throw new Error(
      `Invalid task file: ${filepath} - missing YAML frontmatter`
    );
  }

  // Parse YAML frontmatter
  const metadata = yaml.load(frontmatterMatch[1]) as TaskMetadata;

  // Validate required fields
  if (!metadata.id || !metadata.title || !metadata.status) {
    throw new Error(`Invalid task file: ${filepath} - missing required fields`);
  }

  // Extract body content
  const body = content.slice(frontmatterMatch[0].length).trim();

  // Extract description (## Description section)
  const descriptionMatch = body.match(
    /## Description\n\n([\s\S]*?)(?=\n## |$)/
  );
  const description = descriptionMatch ? descriptionMatch[1].trim() : undefined;

  // Extract acceptance criteria
  const acMatch = body.match(
    /## Acceptance Criteria\n<!-- AC:BEGIN -->\n([\s\S]*?)\n<!-- AC:END -->/
  );
  const acceptanceCriteria = acMatch
    ? acMatch[1]
        .split('\n')
        .filter((line) => line.trim().startsWith('- ['))
        .map((line) => line.trim())
    : undefined;

  return {
    ...metadata,
    body,
    description,
    acceptanceCriteria,
  };
}
```

## Example Implementation

Here's a complete example of how to integrate with the Kanban Panel:

```typescript
// hooks/useBacklogData.ts
import { useState, useEffect, useCallback } from 'react';
import { usePanelProvider } from '@principal-ade/panel-framework-core';
import yaml from 'js-yaml';

interface FileTreeData {
  root: string;
  files: Array<{ path: string; size: number; lines: number }>;
}

interface BacklogConfig {
  project_name: string;
  statuses: string[];
  default_status: string;
}

export function useBacklogData() {
  const { context, actions } = usePanelProvider();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBacklogData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get fileTree slice
      const fileTreeSlice =
        context.getRepositorySlice<FileTreeData>('fileTree');

      if (!fileTreeSlice?.data) {
        throw new Error('FileTree data not available');
      }

      const files = fileTreeSlice.data.files;

      // Find config file
      const configFile = files.find((f) => f.path === 'backlog/config.yml');
      if (!configFile) {
        throw new Error(
          'No backlog/config.yml found - is this a Backlog.md project?'
        );
      }

      // Fetch and parse config
      const configContent = await fetchFileContent('backlog/config.yml');
      const config = yaml.load(configContent) as BacklogConfig;
      setStatuses(config.statuses || ['To Do', 'In Progress', 'Done']);

      // Find all task files
      const taskFiles = files.filter(
        (f) =>
          (f.path.startsWith('backlog/tasks/') ||
            f.path.startsWith('backlog/completed/')) &&
          f.path.endsWith('.md') &&
          f.path.match(/task-[\d.]+/)
      );

      // Fetch all task contents
      const taskPromises = taskFiles.map((file) =>
        fetchFileContent(file.path).then((content) => ({
          content,
          filepath: file.path,
        }))
      );

      const taskResults = await Promise.all(taskPromises);

      // Parse all tasks
      const parsedTasks = taskResults
        .map(({ content, filepath }) => {
          try {
            return parseTaskFile(content, filepath);
          } catch (err) {
            console.error(`Failed to parse ${filepath}:`, err);
            return null;
          }
        })
        .filter((task): task is Task => task !== null);

      setTasks(parsedTasks);
    } catch (err) {
      console.error('Failed to load backlog data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load backlog');
    } finally {
      setIsLoading(false);
    }
  }, [context, actions]);

  // Helper function to fetch file content
  async function fetchFileContent(path: string): Promise<string> {
    // Use the panel actions to open the file
    // This triggers the file fetch and updates the active-file slice
    await actions.openFile(path);

    // Get the active file data
    const activeFileSlice = context.getRepositorySlice('active-file');
    const fileData = activeFileSlice?.data as any;

    if (!fileData?.content) {
      throw new Error(`Failed to fetch content for ${path}`);
    }

    return fileData.content;
  }

  // Load data on mount
  useEffect(() => {
    loadBacklogData();
  }, [loadBacklogData]);

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped = new Map<string, Task[]>();

    // Initialize all columns
    statuses.forEach((status) => {
      grouped.set(status, []);
    });

    // Group tasks
    tasks.forEach((task) => {
      const column = grouped.get(task.status);
      if (column) {
        column.push(task);
      }
    });

    // Sort tasks within each column
    grouped.forEach((tasks, status) => {
      tasks.sort((a, b) => {
        if (a.ordinal !== undefined && b.ordinal !== undefined) {
          return a.ordinal - b.ordinal;
        }

        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority || 'medium'] || 0;
        const bPriority = priorityOrder[b.priority || 'medium'] || 0;

        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }

        return (
          new Date(b.created_date).getTime() -
          new Date(a.created_date).getTime()
        );
      });
    });

    return grouped;
  }, [tasks, statuses]);

  return {
    tasks,
    statuses,
    tasksByStatus,
    isLoading,
    error,
    refreshData: loadBacklogData,
  };
}
```

## Notes

- **Error Handling**: Always handle cases where Backlog.md files don't exist (non-Backlog.md repos)
- **Performance**: Consider caching parsed tasks to avoid re-parsing on every render
- **Subtasks**: Subtasks use dotted IDs (e.g., `task-24.1`) and have a `parent` field
- **File Watching**: In a live environment, you may want to watch for file changes and refresh
- **Validation**: Validate that task statuses match the configured statuses in `config.yml`

## References

- [Backlog.md GitHub Repository](https://github.com/MrLesk/Backlog.md)
- [Backlog.md Documentation](https://backlog.md)
- [Panel Framework Core Documentation](https://github.com/principal-ade/panel-framework-core)
