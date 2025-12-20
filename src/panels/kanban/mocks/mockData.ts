/**
 * Mock Data Generator for Kanban Panel Testing
 *
 * Generates sample task data matching the Backlog.md Task interface
 * for testing and development purposes.
 */

import type { Task } from '@backlog-md/core';

/**
 * Generate mock tasks for testing the kanban board
 */
export function generateMockTasks(): Task[] {
  return [
    {
      id: 'task-001',
      title: 'Implement user authentication',
      status: 'To Do',
      assignee: ['alice@example.com'],
      createdDate: '2025-11-01T10:00:00Z',
      updatedDate: '2025-11-15T14:30:00Z',
      labels: ['feature', 'security'],
      dependencies: [],
      description:
        'Add OAuth2 authentication flow with support for multiple providers (Google, GitHub). Include session management and token refresh logic.',
      priority: 'high',
      ordinal: 1,
      filePath: 'backlog/tasks/task-001.md',
      source: 'local' as const,
    },
    {
      id: 'task-002',
      title: 'Design database schema',
      status: 'To Do',
      assignee: ['bob@example.com'],
      createdDate: '2025-11-02T09:15:00Z',
      labels: ['database', 'architecture'],
      dependencies: [],
      description:
        'Create normalized database schema for user data, tasks, and relationships. Include migration scripts.',
      priority: 'high',
      ordinal: 2,
      filePath: 'backlog/tasks/task-002.md',
      source: 'local' as const,
    },
    {
      id: 'task-003',
      title: 'Build REST API endpoints',
      status: 'In Progress',
      assignee: ['charlie@example.com'],
      createdDate: '2025-11-03T11:20:00Z',
      updatedDate: '2025-11-16T09:00:00Z',
      labels: ['backend', 'api'],
      dependencies: ['task-002'],
      description:
        'Implement RESTful API endpoints for CRUD operations. Include validation, error handling, and rate limiting.',
      implementationPlan: `
## Implementation Steps
1. Set up Express/Fastify server
2. Define API routes and handlers
3. Add request validation middleware
4. Implement error handling
5. Add rate limiting
6. Write API documentation
      `.trim(),
      priority: 'high',
      ordinal: 1,
      filePath: 'backlog/tasks/task-003.md',
      source: 'local' as const,
    },
    {
      id: 'task-004',
      title: 'Create UI component library',
      status: 'In Progress',
      assignee: ['diana@example.com', 'eve@example.com'],
      createdDate: '2025-11-04T13:45:00Z',
      updatedDate: '2025-11-17T16:20:00Z',
      labels: ['frontend', 'ui'],
      dependencies: [],
      description:
        'Build reusable React components with TypeScript. Include buttons, forms, modals, and data tables.',
      priority: 'medium',
      ordinal: 2,
      acceptanceCriteriaItems: [
        { index: 0, text: 'All components are fully typed', checked: true },
        {
          index: 1,
          text: 'Components support theme customization',
          checked: true,
        },
        {
          index: 2,
          text: 'Storybook stories for each component',
          checked: false,
        },
        { index: 3, text: 'Accessibility audit passes', checked: false },
      ],
      filePath: 'backlog/tasks/task-004.md',
      source: 'local' as const,
    },
    {
      id: 'task-005',
      title: 'Set up CI/CD pipeline',
      status: 'Done',
      assignee: ['frank@example.com'],
      createdDate: '2025-11-05T08:30:00Z',
      updatedDate: '2025-11-10T17:00:00Z',
      labels: ['devops', 'automation'],
      dependencies: [],
      description:
        'Configure GitHub Actions for automated testing, building, and deployment.',
      priority: 'medium',
      ordinal: 1,
      filePath: 'backlog/completed/task-005.md',
      source: 'completed' as const,
    },
    {
      id: 'task-006',
      title: 'Write unit tests',
      status: 'Done',
      assignee: ['grace@example.com'],
      createdDate: '2025-11-06T10:00:00Z',
      updatedDate: '2025-11-12T14:30:00Z',
      labels: ['testing', 'quality'],
      dependencies: ['task-003'],
      description:
        'Add comprehensive unit tests for all API endpoints and utility functions. Aim for 80%+ coverage.',
      priority: 'medium',
      ordinal: 2,
      filePath: 'backlog/completed/task-006.md',
      source: 'completed' as const,
    },
    {
      id: 'task-007',
      title: 'Optimize database queries',
      status: 'To Do',
      assignee: ['henry@example.com'],
      createdDate: '2025-11-07T15:20:00Z',
      labels: ['performance', 'database'],
      dependencies: ['task-002', 'task-003'],
      description:
        'Profile and optimize slow database queries. Add indexes where needed.',
      priority: 'low',
      ordinal: 3,
      filePath: 'backlog/tasks/task-007.md',
      source: 'local' as const,
    },
    {
      id: 'task-008',
      title: 'Implement real-time notifications',
      status: 'To Do',
      assignee: [],
      createdDate: '2025-11-08T09:45:00Z',
      labels: ['feature', 'realtime'],
      dependencies: ['task-003'],
      description:
        'Add WebSocket support for real-time notifications when tasks are updated or assigned.',
      priority: 'low',
      ordinal: 4,
      filePath: 'backlog/tasks/task-008.md',
      source: 'local' as const,
    },
  ];
}

/**
 * Get default status columns for the kanban board
 */
export function getDefaultStatuses(): string[] {
  return ['To Do', 'In Progress', 'Done'];
}

/**
 * Get mock configuration for the kanban panel
 */
export function getMockPanelConfig() {
  return {
    dataSource: 'mock' as const,
    columns: getDefaultStatuses(),
    defaultColumn: 'To Do',
    showDescription: true,
    truncateLength: 150,
    showLabels: true,
    showAssignees: true,
    showPriority: true,
    enableDragDrop: true,
    enableEdit: false,
    enableCreate: false,
  };
}
