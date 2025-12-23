import { KanbanPanel } from './panels/KanbanPanel';
import { TaskDetailPanel } from './panels/TaskDetailPanel';
import { MilestonePanel } from './panels/MilestonePanel';
import type { PanelDefinition, PanelContextValue } from './types';
import { kanbanPanelTools, kanbanPanelToolsMetadata } from './tools';

/**
 * Export array of panel definitions.
 * This is the required export for panel extensions.
 */
export const panels: PanelDefinition[] = [
  {
    metadata: {
      id: 'principal-ade.kanban-panel',
      name: 'Kanban Board',
      icon: '📋',
      version: '0.1.0',
      author: 'Principal ADE',
      description: 'Kanban board for visualizing Backlog.md tasks',
      slices: ['fileTree'], // Data slices this panel depends on
      tools: kanbanPanelTools,
    },
    component: KanbanPanel,

    // Optional: Called when this specific panel is mounted
    onMount: async (context: PanelContextValue) => {
      // eslint-disable-next-line no-console
      console.log(
        'Kanban Panel mounted',
        context.currentScope.repository?.path
      );
    },

    // Optional: Called when this specific panel is unmounted
    onUnmount: async (_context: PanelContextValue) => {
      // eslint-disable-next-line no-console
      console.log('Kanban Panel unmounting');
    },
  },
  {
    metadata: {
      id: 'principal-ade.task-detail-panel',
      name: 'Task Details',
      icon: '📄',
      version: '0.1.0',
      author: 'Principal ADE',
      description: 'Detailed view of Backlog.md tasks with markdown rendering',
      slices: ['fileTree'], // Data slices this panel depends on
    },
    component: TaskDetailPanel,

    // Optional: Called when this specific panel is mounted
    onMount: async (context: PanelContextValue) => {
      // eslint-disable-next-line no-console
      console.log(
        'Task Detail Panel mounted',
        context.currentScope.repository?.path
      );
    },

    // Optional: Called when this specific panel is unmounted
    onUnmount: async (_context: PanelContextValue) => {
      // eslint-disable-next-line no-console
      console.log('Task Detail Panel unmounting');
    },
  },
  {
    metadata: {
      id: 'principal-ade.milestone-panel',
      name: 'Milestones',
      icon: '🎯',
      version: '0.1.0',
      author: 'Principal ADE',
      description: 'View and manage Backlog.md milestones with progress tracking',
      slices: ['fileTree'],
    },
    component: MilestonePanel,

    onMount: async (context: PanelContextValue) => {
      // eslint-disable-next-line no-console
      console.log(
        'Milestone Panel mounted',
        context.currentScope.repository?.path
      );
    },

    onUnmount: async (_context: PanelContextValue) => {
      // eslint-disable-next-line no-console
      console.log('Milestone Panel unmounting');
    },
  },
];

/**
 * Optional: Called once when the entire package is loaded.
 * Use this for package-level initialization.
 */
export const onPackageLoad = async () => {
  // eslint-disable-next-line no-console
  console.log('Panel package loaded - Kanban Panel Extension');
};

/**
 * Optional: Called once when the package is unloaded.
 * Use this for package-level cleanup.
 */
export const onPackageUnload = async () => {
  // eslint-disable-next-line no-console
  console.log('Panel package unloading - Kanban Panel Extension');
};

/**
 * Export tools for server-safe imports.
 * Use '@industry-theme/backlogmd-kanban-panel/tools' to import without React dependencies.
 */
export {
  kanbanPanelTools,
  kanbanPanelToolsMetadata,
  moveTaskTool,
  selectTaskTool,
  refreshBoardTool,
  filterTasksTool,
} from './tools';
