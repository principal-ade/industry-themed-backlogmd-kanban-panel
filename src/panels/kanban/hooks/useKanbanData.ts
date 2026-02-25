import { useState, useCallback, useEffect, useRef } from 'react';
import { Core, type Task, type PaginatedResult, DEFAULT_TASK_STATUSES } from '@backlog-md/core';
import { PanelFileSystemAdapter } from '../../../adapters/PanelFileSystemAdapter';
import type { KanbanPanelContext, PanelActions } from '../../../types';
import type { PanelContextValue } from '@principal-ade/panel-framework-core';

/** Per-column pagination state */
export interface ColumnState {
  tasks: Task[];
  total: number;
  hasMore: boolean;
  isLoadingMore: boolean;
}

/**
 * Status column identifiers - now using actual status values directly
 * This eliminates the need for status-to-column mapping
 */
export type StatusColumn = typeof DEFAULT_TASK_STATUSES[keyof typeof DEFAULT_TASK_STATUSES];

/** All status columns in order for rendering */
export const STATUS_COLUMNS: StatusColumn[] = [
  DEFAULT_TASK_STATUSES.TODO,
  DEFAULT_TASK_STATUSES.IN_PROGRESS,
  DEFAULT_TASK_STATUSES.DONE,
];

/** Status-based column state (computed from source data) */
export interface StatusColumnState {
  tasks: Task[];
  count: number;
}

/** Active tasks pagination state */
export interface ActiveTasksState {
  total: number;
  loaded: number;
  hasMore: boolean;
  isLoadingMore: boolean;
}

export interface UseKanbanDataResult {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  isBacklogProject: boolean;
  /** Per-status column pagination state */
  columnStates: Map<StatusColumn, ColumnState>;
  /** Load more tasks for a specific status column */
  loadMore: (status: StatusColumn) => Promise<void>;
  refreshData: () => Promise<void>;
  updateTaskStatus: (taskId: string, newStatus: string) => Promise<void>;
  /** Status columns: To Do, In Progress, Done */
  statusColumns: StatusColumn[];
  /** Tasks grouped by status (To Do, In Progress, Done) */
  tasksByStatus: Map<StatusColumn, StatusColumnState>;
  /** Total tasks pagination state */
  totalTasksState: ActiveTasksState;
  /** Load more tasks */
  loadMoreTasks: () => Promise<void>;
  /** Move task to a new status column (optimistic update - no persistence) */
  moveTaskOptimistic: (taskId: string, toColumn: StatusColumn) => void;
  /** Find a task by ID */
  getTaskById: (taskId: string) => Task | undefined;
  /** Whether write operations are available */
  canWrite: boolean;
  /** Core instance for advanced operations (create/update tasks) */
  core: Core | null;
}

interface UseKanbanDataOptions {
  context?: PanelContextValue<KanbanPanelContext>;
  actions?: PanelActions;
  /** Number of tasks to load per page (default: 20) */
  tasksLimit?: number;
  /** Event emitter for panel events */
  events?: any;
}

const DEFAULT_TASKS_LIMIT = 20;

/**
 * Hook for managing kanban board data with lazy loading
 *
 * Uses 3-column view based on task status: To Do, In Progress, Done.
 * Only loads tasks from the tasks/ directory.
 */
