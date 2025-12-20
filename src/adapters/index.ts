/**
 * Adapters Module
 *
 * Provides the PanelFileSystemAdapter for integrating @backlog-md/core
 * with the panel framework's file access APIs.
 */

export { PanelFileSystemAdapter, type PanelFileAccess } from './PanelFileSystemAdapter';

// Re-export commonly used types from @backlog-md/core for convenience
export type {
  Task,
  BacklogConfig,
  AcceptanceCriterion,
  FileSystemAdapter,
} from '@backlog-md/core';

export {
  Core,
  parseTaskMarkdown,
  serializeTaskMarkdown,
  parseBacklogConfig,
  serializeBacklogConfig,
  sortTasks,
  groupTasksByStatus,
} from '@backlog-md/core';
