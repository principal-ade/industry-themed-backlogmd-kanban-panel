/**
 * Panel Extension Type Definitions
 *
 * Re-exports core types from @principal-ade/panel-framework-core
 */

// Re-export all core types from panel-framework-core
export type {
  // Core data types
  DataSlice,
  WorkspaceMetadata,
  RepositoryMetadata,
  FileTreeSource,
  ActiveFileSlice,

  // Event system
  PanelEventType,
  PanelEvent,
  PanelEventEmitter,

  // Panel interface
  PanelActions,
  PanelContextValue,
  PanelComponentProps,

  // Panel definition
  PanelMetadata,
  PanelLifecycleHooks,
  PanelDefinition,
  PanelModule,

  // Registry types
  PanelRegistryEntry,
  PanelLoader,
  PanelRegistryConfig,
} from '@principal-ade/panel-framework-core';

import type {
  PanelActions as CorePanelActions,
  PanelComponentProps as CorePanelComponentProps,
  DataSlice,
} from '@principal-ade/panel-framework-core';

// Re-export FileTree type
export type { FileTree } from '@principal-ai/repository-abstraction';
import type { FileTree } from '@principal-ai/repository-abstraction';

// ============================================================================
// Typed Panel Interfaces (v0.4.2+)
// ============================================================================

/**
 * Typed context for KanbanPanel and TaskDetailPanel
 * Both panels use fileTree slice
 *
 * Note: context is for READ-ONLY data access (slices, metadata).
 * For file operations, use actions instead.
 */
export interface KanbanPanelContext {
  fileTree: DataSlice<FileTree>;
}

/**
 * Extended panel actions with file system operations.
 *
 * Design principle: `actions` is for all panel-initiated operations:
 * - File operations (read, write, delete, createDir)
 * - Host commands (openFile, openGitDiff, navigateToPanel)
 *
 * `context` is for READ-ONLY data access (slices, scope metadata).
 * `events` is for peer-to-peer panel communication (pub/sub).
 */
export interface KanbanPanelActions extends CorePanelActions {
  // File system operations
  /** Read file contents */
  readFile?: (path: string) => Promise<string>;
  /** Write content to file */
  writeFile?: (path: string, content: string) => Promise<void>;
  /** Delete a file */
  deleteFile?: (path: string) => Promise<void>;
  /** Create a directory */
  createDir?: (path: string) => Promise<void>;
  /** Check if a file exists */
  exists?: (path: string) => Promise<boolean>;
}

/**
 * Typed panel props for KanbanPanel
 */
export type KanbanPanelPropsTyped = CorePanelComponentProps<
  KanbanPanelActions,
  KanbanPanelContext
>;

/**
 * Typed panel props for TaskDetailPanel
 */
export type TaskDetailPanelPropsTyped = CorePanelComponentProps<
  KanbanPanelActions,
  KanbanPanelContext
>;
