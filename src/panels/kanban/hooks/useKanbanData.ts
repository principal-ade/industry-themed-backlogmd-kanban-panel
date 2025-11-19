import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Task } from '../backlog-types';
import { createBacklogAdapter, BacklogAdapterError } from '../../../adapters';
import type { PanelContextValue, PanelActions } from '../../../types';

export interface UseKanbanDataResult {
  tasks: Task[];
  statuses: string[];
  isLoading: boolean;
  error: string | null;
  isBacklogProject: boolean;
  tasksByStatus: Map<string, Task[]>;
  refreshData: () => Promise<void>;
  updateTaskStatus: (taskId: string, newStatus: string) => Promise<void>;
}

interface UseKanbanDataOptions {
  context?: PanelContextValue;
  actions?: PanelActions;
}

/**
 * Hook for managing kanban board data
 * Integrates with Backlog.md via the BacklogAdapter
 * Falls back to mock data if no Backlog.md project is detected
 */
export function useKanbanData(options?: UseKanbanDataOptions): UseKanbanDataResult {
  const { context, actions } = options || {};

  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<string[]>(['To Do', 'In Progress', 'Done']);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBacklogProject, setIsBacklogProject] = useState(false);

  // Keep track of active file fetches to avoid duplicate fetches
  const activeFilePathRef = useRef<string | null>(null);

  // Store stable references to context and actions to avoid recreating fetchFileContent
  const contextRef = useRef(context);
  const actionsRef = useRef(actions);

  // Update refs when context/actions change
  useEffect(() => {
    contextRef.current = context;
    actionsRef.current = actions;
  }, [context, actions]);

  // Helper function to fetch file content - memoized without context/actions dependencies
  const fetchFileContent = useCallback(
    async (path: string): Promise<string> => {
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
        // Use panel actions to open the file
        if (currentActions.openFile) {
          const result = await currentActions.openFile(path);
          // If openFile returns content directly (e.g., in mock), use it
          if (typeof result === 'string') {
            return result;
          }
        } else {
          throw new Error('openFile action not available');
        }

        // Otherwise, get the active file data from the slice
        const activeFileSlice = currentContext.getRepositorySlice('active-file');
        const fileData = activeFileSlice?.data as any;

        if (!fileData?.content) {
          throw new Error(`Failed to fetch content for ${path}`);
        }

        return fileData.content;
      } finally {
        activeFilePathRef.current = null;
      }
    },
    [] // No dependencies - uses refs instead
  );

  // Load Backlog.md data
  const loadBacklogData = useCallback(async () => {
    if (!context || !actions) {
      // No context/actions provided
      console.log('[useKanbanData] No context provided');
      setIsBacklogProject(false);
      setTasks([]);
      setStatuses(['To Do', 'In Progress', 'Done']);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get fileTree slice
      const fileTreeSlice = context.getRepositorySlice<any>('fileTree');

      if (!fileTreeSlice?.data) {
        console.log('[useKanbanData] FileTree not available');
        setIsBacklogProject(false);
        setTasks([]);
        setStatuses(['To Do', 'In Progress', 'Done']);
        return;
      }

      const files = fileTreeSlice.data.files || [];
      const filePaths = files.map((f: any) => f.path);

      // Create adapter
      const adapter = createBacklogAdapter({
        fetchFile: fetchFileContent,
        listFiles: () => filePaths,
      });

      // Check if this is a Backlog.md project
      if (!adapter.isBacklogProject()) {
        console.log('[useKanbanData] Not a Backlog.md project');
        setIsBacklogProject(false);
        setTasks([]);
        setStatuses(['To Do', 'In Progress', 'Done']);
        return;
      }

      console.log('[useKanbanData] Loading Backlog.md data...');
      setIsBacklogProject(true);

      // Load data from Backlog.md
      const [loadedStatuses, tasksByStatus] = await Promise.all([
        adapter.getStatuses(),
        adapter.getTasksByStatus(true),
      ]);

      // Flatten tasks from the map
      const allTasks: Task[] = [];
      tasksByStatus.forEach((tasks) => {
        allTasks.push(...tasks);
      });

      console.log(
        `[useKanbanData] Loaded ${allTasks.length} tasks with ${loadedStatuses.length} statuses`
      );

      setStatuses(loadedStatuses);
      setTasks(allTasks);
    } catch (err) {
      console.error('[useKanbanData] Failed to load Backlog.md data:', err);

      if (err instanceof BacklogAdapterError) {
        setError(err.message);
      } else {
        setError(
          err instanceof Error ? err.message : 'Failed to load backlog data'
        );
      }

      // On error, show empty state
      setIsBacklogProject(false);
      setTasks([]);
      setStatuses(['To Do', 'In Progress', 'Done']);
    } finally {
      setIsLoading(false);
    }
  }, [context, actions, fetchFileContent]);

  // Load data on mount or when context changes
  useEffect(() => {
    loadBacklogData();
  }, [loadBacklogData]);

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped = new Map<string, Task[]>();

    // Initialize all status columns
    for (const status of statuses) {
      grouped.set(status, []);
    }

    // Group tasks by status
    for (const task of tasks) {
      const statusKey = task.status ?? '';
      const list = grouped.get(statusKey);
      if (list) {
        list.push(task);
      }
    }

    return grouped;
  }, [tasks, statuses]);

  // Refresh data
  const refreshData = useCallback(async () => {
    await loadBacklogData();
  }, [loadBacklogData]);

  // Update task status
  const updateTaskStatus = useCallback(
    async (taskId: string, newStatus: string) => {
      setError(null);

      // TODO: Implement real Backlog.md file updates
      // This would require:
      // 1. Find the task file
      // 2. Parse the YAML frontmatter
      // 3. Update the status field
      // 4. Write back to the file (via GitHub API)
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
    refreshData,
    updateTaskStatus,
  };
}
