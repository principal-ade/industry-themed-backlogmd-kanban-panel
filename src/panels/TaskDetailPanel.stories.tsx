import React, { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { TaskDetailPanel } from './TaskDetailPanel';
import {
  createMockContext,
  createMockActions,
  createMockEvents,
} from '../mocks/panelContext';
import type { Task } from '@backlog-md/core';

const meta = {
  title: 'Panels/TaskDetailPanel',
  component: TaskDetailPanel,
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
} satisfies Meta<typeof TaskDetailPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

// Create a sample task with rich content
const getSampleTask = (): Task => {
  return {
    id: 'task-sample-001',
    title: 'Implement user authentication',
    status: 'In Progress',
    createdDate: '2024-01-15',
    assignee: ['Developer'],
    labels: ['feature', 'security'],
    dependencies: [],
    priority: 'high',
    description: 'This is the task description with detailed information about what needs to be done.',
    implementationPlan: `## Steps

1. First, analyze the requirements
2. Design the solution architecture
3. Implement the core functionality
4. Write unit tests
5. Perform integration testing`,
    implementationNotes: `### Notes

- Consider edge cases for error handling
- Make sure to follow the existing code patterns
- Document any API changes`,
    acceptanceCriteriaItems: [
      { index: 1, text: 'Feature is implemented according to spec', checked: true },
      { index: 2, text: 'All unit tests pass', checked: true },
      { index: 3, text: 'Code review completed', checked: false },
      { index: 4, text: 'Documentation updated', checked: false },
    ],
    rawContent: `# Implement user authentication

This is the task description with detailed information about what needs to be done.

## Acceptance Criteria

- [x] Feature is implemented according to spec
- [x] All unit tests pass
- [ ] Code review completed
- [ ] Documentation updated

## Implementation Plan

1. First, analyze the requirements
2. Design the solution architecture
3. Implement the core functionality
4. Write unit tests
5. Perform integration testing

## Implementation Notes

### Notes

- Consider edge cases for error handling
- Make sure to follow the existing code patterns
- Document any API changes`,
  };
};

// Wrapper component that emits task:selected event on mount
const TaskDetailWithSelectedTask: React.FC<{
  task: Task;
  context: any;
  actions: any;
  events: ReturnType<typeof createMockEvents>;
}> = ({ task, context, actions, events }) => {
  useEffect(() => {
    // Emit task:selected event after a short delay to simulate user interaction
    const timer = setTimeout(() => {
      events.emit({
        type: 'task:selected',
        source: 'storybook',
        timestamp: Date.now(),
        payload: { taskId: task.id, task },
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [task, events]);

  return <TaskDetailPanel context={context} actions={actions} events={events} />;
};

export const EmptyState: Story = {
  args: {
    context: createMockContext(),
    actions: createMockActions(),
    events: createMockEvents(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty state shown when no task is selected. Users should click a task in the Kanban board to view details.',
      },
    },
  },
};

const defaultMocks = {
  context: createMockContext(),
  actions: createMockActions(),
  events: createMockEvents(),
};

export const WithSelectedTask: Story = {
  args: defaultMocks,
  render: (args) => {
    const task = getSampleTask();
    return (
      <TaskDetailWithSelectedTask
        task={task}
        context={args.context}
        actions={args.actions}
        events={args.events}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Task detail panel showing a selected task with full content including description, acceptance criteria, and implementation notes.',
      },
    },
  },
};

export const HighPriorityTask: Story = {
  args: defaultMocks,
  render: (args) => {
    const task: Task = {
      ...getSampleTask(),
      id: 'task-urgent-001',
      title: 'Critical Security Fix',
      priority: 'high',
      status: 'In Progress',
      labels: ['security', 'urgent', 'production'],
      assignee: ['Alice', 'Bob'],
      description: 'A critical security vulnerability has been identified that needs immediate attention.',
    };
    return (
      <TaskDetailWithSelectedTask
        task={task}
        context={args.context}
        actions={args.actions}
        events={args.events}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'High priority task with urgent labels and multiple assignees.',
      },
    },
  },
};

export const MinimalTask: Story = {
  args: defaultMocks,
  render: (args) => {
    const task: Task = {
      id: 'task-minimal-001',
      title: 'Simple Task',
      status: 'To Do',
      createdDate: '2024-01-15',
      assignee: [],
      labels: [],
      dependencies: [],
    };
    return (
      <TaskDetailWithSelectedTask
        task={task}
        context={args.context}
        actions={args.actions}
        events={args.events}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'A minimal task with only required fields - no description or additional content.',
      },
    },
  },
};

export const TaskWithBranch: Story = {
  args: defaultMocks,
  render: (args) => {
    const task: Task = {
      ...getSampleTask(),
      id: 'task-feature-123',
      title: 'Feature Branch Task',
      branch: 'feature/new-dashboard',
      status: 'In Progress',
      labels: ['feature', 'dashboard'],
    };
    return (
      <TaskDetailWithSelectedTask
        task={task}
        context={args.context}
        actions={args.actions}
        events={args.events}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Task associated with a feature branch, showing branch metadata.',
      },
    },
  },
};

export const TaskWithGitHubIssue: Story = {
  args: defaultMocks,
  render: (args) => {
    const task: Task = {
      ...getSampleTask(),
      id: 'task-issue-456',
      title: 'Task Linked to GitHub Issue',
      status: 'in-progress',
      labels: ['claude-task', 'feature'],
      references: ['https://github.com/principal-ade/web-ade/issues/42'],
      description: 'This task is linked to a GitHub issue and is being worked on by Claude.',
    };
    return (
      <TaskDetailWithSelectedTask
        task={task}
        context={args.context}
        actions={args.actions}
        events={args.events}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Task with a linked GitHub issue. Shows "View Progress" button instead of "Assign to Claude", and the GitHub Issue link appears in metadata.',
      },
    },
  },
};

export const TaskWithClaudeWorkflow: Story = {
  args: {
    context: createMockContext({
      slices: {
        repoCapabilities: {
          scope: 'repository' as const,
          name: 'repoCapabilities',
          data: { hasClaudeWorkflow: true },
          loading: false,
          error: null,
          refresh: async () => {},
        },
      },
    }),
    actions: createMockActions(),
    events: createMockEvents(),
  },
  render: (args) => {
    const task: Task = {
      ...getSampleTask(),
      id: 'task-assignable-789',
      title: 'Task Ready for Claude Assignment',
      status: 'backlog',
      labels: ['feature'],
      filePath: 'backlog/tasks/task-assignable-789.md',
      description: 'This task can be assigned to Claude because the repository has a Claude workflow configured.',
    };
    return (
      <TaskDetailWithSelectedTask
        task={task}
        context={args.context}
        actions={args.actions}
        events={args.events}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Task in a repository with Claude workflow enabled. Shows the "Assign to Claude" button.',
      },
    },
  },
};
