import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { KanbanPanel } from './KanbanPanel';
import {
  createMockContext,
  createMockActions,
  createMockEvents,
} from '../mocks/panelContext';
import { generateMockTasks } from './kanban/mocks/mockData';
import type { DataSlice } from '../types';

const meta = {
  title: 'Panels/KanbanPanel',
  component: KanbanPanel,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div
        style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
      >
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof KanbanPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

// Helper to create a mock file tree slice with backlog files
const createBacklogFileTreeSlice = (): DataSlice<any> => {
  const mockTasks = generateMockTasks();
  const taskFiles = mockTasks.map((task) => ({
    path: task.filePath!,
    name: task.filePath!.split('/').pop(),
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
      ],
    },
    loading: false,
    error: null,
    refresh: async () => {},
  };
};

// Helper to create context and actions with backlog data
const createBacklogMocks = () => {
  const mockTasks = generateMockTasks();
  const fileTreeSlice = createBacklogFileTreeSlice();

  const mockConfigContent = `project_name: My Kanban Project
statuses:
  - To Do
  - In Progress
  - Done
default_status: To Do`;

  const createTaskFileContent = (task: (typeof mockTasks)[0]) =>
    `
---
id: ${task.id}
title: ${task.title}
status: ${task.status}
${task.assignee && task.assignee.length > 0 ? `assignee: [${task.assignee.map((a) => `"${a}"`).join(', ')}]` : ''}
created_date: ${task.createdDate}
${task.updatedDate ? `updated_date: ${task.updatedDate}` : ''}
${task.labels && task.labels.length > 0 ? `labels: [${task.labels.map((l) => `"${l}"`).join(', ')}]` : ''}
${task.priority ? `priority: ${task.priority}` : ''}
${task.dependencies && task.dependencies.length > 0 ? `dependencies: [${task.dependencies.map((d) => `"${d}"`).join(', ')}]` : ''}
---

${task.description || ''}

${task.implementationPlan || ''}
`.trim();

  // Pre-populate file contents
  const fileContents = new Map<string, string>();
  console.log('[Mock] Config content being set:', mockConfigContent);
  fileContents.set('backlog/config.yml', mockConfigContent);
  mockTasks.forEach((task) => {
    if (task.filePath) {
      fileContents.set(task.filePath, createTaskFileContent(task));
    }
  });

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

  return { context, actions };
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
    events: createMockEvents(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Kanban board showing tasks organized by status columns with mock data.',
      },
    },
  },
};
