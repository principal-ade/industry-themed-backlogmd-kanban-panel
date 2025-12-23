import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MilestonePanel } from './MilestonePanel';
import {
  createMockContext,
  createMockActions,
  createMockEvents,
} from '../mocks/panelContext';
import type { DataSlice } from '../types';

const meta = {
  title: 'Panels/MilestonePanel',
  component: MilestonePanel,
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
} satisfies Meta<typeof MilestonePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock milestones data
const mockMilestones = [
  {
    id: 'm-0',
    title: 'Release 1.0',
    description: 'Initial release with core features including user authentication, dashboard, and basic reporting.',
    tasks: ['1', '2', '3', '4', '5'],
  },
  {
    id: 'm-1',
    title: 'Sprint 3',
    description: 'Focus on performance improvements and bug fixes.',
    tasks: ['6', '7', '8'],
  },
  {
    id: 'm-2',
    title: 'Q1 Goals',
    description: 'Complete API v2 migration and documentation updates.',
    tasks: ['9', '10'],
  },
];

// Mock tasks data
const mockTasks = [
  { id: '1', title: 'Implement user login', status: 'Done', priority: 'high', milestone: 'm-0' },
  { id: '2', title: 'Create dashboard layout', status: 'Done', priority: 'high', milestone: 'm-0' },
  { id: '3', title: 'Add user settings page', status: 'In Progress', priority: 'medium', milestone: 'm-0' },
  { id: '4', title: 'Implement search functionality', status: 'To Do', priority: 'medium', milestone: 'm-0' },
  { id: '5', title: 'Add export to PDF', status: 'To Do', priority: 'low', milestone: 'm-0' },
  { id: '6', title: 'Optimize database queries', status: 'In Progress', priority: 'high', milestone: 'm-1' },
  { id: '7', title: 'Fix memory leak in worker', status: 'Done', priority: 'high', milestone: 'm-1' },
  { id: '8', title: 'Add caching layer', status: 'To Do', priority: 'medium', milestone: 'm-1' },
  { id: '9', title: 'Migrate API endpoints', status: 'In Progress', priority: 'high', milestone: 'm-2' },
  { id: '10', title: 'Update API documentation', status: 'To Do', priority: 'medium', milestone: 'm-2' },
];

// Helper to create milestone file content
const createMilestoneFileContent = (milestone: typeof mockMilestones[0]) =>
  `---
id: ${milestone.id}
title: "${milestone.title}"
tasks: [${milestone.tasks.join(', ')}]
---

## Description

${milestone.description}
`.trim();

// Helper to create task file content
const createTaskFileContent = (task: typeof mockTasks[0]) =>
  `---
id: ${task.id}
title: ${task.title}
status: ${task.status}
priority: ${task.priority}
milestone: ${task.milestone}
created_date: 2024-01-15
labels: []
dependencies: []
---

Task description for ${task.title}.
`.trim();

// Helper to create a mock file tree slice with milestone files
const createMilestoneFileTreeSlice = (): DataSlice<any> => {
  const milestoneFiles = mockMilestones.map((m) => ({
    path: `backlog/milestones/${m.id} - ${m.title.toLowerCase().replace(/\s+/g, '-')}.md`,
    name: `${m.id} - ${m.title.toLowerCase().replace(/\s+/g, '-')}.md`,
    type: 'file',
  }));

  const taskFiles = mockTasks.map((task) => ({
    path: `backlog/tasks/${task.id} - ${task.title.replace(/[<>:"/\\|?*]/g, '').slice(0, 30)}.md`,
    name: `${task.id} - ${task.title.replace(/[<>:"/\\|?*]/g, '').slice(0, 30)}.md`,
    type: 'file',
  }));

  return {
    scope: 'repository',
    name: 'fileTree',
    data: {
      name: 'my-milestone-project',
      path: '/Users/developer/projects/my-milestone-project',
      type: 'directory',
      allFiles: [
        { path: 'backlog/config.yml', name: 'config.yml', type: 'file' },
        ...milestoneFiles,
        ...taskFiles,
      ],
    },
    loading: false,
    error: null,
    refresh: async () => {},
  };
};

// Helper to create context and actions with milestone data
const createMilestoneMocks = () => {
  const fileTreeSlice = createMilestoneFileTreeSlice();

  const mockConfigContent = `project_name: My Milestone Project
statuses: [To Do, In Progress, Done]
default_status: To Do
milestones: []`;

  // Pre-populate file contents
  const fileContents = new Map<string, string>();
  fileContents.set('backlog/config.yml', mockConfigContent);

  // Add milestone files
  mockMilestones.forEach((milestone) => {
    const path = `backlog/milestones/${milestone.id} - ${milestone.title.toLowerCase().replace(/\s+/g, '-')}.md`;
    fileContents.set(path, createMilestoneFileContent(milestone));
  });

  // Add task files
  mockTasks.forEach((task) => {
    const path = `backlog/tasks/${task.id} - ${task.title.replace(/[<>:"/\\|?*]/g, '').slice(0, 30)}.md`;
    fileContents.set(path, createTaskFileContent(task));
  });

  // Active file slice
  const activeFileSlice: DataSlice<any> = {
    scope: 'repository',
    name: 'active-file',
    data: { path: '', content: '' },
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
        path: '/Users/developer/projects/my-milestone-project',
        name: 'my-milestone-project',
      },
    },
    slices: mockSlices,
    getRepositorySlice: <T = unknown,>(name: string) => {
      return mockSlices.get(name) as DataSlice<T> | undefined;
    },
  });

  const actions = createMockActions({
    openFile: async (filePath: string) => {
      const content = fileContents.get(filePath) || '';
      activeFileSlice.data = { path: filePath, content };
      console.log('[Mock] Opening file:', filePath, 'Length:', content.length);
      return content as any;
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
        story: 'Empty state shown when the repository is not a Backlog.md project.',
      },
    },
  },
};

// Create mocks once
const milestoneMocks = createMilestoneMocks();

export const WithMilestones: Story = {
  args: {
    context: milestoneMocks.context,
    actions: milestoneMocks.actions,
    events: createMockEvents(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Milestone panel showing milestones with progress bars. Click to expand and see tasks.',
      },
    },
  },
};
