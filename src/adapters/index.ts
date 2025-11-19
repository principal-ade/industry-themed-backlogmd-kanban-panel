/**
 * Backlog.md Adapter Module
 *
 * Exports all adapter-related types and utilities.
 */

export { BacklogAdapter, createBacklogAdapter } from './BacklogAdapter';
export type {
  FileAccessFunctions,
  IBacklogAdapter,
  BacklogConfig,
  Task,
  TaskMetadata,
  AcceptanceCriterion,
} from './types';
export { BacklogAdapterError } from './types';
export {
  parseYaml,
  parseBacklogConfig,
  parseTaskFile,
  sortTasks,
} from './backlog-parser';
