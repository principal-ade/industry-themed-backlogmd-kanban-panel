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

export interface UseKanbanDataResult {
  tasks: Task[];
  statuses: string[];
  isLoading: boolean;
  error: string | null;
  isBacklogProject: boolean;
  tasksByStatus: Map<string, Task[]>;
  /** Per-column pagination state */
  columnStates: Map<string, ColumnState>;
  /** Load more tasks for a specific status column */
  loadMore: (status: string) => Promise<void>;
  refreshData: () => Promise<void>;
  updateTaskStatus: (taskId: string, newStatus: string) => Promise<void>;
}

interface UseKanbanDataOptions {
  context?: PanelContextValue;
  actions?: PanelActions;
  /** Number of tasks to load per column (default: 10) */
  pageSize?: number;
}

const DEFAULT_STATUSES = ['To Do', 'In Progress', 'Done'];
const DEFAULT_PAGE_SIZE = 10;

/**
 * Hook for managing kanban board data with pagination
 * Integrates with Backlog.md via @backlog-md/core
 */
export function useKanbanData(
  options?: UseKanbanDataOptions
): UseKanbanDataResult {
  const { context, actions, pageSize = DEFAULT_PAGE_SIZE } = options || {};

  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<string[]>(DEFAULT_STATUSES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBacklogProject, setIsBacklogProject] = useState(false);
  const [tasksByStatus, setTasksByStatus] = useState<Map<string, Task[]>>(
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

  // Helper function to fetch file content
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

  // Load Backlog.md data using Core with pagination
  const loadBacklogData = useCallback(async () => {
    if (!context || !actions) {
      console.log('[useKanbanData] No context provided');
      setIsBacklogProject(false);
      setTasks([]);
      setStatuses(DEFAULT_STATUSES);
      setTasksByStatus(new Map());
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
        setStatuses(DEFAULT_STATUSES);
        setTasksByStatus(new Map());
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
        setStatuses(DEFAULT_STATUSES);
        setTasksByStatus(new Map());
        setColumnStates(new Map());
        coreRef.current = null;
        return;
      }

      console.log('[useKanbanData] Loading Backlog.md data with pagination...');
      setIsBacklogProject(true);

      // Initialize and load data
      await core.initialize();

      // Store Core reference for loadMore
      coreRef.current = core;

      const config = core.getConfig();

      // Use paginated API - load first page for each column
      const paginatedResult = core.getTasksByStatusPaginated({
        limit: pageSize,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
      });

      // Build tasksByStatus map and columnStates from paginated results
      const newTasksByStatus = new Map<string, Task[]>();
      const newColumnStates = new Map<string, ColumnState>();
      let allTasks: Task[] = [];

      for (const status of paginatedResult.statuses) {
        const columnResult = paginatedResult.byStatus.get(status);
        if (columnResult) {
          newTasksByStatus.set(status, columnResult.items);
          newColumnStates.set(status, {
            tasks: columnResult.items,
            total: columnResult.total,
            hasMore: columnResult.hasMore,
            isLoadingMore: false,
          });
          allTasks = allTasks.concat(columnResult.items);
        } else {
          newTasksByStatus.set(status, []);
          newColumnStates.set(status, {
            tasks: [],
            total: 0,
            hasMore: false,
            isLoadingMore: false,
          });
        }
      }

      const totalTasks = Array.from(paginatedResult.byStatus.values()).reduce(
        (sum, col) => sum + col.total,
        0
      );

      console.log(
        `[useKanbanData] Loaded ${allTasks.length}/${totalTasks} tasks with ${config.statuses.length} statuses (page size: ${pageSize})`
      );

      setStatuses(config.statuses);
      setTasks(allTasks);
      setTasksByStatus(newTasksByStatus);
      setColumnStates(newColumnStates);
    } catch (err) {
      console.error('[useKanbanData] Failed to load Backlog.md data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load backlog data');
      setIsBacklogProject(false);
      setTasks([]);
      setStatuses(DEFAULT_STATUSES);
      setTasksByStatus(new Map());
      setColumnStates(new Map());
      coreRef.current = null;
    } finally {
      setIsLoading(false);
    }
  }, [context, actions, fetchFileContent, pageSize]);

  // Load data on mount or when context changes
  useEffect(() => {
    loadBacklogData();
  }, [loadBacklogData]);

  // Load more tasks for a specific status column
  const loadMore = useCallback(
    async (status: string) => {
      const core = coreRef.current;
      if (!core) {
        console.warn('[useKanbanData] Core not available for loadMore');
        return;
      }

      const currentState = columnStates.get(status);
      if (!currentState || !currentState.hasMore || currentState.isLoadingMore) {
        return;
      }

      // Set loading state for this column
      setColumnStates((prev) => {
        const newStates = new Map(prev);
        const state = newStates.get(status);
        if (state) {
          newStates.set(status, { ...state, isLoadingMore: true });
        }
        return newStates;
      });

      try {
        const currentOffset = currentState.tasks.length;
        const result: PaginatedResult<Task> = core.loadMoreForStatus(
          status,
          currentOffset,
          {
            limit: pageSize,
            sortBy: 'title',
            sortDirection: 'asc',
          }
        );

        console.log(
          `[useKanbanData] Loaded ${result.items.length} more tasks for "${status}" (${currentOffset + result.items.length}/${result.total})`
        );

        // Update column state with new tasks
        setColumnStates((prev) => {
          const newStates = new Map(prev);
          const state = newStates.get(status);
          if (state) {
            const newTasks = [...state.tasks, ...result.items];
            newStates.set(status, {
              tasks: newTasks,
              total: result.total,
              hasMore: result.hasMore,
              isLoadingMore: false,
            });
          }
          return newStates;
        });

        // Update tasksByStatus
        setTasksByStatus((prev) => {
          const newMap = new Map(prev);
          const currentTasks = newMap.get(status) || [];
          newMap.set(status, [...currentTasks, ...result.items]);
          return newMap;
        });

        // Update all tasks
        setTasks((prev) => [...prev, ...result.items]);
      } catch (err) {
        console.error(`[useKanbanData] Failed to load more for "${status}":`, err);
        setError(err instanceof Error ? err.message : 'Failed to load more tasks');

        // Reset loading state
        setColumnStates((prev) => {
          const newStates = new Map(prev);
          const state = newStates.get(status);
          if (state) {
            newStates.set(status, { ...state, isLoadingMore: false });
          }
          return newStates;
        });
      }
    },
    [columnStates, pageSize]
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
    statuses,
    isLoading,
    error,
    isBacklogProject,
    tasksByStatus,
    columnStates,
    loadMore,
    refreshData,
    updateTaskStatus,
  };
}
