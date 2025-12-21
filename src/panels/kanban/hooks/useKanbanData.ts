import { useState, useCallback, useEffect, useRef } from 'react';
import { Core, type Task, type PaginatedResult } from '@backlog-md/core';
import { PanelFileSystemAdapter } from '../../../adapters/PanelFileSystemAdapter';
import type { PanelContextValue, PanelActions } from '../../../types';

/** Per-column pagination state */
export interface ColumnState {
  tasks: Task[];
  total: number;
  hasMore: boolean;
  isLoadingMore: boolean;
}

/** Source column names (directory-based) */
export type SourceColumn = 'tasks' | 'completed';

/** Display labels for source columns */
export const SOURCE_DISPLAY_LABELS: Record<SourceColumn, string> = {
  tasks: 'Active',
  completed: 'Completed',
};

export interface UseKanbanDataResult {
  tasks: Task[];
  /** Source columns: "tasks" and "completed" */
  sources: SourceColumn[];
  isLoading: boolean;
  error: string | null;
  isBacklogProject: boolean;
  tasksBySource: Map<string, Task[]>;
  /** Per-column pagination state */
  columnStates: Map<string, ColumnState>;
  /** Load more tasks for a specific source column */
  loadMore: (source: SourceColumn) => Promise<void>;
  refreshData: () => Promise<void>;
  updateTaskStatus: (taskId: string, newStatus: string) => Promise<void>;
}

interface UseKanbanDataOptions {
  context?: PanelContextValue;
  actions?: PanelActions;
  /** Number of active tasks to load (default: 20) */
  tasksLimit?: number;
  /** Number of completed tasks to load (default: 5) */
  completedLimit?: number;
}

const DEFAULT_SOURCES: SourceColumn[] = ['tasks', 'completed'];
const DEFAULT_TASKS_LIMIT = 20;
const DEFAULT_COMPLETED_LIMIT = 5;

/**
 * Hook for managing kanban board data with lazy loading
 *
 * Uses 2-column view (Active/Completed) based on directory structure.
 * Only loads task content for displayed items (no file reads on init).
 * Completed tasks are sorted by ID descending (most recent first).
 */
