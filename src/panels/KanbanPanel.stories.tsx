import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThemeProvider } from '@principal-ade/industry-theme';
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

  const taskFiles = taskFilePaths.map((path) => ({
    path,
    name: path.split('/').pop(),
    type: 'file',
  }));

  const milestoneFiles = mockMilestones.map((milestone) => ({
    path: milestone.filePath!,
    name: milestone.filePath!.split('/').pop(),
    type: 'file',
  }));

  return {
    scope: 'repository',
    name: 'fileTree',
    data: {
      name: 'my-kanban-project',
      path: '/Users/developer/projects/my-kanban-project',
      type: 'directory',
      allFiles: [
        { path: 'backlog/config.yml', name: 'config.yml', type: 'file' },
        ...taskFiles,
        ...milestoneFiles,
      ],
    },
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
  console.log('[Mock] Config content being set:', mockConfigContent);
  fileContents.set('backlog/config.yml', mockConfigContent);

  // Add raw task markdown files - these will be parsed by Core
  for (const [filePath, content] of Object.entries(rawTaskMarkdownFiles)) {
    fileContents.set(filePath, content);
    console.log('[Mock] Added raw task file:', filePath);
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
      console.log('[Mock] File not found:', path);
      throw new Error(`File not found: ${path}`);
    }
    console.log('[Mock] Reading file:', path, 'Length:', content.length);
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

  const mockSlices = new Map<string, DataSlice<any>>([
    ['fileTree', fileTreeSlice],
    ['active-file', activeFileSlice],
  ]);

  const context = createMockContext({
    currentScope: {
      type: 'repository',
      workspace: {
        name: 'my-workspace',
        path: '/Users/developer/my-workspace',
      },
      repository: {
        path: '/Users/developer/projects/my-kanban-project',
        name: 'my-kanban-project',
      },
    },
    slices: mockSlices,
    getRepositorySlice: <T = unknown,>(name: string) => {
      return mockSlices.get(name) as DataSlice<T> | undefined;
    },
    adapters: {
      readFile,
      fileSystem: {
        readFile: async (path: string) => fileContents.get(path) || '',
        writeFile: async (path: string, content: string) => {
          fileContents.set(path, content);
          console.log('[Mock] Writing file:', path, 'Length:', content.length);

          // Update fileTree slice to reflect the new file
          const currentFiles = fileTreeSlice.data.allFiles || [];
          const fileExists = currentFiles.some((f: any) => f.path === path);
          if (!fileExists) {
            fileTreeSlice.data = {
              ...fileTreeSlice.data,
              allFiles: [
                ...currentFiles,
                { path, name: path.split('/').pop(), type: 'file' },
              ],
            };
            console.log('[Mock] Added file to fileTree:', path);
          }

          // Emit file:write-complete event
          events.emit({
            type: 'file:write-complete',
            source: 'mock-file-system',
            timestamp: Date.now(),
            payload: { path, content },
          });
          console.log('[Mock] Emitted file:write-complete event for:', path);
        },
        createDir: async (path: string) => {
          console.log('[Mock] Creating directory:', path);
        },
        exists: async (path: string) => fileContents.has(path),
        deleteFile: async (path: string) => {
          fileContents.delete(path);
          console.log('[Mock] Deleting file:', path);
        },
      },
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
      console.log(
        '[Mock] Opening file:',
        filePath,
        'Content available:',
        fileContents.has(filePath),
        'Length:',
        content.length
      );
      return content as any; // Return content directly
    },
  });

  return { context, actions, events };
};

export const EmptyState: Story = {
  args: {
    context: createMockContext({
      currentScope: {
        type: 'repository',
        workspace: {
          name: 'my-workspace',
          path: '/Users/developer/my-workspace',
        },
        repository: {
          path: '/Users/developer/projects/my-project',
          name: 'my-project',
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
