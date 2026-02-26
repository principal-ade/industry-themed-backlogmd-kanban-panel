import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { ResponsiveConfigurablePanelLayout } from '@principal-ade/panel-layouts';
import { Core } from '@backlog-md/core';
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

const meta = {
  title: 'Stories/TaskWorkflowLifecycle',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const TaskWorkflowStory = () => {
  const [events] = useState(() => createMockEvents());
  const lastEventTimestampRef = useRef<number | null>(null);

  // Track file tree state for dynamic updates
  const [fileTreeSha, setFileTreeSha] = useState('mock-sha-123');
  const [allFiles, setAllFiles] = useState<Array<{ path: string }>>(() => {
    const taskFilePaths = getMockTaskFilePaths();
    const mockMilestones = generateMockMilestones();
    const milestoneFiles = mockMilestones.map((milestone) => ({
      path: milestone.filePath || `backlog/milestones/${milestone.id}.md`,
    }));
    return [
      { path: 'backlog/config.yml' },
      ...taskFilePaths.map(path => ({ path })),
      ...milestoneFiles,
    ];
  });

  // Create mock file system adapter and populate with task files
  const mockFS = useMemo(() => {
    // Create a mutable copy of the task files for the file system
    const files: Record<string, string> = { ...rawTaskMarkdownFiles };

    // Add config.yml for Core to recognize this as a Backlog.md project
    files['backlog/config.yml'] = `statuses:
  - To Do
  - In Progress
  - Done
`;

    console.log('[TaskWorkflowStory] Created mock FS with files:', Object.keys(files));

    const fs = {
      exists: async (path: string) => {
        const exists = path in files;
        console.log('[Mock FS] exists:', path, exists);
        return exists;
      },
      readFile: async (path: string) => {
        console.log('[Mock FS] readFile:', path);
        const content = files[path];
        if (content === undefined) throw new Error(`File not found: ${path}`);
        return content;
      },
      writeFile: async (path: string, content: string) => {
        console.log('[Mock FS] Writing file:', path);
        files[path] = content;

        // Update file tree when task files are written
        if (path.includes('backlog/tasks/')) {
          console.log('[Mock FS] Task file written, updating file tree');
          setAllFiles(prev => {
            // Add if not already present
            if (!prev.some(f => f.path === path)) {
              return [...prev, { path }];
            }
            return prev;
          });
          setFileTreeSha(`mock-sha-${Date.now()}`);

          // Emit file:write-complete event
          events.emit({
            type: 'file:write-complete',
            source: 'mock-fs',
            timestamp: Date.now(),
            payload: { path },
          });
        }
      },
      deleteFile: async (path: string) => {
        console.log('[Mock FS] Deleting file:', path);
        delete files[path];
      },
      createDir: async (path: string) => {
        console.log('[Mock FS] Creating directory:', path);
      },
      readDir: async (path: string) => {
        const prefix = path.endsWith('/') ? path : path + '/';
        const entries = new Set<string>();
        for (const key of Object.keys(files)) {
          if (key.startsWith(prefix)) {
            const rest = key.slice(prefix.length);
            const firstSegment = rest.split('/')[0];
            if (firstSegment) entries.add(firstSegment);
          }
        }
        console.log('[Mock FS] readDir:', path, Array.from(entries));
        return Array.from(entries);
      },
      isDirectory: async (path: string) => {
        const prefix = path.endsWith('/') ? path : path + '/';
        for (const key of Object.keys(files)) {
          if (key.startsWith(prefix)) return true;
        }
        return false;
      },
    };
    return fs;
  }, [events]);

  // Create fileTree slice with dynamic state
  const fileTreeSlice = useMemo(() => ({
    scope: 'repository' as const,
    name: 'fileTree',
    loading: false,
    error: null,
    data: {
      allFiles,
      sha: fileTreeSha,
    },
    refresh: async () => {},
  }), [allFiles, fileTreeSha]);

  // Create mock context with file tree and file system adapter
  const context = useMemo(() => {
    console.log('[TaskWorkflowStory] Creating context');
    const ctx = createMockContext();

    // Set repository path to empty string so Core uses relative paths
    ctx.currentScope = {
      type: 'repository',
      workspace: {
        name: 'my-workspace',
        path: '',
      },
      repository: {
        name: 'my-project',
        path: '', // Empty path means use relative paths
      },
    };

    // Add fileTree as direct property (required by KanbanPanel typed props)
    (ctx as Record<string, unknown>).fileTree = fileTreeSlice;

    ctx.getSlice = (sliceName: string) => {
      if (sliceName === 'fileTree') {
        return fileTreeSlice;
      }
      return ctx.slices.get(sliceName);
    };

    ctx.getRepositorySlice = (sliceName: string) => {
      if (sliceName === 'fileTree') {
        return fileTreeSlice;
      }
      if (sliceName === 'repoCapabilities') {
        return {
          scope: 'repository',
          name: 'repoCapabilities',
          loading: false,
          error: null,
          data: {
            hasClaudeWorkflow: true,
            claudeWorkflowPath: '.github/workflows/claude.yml',
          },
          refresh: async () => {},
        };
      }
      const slice = ctx.slices.get(sliceName);
      return slice?.scope === 'repository' ? slice : undefined;
    };

    ctx.adapters = {
      fileSystem: mockFS,
      readFile: mockFS.readFile,
    };

    console.log('[TaskWorkflowStory] Context created with fileTree:', fileTreeSlice.data);

    return ctx;
  }, [mockFS, fileTreeSlice]);

  // Create mock actions
  const actions = useMemo(() => createMockActions(), []);

  // Create Core instance (shares same mockFS as KanbanPanel)
  const core = useMemo(() => new Core({
    projectRoot: '',
    adapters: { fs: mockFS },
  }), [mockFS]);

  // Track if Core is initialized
  const coreInitialized = useRef(false);

  // Host orchestration for focus events
  useEffect(() => {
    // Task selected -> focus detail panel
    const unsubscribeTaskSelected = events.on('task:selected', (event) => {
      // Check if we already handled this exact event to prevent infinite loops
      if (lastEventTimestampRef.current === event.timestamp) {
        console.log('[TaskWorkflowStory] Skipping already-handled event');
        return;
      }

      lastEventTimestampRef.current = event.timestamp;
      console.log('[TaskWorkflowStory] task:selected event received, focusing task-detail panel');

      // Delay focus event slightly to allow panel's listener to register
      setTimeout(() => {
        console.log('[TaskWorkflowStory] Emitting panel:focus after brief delay');
        events.emit({
          type: 'panel:focus',
          payload: { panelId: 'task-detail', panelSlot: 'middle' },
          source: 'task-workflow-story',
          timestamp: Date.now(),
        });
      }, 50);
    });

    // Task deselected -> focus back to kanban
    const unsubscribeTaskDeselected = events.on('task:deselected', () => {
      console.log('[TaskWorkflowStory] task:deselected event received, focusing backlog-kanban panel');
      events.emit({
        type: 'panel:focus',
        payload: { panelId: 'backlog-kanban', panelSlot: 'left' },
        source: 'task-workflow-story',
        timestamp: Date.now(),
      });
    });

    // Task delete requested -> mock deletion
    const unsubscribeDeleteRequested = events.on('task:delete-requested', async (event) => {
      console.log('[TaskWorkflowStory] task:delete-requested event received:', event.payload);
      const { taskId, task } = event.payload as { taskId: string; task: { filePath?: string } };

      try {
        // Mock deletion: remove from filesystem
        const filePath = task.filePath || `backlog/tasks/${taskId}.md`;
        console.log('[TaskWorkflowStory] Deleting file:', filePath);

        await mockFS.deleteFile(filePath);

        // Update file tree to remove deleted file and trigger refresh
        setAllFiles(prev => prev.filter(f => f.path !== filePath));
        setFileTreeSha(`mock-sha-${Date.now()}`);

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // Emit success
        console.log('[TaskWorkflowStory] Delete successful, emitting task:deleted:success');
        events.emit({
          type: 'task:deleted:success',
          source: 'task-workflow-story',
          timestamp: Date.now(),
          payload: { taskId },
        });
      } catch (error) {
        console.error('[TaskWorkflowStory] Delete failed:', error);
        events.emit({
          type: 'task:deleted:error',
          source: 'task-workflow-story',
          timestamp: Date.now(),
          payload: {
            taskId,
            error: error instanceof Error ? error.message : 'Failed to delete task',
          },
        });
      }
    });

    // Task deleted -> refocus kanban
    const unsubscribeTaskDeleted = events.on('task:deleted', () => {
      console.log('[TaskWorkflowStory] task:deleted event received, refocusing backlog-kanban panel');
      events.emit({
        type: 'panel:focus',
        payload: { panelId: 'backlog-kanban', panelSlot: 'left' },
        source: 'task-workflow-story',
        timestamp: Date.now(),
      });
    });

    // Task assign to Claude requested -> mock GitHub issue creation
    const unsubscribeAssignToClaude = events.on('task:assign-to-claude', async (event) => {
      console.log('[TaskWorkflowStory] task:assign-to-claude event received:', event.payload);
      const { taskId, task } = event.payload as {
        taskId: string;
        task: { title: string; filePath?: string; references?: string[] }
      };

      try {
        // Initialize Core if not already done
        if (!coreInitialized.current) {
          console.log('[TaskWorkflowStory] Initializing Core for task update...');
          const isBacklog = await core.isBacklogProject();
          if (isBacklog) {
            await core.initializeLazy(getMockTaskFilePaths());
            coreInitialized.current = true;
            console.log('[TaskWorkflowStory] Core initialized');
          }
        }

        // Simulate creating a GitHub issue
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Mock issue data
        const mockIssueNumber = Math.floor(Math.random() * 1000) + 1;
        const mockIssueUrl = `https://github.com/mock-owner/mock-repo/issues/${mockIssueNumber}`;

        console.log('[TaskWorkflowStory] Mock GitHub issue created:', mockIssueUrl);

        // Update task using Core
        const existingRefs = task.references || [];
        const newRefs = [...existingRefs, mockIssueUrl];

        await core.updateTask(taskId, {
          status: 'In Progress',
          references: newRefs,
        });

        console.log('[TaskWorkflowStory] Updated task with status "In Progress" and issue reference');

        // Emit success
        events.emit({
          type: 'task:assigned-to-claude',
          source: 'task-workflow-story',
          timestamp: Date.now(),
          payload: {
            taskId,
            issueNumber: mockIssueNumber,
            issueUrl: mockIssueUrl,
          },
        });
      } catch (error) {
        console.error('[TaskWorkflowStory] Assign to Claude failed:', error);
        events.emit({
          type: 'task:assign-to-claude:error',
          source: 'task-workflow-story',
          timestamp: Date.now(),
          payload: {
            taskId,
            error: error instanceof Error ? error.message : 'Failed to create GitHub issue',
          },
        });
      }
    });

    // Task created -> add to file tree
    const unsubscribeTaskCreated = events.on('task:created', async (event) => {
      console.log('[TaskWorkflowStory] task:created event received:', event.payload);
      const { filePath, content } = event.payload as { taskId: string; filePath: string; content?: string };

      // Add file to mock filesystem if content provided
      if (content) {
        console.log('[TaskWorkflowStory] Adding file to mockFS:', filePath);
        await mockFS.writeFile(filePath, content);
      }

      // Add to file tree and trigger refresh
      setAllFiles(prev => [...prev, { path: filePath }]);
      setFileTreeSha(`mock-sha-${Date.now()}`);

      // Emit file:write-complete to notify KanbanPanel
      console.log('[TaskWorkflowStory] Emitting file:write-complete event');
      events.emit({
        type: 'file:write-complete',
        source: 'task-workflow-story',
        timestamp: Date.now(),
        payload: { path: filePath },
      });

      console.log('[TaskWorkflowStory] File tree updated, new task should appear in board');
    });

    return () => {
      unsubscribeTaskSelected();
      unsubscribeTaskDeselected();
      unsubscribeDeleteRequested();
      unsubscribeTaskDeleted();
      unsubscribeAssignToClaude();
      unsubscribeTaskCreated();
    };
  }, [events, mockFS]);

  // Debug logging
  useEffect(() => {
    console.log('[TaskWorkflowStory] Context setup:', {
      hasFileTree: !!context.getRepositorySlice?.('fileTree'),
      hasReadFile: !!context.adapters?.readFile,
      hasFileSystem: !!context.adapters?.fileSystem,
    });

    const fileTree = context.getRepositorySlice?.('fileTree');
    if (fileTree) {
      console.log('[TaskWorkflowStory] FileTree data:', fileTree.data);
    }
  }, [context]);

  const panels = [
    {
      id: 'kanban',
      label: 'Tasks',
      content: (
        <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
          <KanbanPanel context={context} actions={actions} events={events} />
        </div>
      ),
    },
    {
      id: 'task-detail',
      label: 'Task Detail',
      content: (
        <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
          {/* Add key to force remount and ensure consistent rendering */}
          <TaskDetailPanel key="task-detail-panel" context={context} actions={actions} events={events} />
        </div>
      ),
    },
    {
      id: 'task-activity',
      label: 'Activity',
      content: (
        <div
          style={{
            height: '100%',
            width: '100%',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1a1a1a',
            color: '#666',
            fontSize: '14px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📋</div>
            <div>Task Activity Panel</div>
            <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.5 }}>
              Comments, timeline, and history will appear here
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div style={{ height: '100vh', background: '#1a1a1a' }}>
      <ResponsiveConfigurablePanelLayout
        theme={{
          colors: {
            text: '#e6e6e6',
            background: '#1a1a1a',
            primary: '#0969da',
            secondary: '#656d76',
            accent: '#8957e5',
            highlight: '#ffd700',
            muted: '#999999',
            success: '#22c55e',
            warning: '#f59e0b',
            error: '#ef4444',
            info: '#3b82f6',
            border: '#333333',
            surface: '#242424',
            backgroundSecondary: '#2d2d2d',
            backgroundTertiary: '#363636',
            backgroundLight: '#404040',
            backgroundHover: '#2a2a2a',
            textSecondary: '#a0a0a0',
            textTertiary: '#808080',
            textMuted: '#999999',
            textOnPrimary: '#ffffff',
          },
          fonts: {
            body: 'system-ui, -apple-system, sans-serif',
            heading: 'system-ui, -apple-system, sans-serif',
            monospace: 'ui-monospace, monospace',
          },
          fontSizes: [11, 12, 14, 16, 20, 24, 32, 48],
          fontWeights: {
            body: 400,
            heading: 600,
            bold: 700,
            light: 300,
            medium: 500,
            semibold: 600,
          },
        }}
        panels={panels}
        layout={{
          left: 'kanban',
          middle: 'task-detail',
          right: 'task-activity',
        }}
        defaultSizes={{
          left: 25,
          middle: 50,
          right: 25,
        }}
        minSizes={{
          left: 15,
          middle: 30,
          right: 15,
        }}
        collapsiblePanels={{
          left: true,
          right: true,
        }}
        collapsed={{
          left: false,
          right: false,
        }}
        showCollapseButtons={true}
        mobileBreakpoint="(max-width: 768px)"
      />
    </div>
  );
};

/**
 * Default Story - Task Workflow with Kanban Board and Task Detail
 *
 * Demonstrates:
 * - Kanban board with tasks
 * - Task detail panel
 * - Focus orchestration between panels
 * - Task selection/deselection flow
 */
export const Default: Story = {
  render: () => (
    <ThemeProvider>
      <TaskWorkflowStory />
    </ThemeProvider>
  ),
};
