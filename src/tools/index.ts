/**
 * Kanban Panel Tools
 *
 * UTCP-compatible tools for the Kanban panel extension.
 * These tools can be invoked by AI agents and emit events that panels listen for.
 *
 * IMPORTANT: This file should NOT import any React components to ensure
 * it can be imported server-side without pulling in React dependencies.
 * Use the './tools' subpath export for server-safe imports.
 */

import type { PanelTool, PanelToolsMetadata } from '@principal-ade/utcp-panel-event';

/**
 * Tool: Move Task
 */
export const moveTaskTool: PanelTool = {
  name: 'move_task',
  description: 'Moves a task to a different status column on the kanban board',
  inputs: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'The ID of the task to move',
      },
      targetStatus: {
        type: 'string',
        description: 'The target status column (e.g., "To Do", "In Progress", "Done")',
      },
    },
    required: ['taskId', 'targetStatus'],
  },
  outputs: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
    },
  },
  tags: ['kanban', 'task', 'move', 'status'],
  tool_call_template: {
    call_template_type: 'panel_event',
    event_type: 'industry-theme.kanban-panel:move-task',
  },
};

/**
 * Tool: Select Task
 */
export const selectTaskTool: PanelTool = {
  name: 'select_task',
  description: 'Selects a task to view its details',
  inputs: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'The ID of the task to select',
      },
    },
    required: ['taskId'],
  },
  outputs: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      task: { type: 'object' },
    },
  },
  tags: ['kanban', 'task', 'select', 'view'],
  tool_call_template: {
    call_template_type: 'panel_event',
    event_type: 'industry-theme.kanban-panel:select-task',
  },
};

/**
 * Tool: Refresh Board
 */
export const refreshBoardTool: PanelTool = {
  name: 'refresh_board',
  description: 'Refreshes the kanban board to reload tasks from the backlog',
  inputs: {
    type: 'object',
    properties: {},
  },
  outputs: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
    },
  },
  tags: ['kanban', 'board', 'refresh'],
  tool_call_template: {
    call_template_type: 'panel_event',
    event_type: 'industry-theme.kanban-panel:refresh-board',
  },
};

/**
 * Tool: Filter Tasks
 */
export const filterTasksTool: PanelTool = {
  name: 'filter_tasks',
  description: 'Filters tasks on the kanban board by labels, assignee, or priority',
  inputs: {
    type: 'object',
    properties: {
      labels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by task labels',
      },
      assignee: {
        type: 'string',
        description: 'Filter by assignee name',
      },
      priority: {
        type: 'string',
        description: 'Filter by priority level',
      },
    },
  },
  outputs: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      count: { type: 'number' },
    },
  },
  tags: ['kanban', 'task', 'filter', 'search'],
  tool_call_template: {
    call_template_type: 'panel_event',
    event_type: 'industry-theme.kanban-panel:filter-tasks',
  },
};

/**
 * All tools exported as an array.
 */
export const kanbanPanelTools: PanelTool[] = [
  moveTaskTool,
  selectTaskTool,
  refreshBoardTool,
  filterTasksTool,
];

/**
 * Panel tools metadata for registration with PanelToolRegistry.
 */
export const kanbanPanelToolsMetadata: PanelToolsMetadata = {
  id: 'industry-theme.kanban-panel',
  name: 'Kanban Panel',
  description: 'Tools provided by the backlogmd kanban panel extension',
  tools: kanbanPanelTools,
};
