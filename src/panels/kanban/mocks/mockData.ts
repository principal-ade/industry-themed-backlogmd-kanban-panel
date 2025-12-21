/**
 * Mock Data Generator for Kanban Panel Testing
 *
 * Generates sample task data matching the Backlog.md Task interface
 * for testing and development purposes.
 */

import type { Task } from '@backlog-md/core';

// Sample task titles for generating mock data
const activeTitles = [
  'Implement user authentication',
  'Design database schema',
  'Build REST API endpoints',
  'Create UI component library',
  'Optimize database queries',
  'Implement real-time notifications',
  'Add search functionality',
  'Create admin dashboard',
  'Implement file upload system',
  'Add email notifications',
  'Build reporting module',
  'Create user settings page',
  'Implement dark mode',
  'Add keyboard shortcuts',
  'Create mobile responsive layout',
  'Implement caching layer',
  'Add analytics tracking',
  'Create onboarding flow',
  'Implement export to PDF',
  'Add multi-language support',
  'Create API documentation',
  'Implement rate limiting',
  'Add two-factor authentication',
  'Create backup system',
  'Implement audit logging',
];

const completedTitles = [
  'Set up CI CD pipeline',
  'Write unit tests',
  'Configure linting rules',
  'Set up development environment',
  'Create project structure',
  'Implement logging system',
  'Add error tracking',
  'Configure deployment scripts',
  'Write integration tests',
  'Set up monitoring',
];

const assignees = [
  'alice@example.com',
  'bob@example.com',
  'charlie@example.com',
  'diana@example.com',
  'eve@example.com',
  'frank@example.com',
  'grace@example.com',
  'henry@example.com',
];

const labelSets = [
  ['feature', 'security'],
  ['database', 'architecture'],
  ['backend', 'api'],
  ['frontend', 'ui'],
  ['devops', 'automation'],
  ['testing', 'quality'],
  ['performance', 'database'],
  ['feature', 'realtime'],
  ['documentation'],
  ['infrastructure'],
];

const priorities: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];

/**
 * Generate mock tasks for testing the kanban board
 * Creates 25 active tasks and 10 completed tasks to test pagination
 */
export function generateMockTasks(): Task[] {
  const tasks: Task[] = [];

  // Generate active tasks (in tasks/ directory)
  activeTitles.forEach((title, index) => {
    const id = String(index + 1).padStart(3, '0');
    const assigneeIndex = index % assignees.length;
    const labelIndex = index % labelSets.length;
    const priorityIndex = index % priorities.length;

    tasks.push({
      id,
      title,
      status: index % 3 === 0 ? 'To Do' : 'In Progress',
      assignee: index % 4 === 0 ? [] : [assignees[assigneeIndex]],
      createdDate: `2025-11-${String((index % 28) + 1).padStart(2, '0')}T10:00:00Z`,
      updatedDate: index % 2 === 0 ? `2025-11-${String((index % 28) + 1).padStart(2, '0')}T14:30:00Z` : undefined,
      labels: labelSets[labelIndex],
      dependencies: [],
      description: `Description for ${title}. This is a sample task for testing purposes.`,
      priority: priorities[priorityIndex],
      ordinal: index + 1,
      filePath: `backlog/tasks/${id} - ${title}.md`,
      source: 'local' as const,
    });
  });

  // Generate completed tasks (in completed/ directory)
  // Use higher IDs so they sort as "most recent" when sorted by ID desc
  completedTitles.forEach((title, index) => {
    const id = String(100 + index + 1).padStart(3, '0'); // 101, 102, 103...
    const assigneeIndex = index % assignees.length;
    const labelIndex = index % labelSets.length;
    const priorityIndex = index % priorities.length;

    tasks.push({
      id,
      title,
      status: 'Done',
      assignee: [assignees[assigneeIndex]],
      createdDate: `2025-11-${String((index % 28) + 1).padStart(2, '0')}T08:30:00Z`,
      updatedDate: `2025-11-${String((index % 28) + 5).padStart(2, '0')}T17:00:00Z`,
      labels: labelSets[labelIndex],
      dependencies: [],
      description: `Description for ${title}. This task has been completed.`,
      priority: priorities[priorityIndex],
      ordinal: index + 1,
      filePath: `backlog/completed/${id} - ${title}.md`,
      source: 'completed' as const,
    });
  });

  return tasks;
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
