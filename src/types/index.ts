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
 */
export interface KanbanPanelContext {
  fileTree: DataSlice<FileTree>;
}

/**
 * Typed panel props for KanbanPanel
 */
export type KanbanPanelPropsTyped = CorePanelComponentProps<
  CorePanelActions,
  KanbanPanelContext
>;

/**
 * Typed panel props for TaskDetailPanel
 */
export type TaskDetailPanelPropsTyped = CorePanelComponentProps<
  CorePanelActions,
  KanbanPanelContext
>;
