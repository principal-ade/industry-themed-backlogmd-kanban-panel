import { useState, useCallback, useEffect, useRef } from 'react';
import { Core, type Task } from '@backlog-md/core';
import { PanelFileSystemAdapter } from '../../../adapters/PanelFileSystemAdapter';
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

const DEFAULT_STATUSES = ['To Do', 'In Progress', 'Done'];

/**
 * Hook for managing kanban board data
 * Integrates with Backlog.md via @backlog-md/core
 */
export function useKanbanData(
  options?: UseKanbanDataOptions
): UseKanbanDataResult {
  const { context, actions } = options || {};

  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<string[]>(DEFAULT_STATUSES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBacklogProject, setIsBacklogProject] = useState(false);
  const [tasksByStatus, setTasksByStatus] = useState<Map<string, Task[]>>(
    new Map()
  );

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

  // Load Backlog.md data using Core
  const loadBacklogData = useCallback(async () => {
    if (!context || !actions) {
      console.log('[useKanbanData] No context provided');
      setIsBacklogProject(false);
      setTasks([]);
      setStatuses(DEFAULT_STATUSES);
      setTasksByStatus(new Map());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get fileTree slice
      const fileTreeSlice = context.getRepositorySlice('fileTree') as
        | { data?: { files?: Array<{ path: string }> } }
        | undefined;

      if (!fileTreeSlice?.data?.files) {
        console.log('[useKanbanData] FileTree not available');
        setIsBacklogProject(false);
        setTasks([]);
        setStatuses(DEFAULT_STATUSES);
        setTasksByStatus(new Map());
        return;
      }

      const files = fileTreeSlice.data.files;
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
        return;
      }

      console.log('[useKanbanData] Loading Backlog.md data...');
      setIsBacklogProject(true);

      // Initialize and load data
      await core.initialize();

      const config = core.getConfig();
      const grouped = core.getTasksByStatus();
      const allTasks = core.listTasks();

      console.log(
        `[useKanbanData] Loaded ${allTasks.length} tasks with ${config.statuses.length} statuses`
      );

      setStatuses(config.statuses);
      setTasks(allTasks);
      setTasksByStatus(grouped);
    } catch (err) {
      console.error('[useKanbanData] Failed to load Backlog.md data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load backlog data');
      setIsBacklogProject(false);
      setTasks([]);
      setStatuses(DEFAULT_STATUSES);
      setTasksByStatus(new Map());
    } finally {
      setIsLoading(false);
    }
  }, [context, actions, fetchFileContent]);

  // Load data on mount or when context changes
  useEffect(() => {
    loadBacklogData();
  }, [loadBacklogData]);

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
    refreshData,
    updateTaskStatus,
  };
}
