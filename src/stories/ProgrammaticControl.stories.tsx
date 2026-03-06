import React, { useState, useMemo, useCallback, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThemeProvider, theme as defaultTheme, overrideColors } from '@principal-ade/industry-theme';
import { PathsFileTreeBuilder, type FileTree } from '@principal-ai/repository-abstraction';
import { KanbanPanel } from '../panels/KanbanPanel';
import { TaskDetailPanel } from '../panels/TaskDetailPanel';
import {
  createMockContext,
  createMockActions,
  createMockEvents,
} from '../mocks/panelContext';
import {
  rawTaskMarkdownFiles,
  getMockTaskFilePaths,
  generateMockMilestones,
} from '../panels/kanban/mocks/mockData';
import type { DataSlice, PanelEventEmitter } from '../types';

const customTheme = overrideColors(defaultTheme, {
  primary: '#07c0ca',
  secondary: '#06a8b1',
});

const meta = {
  title: 'Stories/ProgrammaticControl',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Control panel for emitting events to panels
 */
const EventControlPanel: React.FC<{
  events: PanelEventEmitter;
  taskIds: string[];
  selectedTaskId: string | null;
}> = ({ events, taskIds, selectedTaskId }) => {
  const [lastEvent, setLastEvent] = useState<string>('');

  const selectTask = useCallback((taskId: string) => {
    events.emit({
      type: 'task:selected',
      source: 'tour-control',
      timestamp: Date.now(),
      payload: { taskId },
    });
    setLastEvent(`task:selected → ${taskId}`);
  }, [events]);

  const deselectTask = useCallback(() => {
    events.emit({
      type: 'task:deselected',
      source: 'tour-control',
      timestamp: Date.now(),
      payload: {},
    });
    setLastEvent('task:deselected');
  }, [events]);

  const openDeleteModal = useCallback(() => {
    events.emit({
      type: 'task:delete-open-modal',
      source: 'tour-control',
      timestamp: Date.now(),
      payload: { taskId: selectedTaskId },
    });
    setLastEvent('task:delete-open-modal');
  }, [events, selectedTaskId]);

  const confirmDelete = useCallback(() => {
    events.emit({
      type: 'task:delete-confirm',
      source: 'tour-control',
      timestamp: Date.now(),
      payload: { taskId: selectedTaskId },
    });
    setLastEvent('task:delete-confirm');
  }, [events, selectedTaskId]);

  const buttonStyle = {
    padding: '4px 10px',
    background: '#2d2d44',
    border: '1px solid #444',
    borderRadius: '4px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
  };

  const dangerButtonStyle = {
    ...buttonStyle,
    background: '#442d2d',
    border: '1px solid #644',
  };

  const disabledButtonStyle = {
    ...dangerButtonStyle,
    opacity: 0.5,
    cursor: 'not-allowed',
  };

  return (
    <div style={{
      padding: '12px 16px',
      background: '#1a1a2e',
      borderBottom: '1px solid #333',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        <span style={{ color: '#888', fontWeight: 500 }}>
          Select:
        </span>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {taskIds.slice(0, 3).map((taskId) => (
            <button
              key={taskId}
              onClick={() => selectTask(taskId)}
              style={buttonStyle}
            >
              {taskId}
            </button>
          ))}

          <button onClick={deselectTask} style={dangerButtonStyle}>
            Deselect
          </button>
        </div>

        <span style={{ color: '#555' }}>|</span>

        <span style={{ color: '#888', fontWeight: 500 }}>
          Delete Flow:
        </span>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={openDeleteModal}
            disabled={!selectedTaskId}
            style={selectedTaskId ? dangerButtonStyle : disabledButtonStyle}
          >
            Open Modal
          </button>

          <button
            onClick={confirmDelete}
            disabled={!selectedTaskId}
            style={selectedTaskId ? dangerButtonStyle : disabledButtonStyle}
          >
            Confirm Delete
          </button>
        </div>

        {lastEvent && (
          <span style={{
            color: '#07c0ca',
            marginLeft: 'auto',
            fontFamily: 'monospace',
            fontSize: '11px',
          }}>
            Last: {lastEvent}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Story component that wraps KanbanPanel and TaskDetailPanel with event controls
 */
const ProgrammaticControlStory = () => {
  const [events] = useState(() => createMockEvents());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const fileContentsRef = useRef<Map<string, string>>(new Map());

  // Extract task IDs from mock data
  const taskIds = useMemo(() => {
    return Object.keys(rawTaskMarkdownFiles).map((filePath) => {
      const match = filePath.match(/task-(\d+)/);
      return match ? `task-${match[1]}` : '';
    }).filter(Boolean);
  }, []);

  // Initialize file contents
  useMemo(() => {
    const contents = fileContentsRef.current;
    contents.set('backlog/config.yml', `project_name: "Backlog.md CLI"
statuses: ["To Do", "In Progress", "Done"]
default_status: "To Do"`);

    for (const [filePath, content] of Object.entries(rawTaskMarkdownFiles)) {
      contents.set(filePath, content);
    }

    const mockMilestones = generateMockMilestones();
    mockMilestones.forEach((milestone) => {
      if (milestone.filePath) {
        contents.set(milestone.filePath, `---
id: ${milestone.id}
title: "${milestone.title}"
tasks: [${milestone.tasks.join(', ')}]
---

## Description

${milestone.description || ''}`);
      }
    });
  }, []);

  // Create file tree slice
  const fileTreeSlice = useMemo(() => {
    const taskFilePaths = getMockTaskFilePaths();
    const mockMilestones = generateMockMilestones();
    const milestoneFilePaths = mockMilestones
      .map((m) => m.filePath || `backlog/milestones/${m.id}.md`)
      .filter(Boolean);

    const allPaths = [
      'backlog/config.yml',
      ...taskFilePaths,
      ...milestoneFilePaths,
    ];

    const builder = new PathsFileTreeBuilder();
    const fileTree = builder.build({ files: allPaths });

    return {
      scope: 'repository' as const,
      name: 'fileTree',
      data: fileTree,
      loading: false,
      error: null,
      refresh: async () => {},
    } satisfies DataSlice<FileTree>;
  }, []);

  const context = useMemo(() => createMockContext({
    overrides: {
      currentScope: {
        type: 'repository',
        workspace: { name: 'my-workspace', path: '' },
        repository: { path: '', name: 'programmatic-control-demo' },
      },
    },
    slices: { fileTree: fileTreeSlice },
  }), [fileTreeSlice]);

  const actions = useMemo(() => createMockActions({
    readFile: async (path: string): Promise<string> => {
      const content = fileContentsRef.current.get(path);
      if (content === undefined) {
        throw new Error(`File not found: ${path}`);
      }
      return content;
    },
    writeFile: async (path: string, content: string): Promise<void> => {
      fileContentsRef.current.set(path, content);
      events.emit({
        type: 'file:write-complete',
        source: 'mock-file-system',
        timestamp: Date.now(),
        payload: { path, content },
      });
    },
    deleteFile: async (path: string): Promise<void> => {
      fileContentsRef.current.delete(path);
    },
    deleteTask: async (taskId: string): Promise<void> => {
      // Find and delete the task file
      const taskFilePath = Array.from(fileContentsRef.current.keys()).find(
        (path) => path.includes(taskId)
      );
      if (taskFilePath) {
        fileContentsRef.current.delete(taskFilePath);
        console.log(`[Mock] Deleted task: ${taskId} (${taskFilePath})`);
      }
    },
    createDir: async (): Promise<void> => {},
    exists: async (path: string): Promise<boolean> => {
      return fileContentsRef.current.has(path);
    },
  }), [events]);

  // Track selected task ID from events
  useMemo(() => {
    events.on('task:selected', (event) => {
      const payload = event.payload as { taskId?: string };
      if (payload?.taskId) {
        setSelectedTaskId(payload.taskId);
      }
    });

    events.on('task:deselected', () => {
      setSelectedTaskId(null);
    });

    events.on('task:deleted', () => {
      setSelectedTaskId(null);
    });
  }, [events]);

  return (
    <ThemeProvider theme={customTheme}>
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#0d0d1a',
      }}>
        <EventControlPanel
          events={events}
          taskIds={taskIds}
          selectedTaskId={selectedTaskId}
        />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 2, overflow: 'hidden' }}>
            <KanbanPanel
              context={context}
              actions={actions}
              events={events}
            />
          </div>
          <div style={{
            flex: 1,
            borderLeft: '1px solid #333',
            overflow: 'hidden',
          }}>
            <TaskDetailPanel
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
};

export const SelectTask: Story = {
  render: () => <ProgrammaticControlStory />,
  parameters: {
    docs: {
      description: {
        story: `
Demonstrates programmatic control of panels via the event system.

## Supported Events

### Task Selection
- \`task:selected\` - Select a task by ID (triggers full flow: telemetry + event emission)
- \`task:deselected\` - Clear task selection

### Delete Flow (TaskDetailPanel)
- \`task:delete-open-modal\` - Opens the delete confirmation modal
- \`task:delete-confirm\` - Confirms and executes the deletion

## Usage Example

\`\`\`typescript
// Select a task
events.emit({
  type: 'task:selected',
  source: 'tour-control',
  timestamp: Date.now(),
  payload: { taskId: 'task-259' },
});

// Open delete modal
events.emit({
  type: 'task:delete-open-modal',
  source: 'tour-control',
  timestamp: Date.now(),
  payload: { taskId: 'task-259' },
});

// Confirm deletion
events.emit({
  type: 'task:delete-confirm',
  source: 'tour-control',
  timestamp: Date.now(),
  payload: { taskId: 'task-259' },
});
\`\`\`

## Testing the Flow

1. Click a task ID button to select it (appears in TaskDetailPanel on the right)
2. Click "Open Modal" to trigger the delete confirmation modal
3. Click "Confirm Delete" to execute the deletion
        `,
      },
    },
  },
};
