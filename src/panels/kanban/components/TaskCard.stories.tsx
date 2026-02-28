import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThemeProvider, theme as defaultTheme, overrideColors } from '@principal-ade/industry-theme';
import { TaskCard } from './TaskCard';
import type { Task } from '@backlog-md/core';

// Custom theme with cyan primary color
const customTheme = overrideColors(defaultTheme, {
  primary: '#07c0ca',
  secondary: '#06a8b1', // Slightly darker for hover states
});

const meta = {
  title: 'Components/TaskCard',
  component: TaskCard,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={customTheme}>
        <div style={{ width: '300px', padding: '20px' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof TaskCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseTask: Task = {
  id: 'task-001',
  title: 'Implement user authentication',
  status: 'backlog',
  createdDate: '2024-01-15',
  assignee: [],
  labels: [],
  dependencies: [],
};

export const Default: Story = {
  args: {
    task: baseTask,
  },
};

export const WithDescription: Story = {
  args: {
    task: {
      ...baseTask,
      id: 'task-002',
      description: 'Add OAuth2 authentication flow with support for Google and GitHub providers.',
    },
  },
};

export const HighPriority: Story = {
  args: {
    task: {
      ...baseTask,
      id: 'task-003',
      title: 'Critical Security Fix',
      priority: 'high',
      labels: ['security', 'urgent'],
    },
  },
};

export const MediumPriority: Story = {
  args: {
    task: {
      ...baseTask,
      id: 'task-004',
      title: 'Performance Optimization',
      priority: 'medium',
      labels: ['performance'],
    },
  },
};

export const LowPriority: Story = {
  args: {
    task: {
      ...baseTask,
      id: 'task-005',
      title: 'Documentation Update',
      priority: 'low',
      labels: ['docs'],
    },
  },
};

export const WithAssignees: Story = {
  args: {
    task: {
      ...baseTask,
      id: 'task-006',
      title: 'Team Task',
      assignee: ['Alice', 'Bob'],
    },
  },
};

export const WithLabels: Story = {
  args: {
    task: {
      ...baseTask,
      id: 'task-007',
      title: 'Feature Implementation',
      labels: ['feature', 'frontend', 'v2.0'],
    },
  },
};

export const WithGitHubIssue: Story = {
  args: {
    task: {
      ...baseTask,
      id: 'task-008',
      title: 'Task Linked to GitHub Issue',
      status: 'in-progress',
      priority: 'high',
      labels: ['claude-task'],
      references: ['https://github.com/principal-ade/web-ade/issues/42'],
      description: 'This task is being worked on by Claude.',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Task card showing a linked GitHub issue. The issue number appears in the footer with a link icon.',
      },
    },
  },
};

export const WithMultipleReferences: Story = {
  args: {
    task: {
      ...baseTask,
      id: 'task-009',
      title: 'Task with Multiple References',
      status: 'in-progress',
      references: [
        'https://github.com/principal-ade/web-ade/issues/123',
        'https://stackoverflow.com/questions/12345',
        'docs/architecture.md',
      ],
      description: 'Only the first GitHub issue reference is shown.',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'When a task has multiple references, only the first GitHub issue is displayed in the card.',
      },
    },
  },
};

export const Selected: Story = {
  args: {
    task: {
      ...baseTask,
      id: 'task-010',
      title: 'Selected Task',
      priority: 'medium',
    },
    isSelected: true,
  },
};

export const FullFeatured: Story = {
  args: {
    task: {
      ...baseTask,
      id: 'task-011',
      title: 'Full Featured Task',
      description: 'A task with all features enabled to demonstrate the full card layout.',
      priority: 'high',
      status: 'in-progress',
      labels: ['feature', 'frontend'],
      assignee: ['Developer'],
      references: ['https://github.com/principal-ade/web-ade/issues/99'],
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'A task card showcasing all available features: priority, description, labels, assignee, and GitHub issue link.',
      },
    },
  },
};
