import React, { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { TaskDetailPanel } from './TaskDetailPanel';
import {
  createMockContext,
  createMockActions,
  createMockEvents,
} from '../mocks/panelContext';
import { generateMockTasks } from './kanban/mocks/mockData';
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

// Get a sample task with rich content
const getSampleTask = (): Task => {
  const mockTasks = generateMockTasks();
  // Find a task with description, or use the first one
  const task = mockTasks.find(t => t.description) || mockTasks[0];

  // Enhance with more content for demo
  return {
    ...task,
    description: task.description || 'This is the task description with detailed information about what needs to be done.',
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
    rawContent: `# ${task.title}

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