export function useKanbanData(
  options?: UseKanbanDataOptions
): UseKanbanDataResult {
  const {
    context,
    actions,
    tasksLimit = DEFAULT_TASKS_LIMIT,
    events,
  } = options || {};

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBacklogProject, setIsBacklogProject] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [columnStates, setColumnStates] = useState<Map<StatusColumn, ColumnState>>(
    new Map()
  );
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Keep reference to Core instance for loadMore and write operations
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
      // Use adapters.readFile (the canonical way to read file content)
      if (currentContext.adapters?.readFile) {
        return await currentContext.adapters.readFile(path);
      }

      throw new Error('No file reading capability available (adapters.readFile not configured)');
    } finally {
      activeFilePathRef.current = null;
    }
  }, []);

  // Track the file tree version to detect when we need to reload
  const fileTreeVersionRef = useRef<string | null>(null);

  // Helper to group tasks by status and build column states
  const buildColumnStates = useCallback((allTasks: Task[]): Map<StatusColumn, ColumnState> => {
    const newColumnStates = new Map<StatusColumn, ColumnState>();

    for (const column of STATUS_COLUMNS) {
      // Column IS the status now (no mapping needed)
      const columnTasks = allTasks.filter(t => t.status === column);
      newColumnStates.set(column, {
        tasks: columnTasks,
        total: columnTasks.length,
        hasMore: false,
        isLoadingMore: false,
      });
    }

    return newColumnStates;
  }, []);

  // Load Backlog.md data using Core with lazy loading
  const loadBacklogData = useCallback(async () => {
    if (!context || !actions) {
      console.log('[useKanbanData] No context provided');
      setIsBacklogProject(false);
      setTasks([]);
      setColumnStates(new Map());
      setIsLoading(false);
      coreRef.current = null;
      fileTreeVersionRef.current = null;
      return;
    }

    // Get fileTree slice from typed context (direct property access)
    const fileTreeSlice = context.fileTree;

    if (!fileTreeSlice?.data?.allFiles) {
      console.log('[useKanbanData] FileTree not available');
      setIsBacklogProject(false);
      setTasks([]);
      setColumnStates(new Map());
      coreRef.current = null;
      fileTreeVersionRef.current = null;
      return;
    }

    // Get file tree version (SHA) to detect changes
    const currentVersion = fileTreeSlice.data.sha || fileTreeSlice.data.metadata?.sourceSha || 'unknown';

    // Skip if we already have data for this file tree version
    // Use ref to track version to avoid triggering reloads when context changes for unrelated reasons
    if (coreRef.current && fileTreeVersionRef.current === currentVersion) {
      console.log('[useKanbanData] Data already loaded for this file tree version, skipping');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const files = fileTreeSlice.data.allFiles;
      const filePaths = files.map((f: { path: string }) => f.path);

      // Create FileSystemAdapter for the panel
      // Pass host file system for write operations (if available)
      const fs = new PanelFileSystemAdapter({
        fetchFile: fetchFileContent,
        filePaths,
        hostFileSystem: context.adapters?.fileSystem,
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
        setColumnStates(new Map());
        coreRef.current = null;
        return;
      }

      console.log('[useKanbanData] Loading Backlog.md data with lazy loading...');
      setIsBacklogProject(true);
      setCanWrite(fs.canWrite);

      // Initialize with lazy loading - only reads config, builds index from paths
      await core.initializeLazy(filePaths);

      // Store Core reference for loadMore
      coreRef.current = core;

      // Load tasks from tasks/ directory only (using lazy loading API)
      // loadMoreForSource loads tasks on-demand from the index
      const paginatedResult = await core.loadMoreForSource('tasks', 0, {
        limit: tasksLimit,
        sortDirection: 'asc',
      });

      const allTasks = paginatedResult.items;
      const total = paginatedResult.total;

      console.log(
        `[useKanbanData] Loaded ${allTasks.length}/${total} tasks`
      );

      // Diagnostic: Log first task to see what fields are being parsed
      if (allTasks.length > 0) {
        console.log('[useKanbanData] First task sample:', {
          id: allTasks[0].id,
          title: allTasks[0].title,
          status: allTasks[0].status,
          description: allTasks[0].description,
          filePath: allTasks[0].filePath,
        });
      }

      // Store the file tree version to prevent redundant reloads
      fileTreeVersionRef.current = currentVersion;

      // Build column states grouped by status
      const newColumnStates = buildColumnStates(allTasks);

      setTasks(allTasks);
      setColumnStates(newColumnStates);
      setTotalLoaded(allTasks.length);
      setTotalCount(total);
      setHasMore(paginatedResult.hasMore);
    } catch (err) {
      console.error('[useKanbanData] Failed to load Backlog.md data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load backlog data');
      setIsBacklogProject(false);
      setTasks([]);
      setColumnStates(new Map());
      coreRef.current = null;
      fileTreeVersionRef.current = null;
    } finally {
      setIsLoading(false);
    }
  }, [context, actions, fetchFileContent, tasksLimit, buildColumnStates]);

  // Load data on mount or when context changes
  useEffect(() => {
    loadBacklogData();
  }, [loadBacklogData]);

  // Listen for file write events and refresh when tasks are created/modified
  useEffect(() => {
    if (!events) return;

    const unsubscribe = events.on('file:write-complete', (event: any) => {
      const payload = event.payload || {};
      const filePath = payload.path || '';

      // Check if the written file is a task file
      if (filePath.includes('backlog/tasks/')) {
        console.log('[useKanbanData] Task file written, refreshing data:', filePath);
        // Reset file tree version to force reload
        fileTreeVersionRef.current = null;
        loadBacklogData();
      }
    });

    return unsubscribe;
  }, [events, loadBacklogData]);

  // Load more tasks (loads next page, then regroups by status)
  const loadMoreTasks = useCallback(async () => {
    const core = coreRef.current;
    if (!core) {
      console.warn('[useKanbanData] Core not available for loadMore');
      return;
    }

    if (!hasMore || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      // Use lazy loading API - loadMoreForSource loads tasks on-demand
      const result: PaginatedResult<Task> = await core.loadMoreForSource('tasks', totalLoaded, {
        limit: tasksLimit,
        sortDirection: 'asc',
      });

      console.log(
        `[useKanbanData] Loaded ${result.items.length} more tasks (${totalLoaded + result.items.length}/${result.total})`
      );

      // Update all tasks
      const newTasks = [...tasks, ...result.items];
      setTasks(newTasks);
      setTotalLoaded(newTasks.length);
      setTotalCount(result.total);
      setHasMore(result.hasMore);

      // Rebuild column states with all tasks
      const newColumnStates = buildColumnStates(newTasks);
      setColumnStates(newColumnStates);
    } catch (err) {
      console.error('[useKanbanData] Failed to load more tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more tasks');
    } finally {
      setIsLoadingMore(false);
    }
  }, [tasks, hasMore, isLoadingMore, totalLoaded, tasksLimit, buildColumnStates]);

  // Load more is now just loadMoreTasks (no per-column loading needed)
  const loadMore = useCallback(
    async (_status: StatusColumn) => {
      // Status columns don't have separate pagination - load more tasks overall
      await loadMoreTasks();
    },
    [loadMoreTasks]
  );

  // Refresh data
  const refreshData = useCallback(async () => {
    await loadBacklogData();
  }, [loadBacklogData]);

  // Update task status with persistence
  const updateTaskStatus = useCallback(
    async (taskId: string, newStatus: string) => {
      const core = coreRef.current;
      if (!core) {
        console.warn('[useKanbanData] Core not available for updateTaskStatus');
        setError('Cannot update task - backlog not loaded');
        return;
      }

      setError(null);

      try {
        console.log(`[useKanbanData] Updating task ${taskId} status to "${newStatus}"`);
        const updatedTask = await core.updateTask(taskId, { status: newStatus });

        if (!updatedTask) {
          throw new Error(`Task ${taskId} not found`);
        }

        console.log(`[useKanbanData] Task ${taskId} updated successfully`);

        // Refresh data to reflect changes
        await loadBacklogData();
      } catch (err) {
        console.error('[useKanbanData] Failed to update task status:', err);
        setError(err instanceof Error ? err.message : 'Failed to update task');
      }
    },
    [loadBacklogData]
  );

  // Move task to a new column (optimistic update - no persistence)
  const moveTaskOptimistic = useCallback(
    (taskId: string, toColumn: StatusColumn) => {
      // Column IS the status now (no mapping needed)
      const newStatus = toColumn;

      // Update tasks with new status
      setTasks((prev) => {
        const newTasks = prev.map(t =>
          t.id === taskId ? { ...t, status: newStatus } : t
        );

        // Rebuild column states with updated tasks
        const newColumnStates = buildColumnStates(newTasks);
        setColumnStates(newColumnStates);

        console.log(`[useKanbanData] Moved task ${taskId} to ${toColumn} (${newStatus})`);

        return newTasks;
      });
    },
    [buildColumnStates]
  );

  // Find a task by ID
  const getTaskById = useCallback(
    (taskId: string): Task | undefined => {
      return tasks.find(t => t.id === taskId);
    },
    [tasks]
  );

  // Status columns for 3-column view (use constant array)
  const statusColumns = STATUS_COLUMNS;

  // Compute tasks grouped by status from columnStates
  const tasksByStatus = (() => {
    const result = new Map<StatusColumn, StatusColumnState>();

    for (const column of statusColumns) {
      const state = columnStates.get(column);
      result.set(column, {
        tasks: state?.tasks || [],
        count: state?.total || 0,
      });
    }

    return result;
  })();

  // Total tasks pagination state
  const totalTasksState: ActiveTasksState = {
    total: totalCount,
    loaded: totalLoaded,
    hasMore,
    isLoadingMore,
  };

  return {
    tasks,
    isLoading,
    error,
    isBacklogProject,
    columnStates,
    loadMore,
    refreshData,
    updateTaskStatus,
    statusColumns,
    tasksByStatus,
    totalTasksState,
    loadMoreTasks,
    moveTaskOptimistic,
    getTaskById,
    canWrite,
    core: coreRef.current,
  };
}
