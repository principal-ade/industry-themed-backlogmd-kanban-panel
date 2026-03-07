import { useState, useCallback, useEffect, useRef } from 'react';
import { Core, type Task, type PaginatedResult, DEFAULT_TASK_STATUSES } from '@backlog-md/core';
import type { KanbanPanelActions, PanelEventEmitter } from '../../../types';
import { getTracer, getActiveSpan, SpanStatusCode, trace, context as otelContext, type Span } from '../../../telemetry';

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
}

interface UseKanbanDataOptions {
  /** Shared Core instance from useBacklogCore (required) */
  core: Core | null;
  /** Actions for file operations */
  actions?: KanbanPanelActions;
  /** Number of tasks to load per page (default: 20) */
  tasksLimit?: number;
  /** Event emitter for panel events */
  events?: PanelEventEmitter;
  /** Parent span for context propagation (e.g., board.session) */
  parentSpan?: Span;
}

const DEFAULT_TASKS_LIMIT = 20;

/**
 * Hook for managing kanban board data with lazy loading
 *
 * Uses 3-column view based on task status: To Do, In Progress, Done.
 * Only loads tasks from the tasks/ directory.
 *
 * Requires a shared Core instance from useBacklogCore.
 */
export function useKanbanData(
  options: UseKanbanDataOptions
): UseKanbanDataResult {
  const {
    core,
    actions,
    tasksLimit = DEFAULT_TASKS_LIMIT,
    events,
    parentSpan,
  } = options;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columnStates, setColumnStates] = useState<Map<StatusColumn, ColumnState>>(
    new Map()
  );
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Track whether we've loaded data for this Core instance
  const loadedCoreRef = useRef<Core | null>(null);

  // Helper to group tasks by status and build column states
  const buildColumnStates = useCallback((allTasks: Task[]): Map<StatusColumn, ColumnState> => {
    const newColumnStates = new Map<StatusColumn, ColumnState>();

    for (const column of STATUS_COLUMNS) {
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

  // Load tasks using the provided Core
  const loadTasks = useCallback(async () => {
    if (!core) {
      console.log('[useKanbanData] No Core provided');
      setTasks([]);
      setColumnStates(new Map());
      setIsLoading(false);
      return;
    }

    // Skip if we already loaded for this Core instance
    if (loadedCoreRef.current === core) {
      console.log('[useKanbanData] Already loaded for this Core');
      setIsLoading(false);
      return;
    }

    const tracer = getTracer();

    // Create span context - if parentSpan exists, make this a child of it
    const parentContext = parentSpan
      ? trace.setSpan(otelContext.active(), parentSpan)
      : otelContext.active();

    return otelContext.with(parentContext, () => tracer.startActiveSpan('kanban.load', async (span) => {
      const startTime = Date.now();
      span.addEvent('kanban.loading', {
        'is.backlog.project': true,
      });

      setIsLoading(true);
      setError(null);

      try {
        console.log('[useKanbanData] Loading tasks...');

        // Load tasks from tasks/ directory
        const paginatedResult = await core.loadMoreForSource('tasks', 0, {
          limit: tasksLimit,
          sortDirection: 'asc',
        });

        const allTasks = paginatedResult.items;
        const total = paginatedResult.total;

        console.log(`[useKanbanData] Loaded ${allTasks.length}/${total} tasks`);

        // Mark this Core as loaded
        loadedCoreRef.current = core;

        // Build column states grouped by status
        const newColumnStates = buildColumnStates(allTasks);

        setTasks(allTasks);
        setColumnStates(newColumnStates);
        setTotalLoaded(allTasks.length);
        setTotalCount(total);
        setHasMore(paginatedResult.hasMore);

        span.addEvent('kanban.loaded', {
          'tasks.count': allTasks.length,
          'columns.count': newColumnStates.size,
          'tasks.total': total,
          'has.more': paginatedResult.hasMore,
        });
        span.setAttributes({
          'output.tasksLoaded': allTasks.length,
          'output.tasksTotal': total,
          'output.hasMore': paginatedResult.hasMore,
          'duration.ms': Date.now() - startTime,
        });
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (err) {
        console.error('[useKanbanData] Failed to load tasks:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load tasks';
        setError(errorMessage);
        setTasks([]);
        setColumnStates(new Map());
        loadedCoreRef.current = null;

        span.addEvent('kanban.load.error', {
          'error.type': err instanceof Error ? err.name : 'Unknown',
          'error.message': errorMessage,
        });
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
      } finally {
        setIsLoading(false);
        span.end();
      }
    }));
  }, [core, tasksLimit, buildColumnStates, parentSpan]);

  // Load data when Core becomes available
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Listen for file write events and refresh when tasks are created/modified
  useEffect(() => {
    if (!events) return;

    const unsubscribe = events.on('file:write-complete', (event: { payload?: { path?: string } }) => {
      const payload = event.payload || {};
      const filePath = payload.path || '';

      if (filePath.includes('backlog/tasks/')) {
        console.log('[useKanbanData] Task file written, refreshing data:', filePath);
        loadedCoreRef.current = null; // Force reload
        loadTasks();
      }
    });

    return unsubscribe;
  }, [events, loadTasks]);

  // Load more tasks (loads next page, then regroups by status)
  const loadMoreTasks = useCallback(async () => {
    if (!core) {
      console.warn('[useKanbanData] Core not available for loadMore');
      return;
    }

    if (!hasMore || isLoadingMore) {
      return;
    }

    const tracer = getTracer();

    setIsLoadingMore(true);

    return tracer.startActiveSpan('kanban.load.more', {
      attributes: {
        'input.offset': totalLoaded,
        'input.limit': tasksLimit,
      },
    }, async (span) => {
      const startTime = Date.now();

      try {
        span.addEvent('kanban.load.more', {
          offset: totalLoaded,
          limit: tasksLimit,
        });

        const result: PaginatedResult<Task> = await core.loadMoreForSource('tasks', totalLoaded, {
          limit: tasksLimit,
          sortDirection: 'asc',
        });

        console.log(
          `[useKanbanData] Loaded ${result.items.length} more tasks (${totalLoaded + result.items.length}/${result.total})`
        );

        const newTasks = [...tasks, ...result.items];
        setTasks(newTasks);
        setTotalLoaded(newTasks.length);
        setTotalCount(result.total);
        setHasMore(result.hasMore);

        const newColumnStates = buildColumnStates(newTasks);
        setColumnStates(newColumnStates);

        span.addEvent('kanban.loaded', {
          'tasks.count': newTasks.length,
          'columns.count': newColumnStates.size,
          'tasks.newlyLoaded': result.items.length,
          'has.more': result.hasMore,
        });
        span.setAttributes({
          'output.tasksLoaded': result.items.length,
          'output.totalTasks': newTasks.length,
          'output.hasMore': result.hasMore,
          'duration.ms': Date.now() - startTime,
        });
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (err) {
        console.error('[useKanbanData] Failed to load more tasks:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load more tasks';
        setError(errorMessage);

        span.addEvent('kanban.load.error', {
          'error.type': err instanceof Error ? err.name : 'Unknown',
          'error.message': errorMessage,
        });
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
      } finally {
        setIsLoadingMore(false);
        span.end();
      }
    });
  }, [core, tasks, hasMore, isLoadingMore, totalLoaded, tasksLimit, buildColumnStates]);

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
    loadedCoreRef.current = null; // Force reload
    await loadTasks();
  }, [loadTasks]);

  // Update task status with persistence
  const updateTaskStatus = useCallback(
    async (taskId: string, newStatus: string) => {
      const activeSpan = getActiveSpan();

      if (!core) {
        console.warn('[useKanbanData] Core not available for updateTaskStatus');
        setError('Cannot update task - backlog not loaded');
        activeSpan?.addEvent('task.save.error', {
          'error.type': 'CoreNotAvailable',
          'error.message': 'Cannot update task - backlog not loaded',
          'task.id': taskId,
        });
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

        activeSpan?.addEvent('task.updated', {
          'task.id': taskId,
          'task.status': newStatus,
          'updated.fields': 'status',
        });

        // Refresh data to reflect changes
        await refreshData();
      } catch (err) {
        console.error('[useKanbanData] Failed to update task status:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to update task';
        setError(errorMessage);

        activeSpan?.addEvent('task.save.error', {
          'error.type': err instanceof Error ? err.name : 'Unknown',
          'error.message': errorMessage,
          'task.id': taskId,
        });
      }
    },
    [core, refreshData]
  );

  // Move task to a new column (optimistic update - no persistence)
  const moveTaskOptimistic = useCallback(
    (taskId: string, toColumn: StatusColumn) => {
      // Column IS the status now (no mapping needed)
      const newStatus = toColumn;
      const activeSpan = getActiveSpan();

      // Update tasks with new status
      setTasks((prev) => {
        const task = prev.find(t => t.id === taskId);
        const fromStatus = task?.status || 'unknown';

        const newTasks = prev.map(t =>
          t.id === taskId ? { ...t, status: newStatus } : t
        );

        // Rebuild column states with updated tasks
        const newColumnStates = buildColumnStates(newTasks);
        setColumnStates(newColumnStates);

        console.log(`[useKanbanData] Moved task ${taskId} to ${toColumn} (${newStatus})`);

        // Emit task moved event
        activeSpan?.addEvent('task.moved', {
          'task.id': taskId,
          'from.status': fromStatus,
          'to.status': newStatus,
        });

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
  };
}
