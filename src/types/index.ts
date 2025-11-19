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
