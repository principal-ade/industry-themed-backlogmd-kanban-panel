import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { PathsFileTreeBuilder } from '@principal-ai/repository-abstraction';
import { KanbanPanel } from './KanbanPanel';
import {
  createMockContext,
  createMockActions,
  createMockEvents,
} from '../mocks/panelContext';
import {
  rawTaskMarkdownFiles,
  getMockTaskFilePaths,
  generateMockMilestones,
} from './kanban/mocks/mockData';
import type { DataSlice } from '../types';

const meta = {
  title: 'Panels/KanbanPanel',
  component: KanbanPanel,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <div
          style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
        >
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof KanbanPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

// Helper to create a mock file tree slice with backlog files
const createBacklogFileTreeSlice = (): DataSlice<any> => {
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

  // Use PathsFileTreeBuilder for proper FileTree structure
  const builder = new PathsFileTreeBuilder();
  const fileTree = builder.build({
    files: allPaths,
  });

  return {
    scope: 'repository',
    name: 'fileTree',
    data: fileTree,
    loading: false,
    error: null,
    refresh: async () => {},
  };
};

// Helper to create context and actions with backlog data
const createBacklogMocks = () => {
  const mockMilestones = generateMockMilestones();
  const fileTreeSlice = createBacklogFileTreeSlice();

  const mockConfigContent = `project_name: "Backlog.md CLI"
statuses: ["To Do", "In Progress", "Done"]
default_status: "To Do"`;

  const createMilestoneFileContent = (milestone: (typeof mockMilestones)[0]) =>
    `---
id: ${milestone.id}
title: "${milestone.title}"
tasks: [${milestone.tasks.join(', ')}]
---

## Description

${milestone.description || ''}`;

  // Pre-populate file contents with raw markdown from Backlog.md project
  const fileContents = new Map<string, string>();
  fileContents.set('backlog/config.yml', mockConfigContent);

  // Add raw task markdown files - these will be parsed by Core
  for (const [filePath, content] of Object.entries(rawTaskMarkdownFiles)) {
    fileContents.set(filePath, content);
  }

  // Add milestone files
  mockMilestones.forEach((milestone) => {
    if (milestone.filePath) {
      fileContents.set(milestone.filePath, createMilestoneFileContent(milestone));
    }
  });

  // Create event emitter
  const events = createMockEvents();

  // Create readFile adapter that uses our file contents map
  const readFile = async (path: string): Promise<string> => {
    const content = fileContents.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  };

  // Active file slice that will be updated by openFile
  const activeFileSlice: DataSlice<any> = {
    scope: 'repository',
    name: 'active-file',
    data: {
      path: '',
      content: '',
    },
    loading: false,
    error: null,
    refresh: async () => {},
  };

  const context = createMockContext({
    overrides: {
      currentScope: {
        type: 'repository',
        workspace: {
          name: 'my-workspace',
          path: '',
        },
        repository: {
          path: '', // Empty path like TaskWorkflowLifecycle story
          name: 'my-kanban-project',
        },
      },
      adapters: {
        readFile,
        fileSystem: {
          readFile: async (path: string) => fileContents.get(path) || '',
          writeFile: async (path: string, content: string) => {
            fileContents.set(path, content);

            // Rebuild fileTree with the new file using PathsFileTreeBuilder
            const allPaths = Array.from(fileContents.keys());
            const builder = new PathsFileTreeBuilder();
            const updatedFileTree = builder.build({
              files: allPaths,
            });
            fileTreeSlice.data = updatedFileTree;

            // Emit file:write-complete event
            events.emit({
              type: 'file:write-complete',
              source: 'mock-file-system',
              timestamp: Date.now(),
              payload: { path, content },
            });
          },
          createDir: async (path: string) => {
            // Directory creation is a no-op in this mock
          },
          exists: async (path: string) => fileContents.has(path),
          deleteFile: async (path: string) => {
            fileContents.delete(path);
          },
        },
      },
    },
    slices: {
      fileTree: fileTreeSlice,
      'active-file': activeFileSlice,
    },
  });

  const actions = createMockActions({
    openFile: async (filePath: string) => {
      // Return content directly to avoid race conditions
      const content = fileContents.get(filePath) || '';
      // Also update the slice for compatibility
      activeFileSlice.data = {
        path: filePath,
        content,
      };
      return content as any; // Return content directly
    },
  });

  return { context, actions, events };
};

export const EmptyState: Story = {
  args: {
    context: createMockContext({
      overrides: {
        currentScope: {
          type: 'repository',
          workspace: {
            name: 'my-workspace',
            path: '',
          },
          repository: {
            path: '',
            name: 'my-project',
          },
        },
      },
    }),
    actions: createMockActions(),
    events: createMockEvents(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Empty state shown when the repository is not a Backlog.md project.',
      },
    },
  },
};