export function useKanbanData(
  options?: UseKanbanDataOptions
): UseKanbanDataResult {
  const {
    context,
    actions,
    tasksLimit = DEFAULT_TASKS_LIMIT,
    completedLimit = DEFAULT_COMPLETED_LIMIT,
  } = options || {};

  const [tasks, setTasks] = useState<Task[]>([]);
  const [sources] = useState<SourceColumn[]>(DEFAULT_SOURCES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBacklogProject, setIsBacklogProject] = useState(false);
  const [tasksBySource, setTasksBySource] = useState<Map<string, Task[]>>(
    new Map()
  );
  const [columnStates, setColumnStates] = useState<Map<string, ColumnState>>(
    new Map()
  );

  // Keep reference to Core instance for loadMore
  const coreRef = useRef<Core | null>(null);

  // Keep track of active file fetches to avoid duplicate fetches
  const activeFilePathRef = useRef<string | null>(null);

  // Store stable references to context and actions
  const contextRef = useRef(context);
  const actionsRef = useRef(actions);

  useEffect(() => {
    contextRef.current = context;
    actionsRef.current = actions;
  }, [context, actions]);

  // Helper function to fetch file content (used for on-demand loading)
  const fetchFileContent = useCallback(async (path: string): Promise<string> => {
    const currentContext = contextRef.current;
    const currentActions = actionsRef.current;

    if (!currentActions || !currentContext) {
      throw new Error('PanelContext not available');
    }

    // Avoid duplicate fetches for the same file
    if (activeFilePathRef.current === path) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    activeFilePathRef.current = path;

    try {
      if (currentActions.openFile) {
        const result = await currentActions.openFile(path);
        if (typeof result === 'string') {
          return result;
        }
      } else {
        throw new Error('openFile action not available');
      }

      // Get the active file data from the slice
      const activeFileSlice = currentContext.getRepositorySlice('active-file');
      const fileData = activeFileSlice?.data as { content?: string };

      if (!fileData?.content) {
        throw new Error(`Failed to fetch content for ${path}`);
      }

      return fileData.content;
    } finally {
      activeFilePathRef.current = null;
    }
  }, []);

  // Load Backlog.md data using Core with lazy loading
  const loadBacklogData = useCallback(async () => {
    if (!context || !actions) {
      console.log('[useKanbanData] No context provided');
      setIsBacklogProject(false);
      setTasks([]);
      setTasksBySource(new Map());
      setColumnStates(new Map());
      setIsLoading(false);
      coreRef.current = null;
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get fileTree slice - FileTree uses allFiles (not files)
      const fileTreeSlice = context.getRepositorySlice('fileTree') as
        | { data?: { allFiles?: Array<{ path: string }> } }
        | undefined;

      if (!fileTreeSlice?.data?.allFiles) {
        console.log('[useKanbanData] FileTree not available');
        setIsBacklogProject(false);
        setTasks([]);
        setTasksBySource(new Map());
        setColumnStates(new Map());
        coreRef.current = null;
        return;
      }

      const files = fileTreeSlice.data.allFiles;
      const filePaths = files.map((f: { path: string }) => f.path);

      // Create FileSystemAdapter for the panel
      const fs = new PanelFileSystemAdapter({
        fetchFile: fetchFileContent,
        filePaths,
      });

      // Create Core instance
      const core = new Core({
        projectRoot: '',
        adapters: { fs },
      });

      // Check if this is a Backlog.md project
      const isProject = await core.isBacklogProject();
      if (!isProject) {
        console.log('[useKanbanData] Not a Backlog.md project');
        setIsBacklogProject(false);
        setTasks([]);
        setTasksBySource(new Map());
        setColumnStates(new Map());
        coreRef.current = null;
        return;
      }

      console.log('[useKanbanData] Loading Backlog.md data with lazy loading...');
      setIsBacklogProject(true);

      // Initialize with lazy loading - only reads config, builds index from paths
      await core.initializeLazy(filePaths);

      // Store Core reference for loadMore
      coreRef.current = core;

      // Use lazy paginated API - only loads task content for first page
      // Active: sorted by title, Completed: sorted by ID desc (most recent)
      const paginatedResult = await core.getTasksBySourcePaginated({
        tasksLimit,
        completedLimit,
        offset: 0,
        tasksSortDirection: 'asc',
        completedSortByIdDesc: true,
      });

      // Build tasksBySource map and columnStates from paginated results
      const newTasksBySource = new Map<string, Task[]>();
      const newColumnStates = new Map<string, ColumnState>();
      let allTasks: Task[] = [];

      for (const source of paginatedResult.sources) {
        const columnResult = paginatedResult.bySource.get(source);
        if (columnResult) {
          newTasksBySource.set(source, columnResult.items);
          newColumnStates.set(source, {
            tasks: columnResult.items,
            total: columnResult.total,
            hasMore: columnResult.hasMore,
            isLoadingMore: false,
          });
          allTasks = allTasks.concat(columnResult.items);
        } else {
          newTasksBySource.set(source, []);
          newColumnStates.set(source, {
            tasks: [],
            total: 0,
            hasMore: false,
            isLoadingMore: false,
          });
        }
      }

      const totalTasks = Array.from(paginatedResult.bySource.values()).reduce(
        (sum, col) => sum + col.total,
        0
      );

      console.log(
        `[useKanbanData] Loaded ${allTasks.length}/${totalTasks} tasks (active: ${tasksLimit}, completed: ${completedLimit})`
      );

      setTasks(allTasks);
      setTasksBySource(newTasksBySource);
      setColumnStates(newColumnStates);
    } catch (err) {
      console.error('[useKanbanData] Failed to load Backlog.md data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load backlog data');
      setIsBacklogProject(false);
      setTasks([]);
      setTasksBySource(new Map());
      setColumnStates(new Map());
      coreRef.current = null;
    } finally {
      setIsLoading(false);
    }
  }, [context, actions, fetchFileContent, tasksLimit, completedLimit]);

  // Load data on mount or when context changes
  useEffect(() => {
    loadBacklogData();
  }, [loadBacklogData]);

  // Load more tasks for a specific source column
  const loadMore = useCallback(
    async (source: SourceColumn) => {
      const core = coreRef.current;
      if (!core) {
        console.warn('[useKanbanData] Core not available for loadMore');
        return;
      }

      const currentState = columnStates.get(source);
      if (!currentState || !currentState.hasMore || currentState.isLoadingMore) {
        return;
      }

      // Set loading state for this column
      setColumnStates((prev) => {
        const newStates = new Map(prev);
        const state = newStates.get(source);
        if (state) {
          newStates.set(source, { ...state, isLoadingMore: true });
        }
        return newStates;
      });

      try {
        const currentOffset = currentState.tasks.length;
        const limit = source === 'tasks' ? tasksLimit : completedLimit;
        const result: PaginatedResult<Task> = await core.loadMoreForSource(
          source,
          currentOffset,
          {
            limit,
            sortDirection: 'asc',
            completedSortByIdDesc: source === 'completed',
          }
        );

        console.log(
          `[useKanbanData] Loaded ${result.items.length} more tasks for "${source}" (${currentOffset + result.items.length}/${result.total})`
        );

        // Update column state with new tasks
        setColumnStates((prev) => {
          const newStates = new Map(prev);
          const state = newStates.get(source);
          if (state) {
            const newTasks = [...state.tasks, ...result.items];
            newStates.set(source, {
              tasks: newTasks,
              total: result.total,
              hasMore: result.hasMore,
              isLoadingMore: false,
            });
          }
          return newStates;
        });

        // Update tasksBySource
        setTasksBySource((prev) => {
          const newMap = new Map(prev);
          const currentTasks = newMap.get(source) || [];
          newMap.set(source, [...currentTasks, ...result.items]);
          return newMap;
        });

        // Update all tasks
        setTasks((prev) => [...prev, ...result.items]);
      } catch (err) {
        console.error(`[useKanbanData] Failed to load more for "${source}":`, err);
        setError(err instanceof Error ? err.message : 'Failed to load more tasks');

        // Reset loading state
        setColumnStates((prev) => {
          const newStates = new Map(prev);
          const state = newStates.get(source);
          if (state) {
            newStates.set(source, { ...state, isLoadingMore: false });
          }
          return newStates;
        });
      }
    },
    [columnStates, tasksLimit, completedLimit]
  );

  // Refresh data
  const refreshData = useCallback(async () => {
    await loadBacklogData();
  }, [loadBacklogData]);

  // Update task status (not yet implemented)
  const updateTaskStatus = useCallback(
    async (_taskId: string, _newStatus: string) => {
      setError(null);
      console.warn(
        '[useKanbanData] Task status updates not yet implemented for Backlog.md'
      );
      setError('Task editing is not yet supported');
    },
    []
  );

  return {
    tasks,
    sources,
    isLoading,
    error,
    isBacklogProject,
    tasksBySource,
    columnStates,
    loadMore,
    refreshData,
    updateTaskStatus,
  };
}
