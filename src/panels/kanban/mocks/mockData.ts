/**
 * Mock Data Generator for Kanban Panel Testing
 *
 * Generates sample task data matching the Backlog.md Task interface
 * for testing and development purposes.
 */

import type { Task } from '@backlog-md/core';

// Sample task titles for generating mock data
const taskTitles = [
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
  'Set up CI CD pipeline',
  'Write unit tests',
  'Configure linting rules',
  'Set up development environment',
  'Create project structure',
];

// Task statuses distributed evenly
const statuses: Array<'To Do' | 'In Progress' | 'Done'> = ['To Do', 'In Progress', 'Done'];

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
 * Creates 30 tasks with evenly distributed statuses (To Do, In Progress, Done)
 */
export function generateMockTasks(): Task[] {
  const tasks: Task[] = [];

  // Generate all tasks in tasks/ directory with evenly distributed statuses
  taskTitles.forEach((title, index) => {
    const id = String(index + 1).padStart(3, '0');
    const assigneeIndex = index % assignees.length;
    const labelIndex = index % labelSets.length;
    const priorityIndex = index % priorities.length;
    const statusIndex = index % statuses.length;

    tasks.push({
      id,
      title,
      status: statuses[statusIndex],
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

/** Mock milestone data structure (includes filePath for test setup) */
export interface MockMilestone {
  id: string;
  title: string;
  description: string;
  rawContent: string;
  tasks: string[];
  filePath: string;
}

/**
 * Generate mock milestones for testing the milestone view
 * Note: Milestone files must be named m-{number}.md (e.g., m-0.md, m-1.md)
 */
export function generateMockMilestones(): MockMilestone[] {
  return [
    {
      id: 'm-0',
      title: 'Version 1.0 - MVP Release',
      description: 'Initial release with core functionality including authentication, basic CRUD operations, and essential UI components.',
      rawContent: '',
      tasks: ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010'],
      filePath: 'backlog/milestones/m-0.md',
    },
    {
      id: 'm-1',
      title: 'Version 1.1 - Enhanced Features',
      description: 'Second release focusing on user experience improvements, notifications, and search functionality.',
      rawContent: '',
      tasks: ['011', '012', '013', '014', '015'],
      filePath: 'backlog/milestones/m-1.md',
    },
    {
      id: 'm-2',
      title: 'Version 2.0 - Platform Expansion',
      description: 'Major release with reporting, analytics, mobile support, and internationalization.',
      rawContent: '',
      tasks: ['016', '017', '018', '019', '020', '021', '022', '023', '024', '025'],
      filePath: 'backlog/milestones/m-2.md',
    },
    {
      id: 'm-3',
      title: 'Infrastructure & DevOps',
      description: 'Ongoing infrastructure improvements, CI/CD, testing, and development tooling.',
      rawContent: '',
      tasks: ['026', '027', '028', '029', '030'],
      filePath: 'backlog/milestones/m-3.md',
    },
  ];
}