// Helper to create backlog mocks with NO tasks for empty state
const createEmptyBacklogMocks = () => {
  // Use PathsFileTreeBuilder for proper FileTree structure
  const builder = new PathsFileTreeBuilder();
  const fileTree = builder.build({
    files: ['backlog/config.yml'],
  });

  const fileTreeSlice: DataSlice<any> = {
    scope: 'repository',
    name: 'fileTree',
    data: fileTree,
    loading: false,
    error: null,
    refresh: async () => {},
  };

  const mockConfigContent = `project_name: "Backlog.md CLI"
statuses: ["To Do", "In Progress", "Done"]
default_status: "To Do"`;

  const fileContents = new Map<string, string>();
  fileContents.set('backlog/config.yml', mockConfigContent);

  const events = createMockEvents();

  const readFile = async (path: string): Promise<string> => {
    const content = fileContents.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  };

  const activeFileSlice: DataSlice<any> = {
    scope: 'repository',
    name: 'active-file',
    data: {
      path: '',
      content: '',
    },
    loading: false,
    error: null,
    refresh: async () => {},
  };

  const context = createMockContext({
    overrides: {
      currentScope: {
        type: 'repository',
        workspace: {
          name: 'my-workspace',
          path: '',
        },
        repository: {
          path: '', // Empty path like TaskWorkflowLifecycle story
          name: 'my-kanban-project',
        },
      },
      adapters: {
        readFile,
        fileSystem: {
          readFile: async (path: string) => fileContents.get(path) || '',
          writeFile: async (path: string, content: string) => {
            fileContents.set(path, content);
            // Rebuild fileTree with the new file using PathsFileTreeBuilder
            const allPaths = Array.from(fileContents.keys());
            const builder = new PathsFileTreeBuilder();
            const updatedFileTree = builder.build({
              files: allPaths,
            });
            fileTreeSlice.data = updatedFileTree;
            events.emit({
              type: 'file:write-complete',
              source: 'mock-file-system',
              timestamp: Date.now(),
              payload: { path, content },
            });
          },
          createDir: async (path: string) => {
            // Directory creation is a no-op in this mock
          },
          exists: async (path: string) => fileContents.has(path),
          deleteFile: async (path: string) => {
            fileContents.delete(path);
          },
        },
      },
    },
    slices: {
      fileTree: fileTreeSlice,
      'active-file': activeFileSlice,
    },
  });

  const actions = createMockActions({
    openFile: async (filePath: string) => {
      const content = fileContents.get(filePath) || '';
      activeFileSlice.data = {
        path: filePath,
        content,
      };
      return content as any;
    },
  });

  return { context, actions, events };
};

const emptyBacklogMocks = createEmptyBacklogMocks();

export const BoardEmptyState: Story = {
  args: {
    context: emptyBacklogMocks.context,
    actions: emptyBacklogMocks.actions,
    events: emptyBacklogMocks.events,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Happy empty state shown when the Backlog.md project is initialized but has no tasks yet. Users can click "Add Task" to create their first task.',
      },
    },
  },
};

// Create mocks once outside the render function to avoid recreation
const backlogMocks = createBacklogMocks();

export const WithMockData: Story = {
  args: {
    context: backlogMocks.context,
    actions: backlogMocks.actions,
    events: backlogMocks.events,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Kanban board showing tasks organized by status columns with mock data. Create a new task to see it appear immediately on the board without reloading.',
      },
    },
  },
};

export const MilestonesView: Story = {
  args: {
    context: backlogMocks.context,
    actions: backlogMocks.actions,
    events: backlogMocks.events,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Milestones view showing project milestones with progress indicators. Toggle the view using the Board/Milestones switch in the header.',
      },
    },
  },
};
