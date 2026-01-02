import { useState, useCallback, useEffect, useRef } from 'react';
import { Core, type Milestone, type Task } from '@backlog-md/core';
import { PanelFileSystemAdapter } from '../../../adapters/PanelFileSystemAdapter';
import type { PanelContextValue, PanelActions } from '../../../types';

/** State for a single milestone with its tasks */
export interface MilestoneState {
  milestone: Milestone;
  tasks: Task[];
  isLoading: boolean;
  isExpanded: boolean;
}

export interface UseMilestoneDataResult {
  milestones: MilestoneState[];
  isLoading: boolean;
  error: string | null;
  isBacklogProject: boolean;
  /** Expand a milestone and load its tasks */
  expandMilestone: (milestoneId: string) => Promise<void>;
  /** Collapse a milestone */
  collapseMilestone: (milestoneId: string) => void;
  /** Toggle milestone expansion */
  toggleMilestone: (milestoneId: string) => Promise<void>;
  /** Refresh all data */
  refreshData: () => Promise<void>;
  /** Whether write operations are available */
  canWrite: boolean;
  /** Core instance for advanced operations */
  core: Core | null;
}

interface UseMilestoneDataOptions {
  context?: PanelContextValue;
  actions?: PanelActions;
}

/**
 * Hook for managing milestone data with lazy task loading
 *
 * Milestones are loaded on init with their task IDs.
 * Task content is only loaded when a milestone is expanded.
 */
export function useMilestoneData(
  options?: UseMilestoneDataOptions
): UseMilestoneDataResult {
  const { context, actions } = options || {};

  const [milestones, setMilestones] = useState<MilestoneState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBacklogProject, setIsBacklogProject] = useState(false);
  const [canWrite, setCanWrite] = useState(false);

  // Keep reference to Core instance for lazy loading and write operations
  const coreRef = useRef<Core | null>(null);

  // Track active file fetches
  const activeFilePathRef = useRef<string | null>(null);

  // Store stable references
  const contextRef = useRef(context);
  const actionsRef = useRef(actions);

  useEffect(() => {
    contextRef.current = context;
    actionsRef.current = actions;
  }, [context, actions]);

  // Helper to fetch file content
  const fetchFileContent = useCallback(async (path: string): Promise<string> => {
    const currentContext = contextRef.current;
    const currentActions = actionsRef.current;

    if (!currentActions || !currentContext) {
      throw new Error('PanelContext not available');
    }

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

  // File tree version tracking
  const fileTreeVersionRef = useRef<string | null>(null);

  // Load milestone data
  const loadMilestoneData = useCallback(async () => {
    if (!context || !actions) {
      console.log('[useMilestoneData] No context provided');
      setIsBacklogProject(false);
      setMilestones([]);
      setIsLoading(false);
      coreRef.current = null;
      fileTreeVersionRef.current = null;
      return;
    }

    const fileTreeSlice = context.getRepositorySlice('fileTree') as
      | { data?: { allFiles?: Array<{ path: string }>; sha?: string; metadata?: { sourceSha?: string } } }
      | undefined;

    if (!fileTreeSlice?.data?.allFiles) {
      console.log('[useMilestoneData] FileTree not available');
      setIsBacklogProject(false);
      setMilestones([]);
      coreRef.current = null;
      fileTreeVersionRef.current = null;
      return;
    }

    const currentVersion = fileTreeSlice.data.sha || fileTreeSlice.data.metadata?.sourceSha || 'unknown';

    if (coreRef.current && fileTreeVersionRef.current === currentVersion) {
      console.log('[useMilestoneData] Data already loaded for this version');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const files = fileTreeSlice.data.allFiles;
      const filePaths = files.map((f: { path: string }) => f.path);

      // Debug: log file paths
      const taskPaths = filePaths.filter((p: string) => p.includes('backlog/tasks/'));
      console.log(`[useMilestoneData] File paths: ${filePaths.length} total, ${taskPaths.length} task files`);
      if (taskPaths.length > 0) {
        console.log(`[useMilestoneData] Sample task paths:`, taskPaths.slice(0, 3));
      }

      // Create FileSystemAdapter with host file system for write operations
      const fs = new PanelFileSystemAdapter({
        fetchFile: fetchFileContent,
        filePaths,
        hostFileSystem: context.adapters?.fileSystem,
      });

      const core = new Core({
        projectRoot: '',
        adapters: { fs },
      });

      const isProject = await core.isBacklogProject();
      if (!isProject) {
        console.log('[useMilestoneData] Not a Backlog.md project');
        setIsBacklogProject(false);
        setMilestones([]);
        coreRef.current = null;
        return;
      }

      console.log('[useMilestoneData] Loading milestone data...');
      setIsBacklogProject(true);
      setCanWrite(fs.canWrite);

      // Initialize Core (need full init to access milestones)
      await core.initializeLazy(filePaths);
      coreRef.current = core;

      // Debug: check what tasks are indexed
      // @ts-expect-error - accessing private property for debugging
      const taskIndex = core.taskIndex as Map<string, unknown>;
      if (taskIndex) {
        const indexedIds = Array.from(taskIndex.keys());
        console.log(`[useMilestoneData] Core taskIndex has ${indexedIds.length} tasks:`, indexedIds.slice(0, 5));
      }

      // Debug: check Core instance
      console.log('[useMilestoneData] Core instance:', core);
      console.log('[useMilestoneData] Core.listMilestones:', typeof core.listMilestones);
      console.log('[useMilestoneData] Core prototype:', Object.getPrototypeOf(core));

      // Defensive check
      if (typeof core.listMilestones !== 'function') {
        console.error('[useMilestoneData] core.listMilestones is not a function!');
        console.error('[useMilestoneData] Core methods:', Object.keys(core));
        console.error('[useMilestoneData] Core prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(core)));
        throw new Error('core.listMilestones is not available - check @backlog-md/core version');
      }

      // Load milestones (this reads milestone files only, not tasks)
      const milestoneList = await core.listMilestones();

      console.log(`[useMilestoneData] Loaded ${milestoneList.length} milestones`);

      // Pre-load all tasks for progress calculation
      const allTaskIds = milestoneList.flatMap((m) => m.tasks);
      const uniqueTaskIds = [...new Set(allTaskIds)];
      console.log(`[useMilestoneData] Milestone task IDs to load:`, uniqueTaskIds.slice(0, 5), `(${uniqueTaskIds.length} total)`);
      let allTasks: Task[] = [];

      if (uniqueTaskIds.length > 0) {
        try {
          allTasks = await core.loadTasksByIds(uniqueTaskIds);
          console.log(`[useMilestoneData] Pre-loaded ${allTasks.length} tasks for progress`);
          if (allTasks.length > 0) {
            console.log(`[useMilestoneData] Sample task IDs:`, allTasks.slice(0, 5).map(t => t.id));
          }
        } catch (err) {
          console.warn('[useMilestoneData] Failed to pre-load tasks:', err);
        }
      }

      // Create a map for quick task lookup
      const taskMap = new Map(allTasks.map((t) => [t.id, t]));

      // Build milestone states with tasks pre-loaded
      const milestoneStates: MilestoneState[] = milestoneList.map((m) => {
        const loadedTasks = m.tasks.map((id) => taskMap.get(id)).filter((t): t is Task => !!t);
        console.log(`[useMilestoneData] Milestone ${m.id}: ${m.tasks.length} task IDs, ${loadedTasks.length} loaded`);
        return {
          milestone: m,
          tasks: loadedTasks,
          isLoading: false,
          isExpanded: false,
        };
      });

      fileTreeVersionRef.current = currentVersion;
      setMilestones(milestoneStates);
    } catch (err) {
      console.error('[useMilestoneData] Failed to load:', err);
      setError(err instanceof Error ? err.message : 'Failed to load milestone data');
      setIsBacklogProject(false);
      setMilestones([]);
      coreRef.current = null;
      fileTreeVersionRef.current = null;
    } finally {
      setIsLoading(false);
    }
  }, [context, actions, fetchFileContent]);

  // Load on mount
  useEffect(() => {
    loadMilestoneData();
  }, [loadMilestoneData]);

  // Expand milestone and load its tasks
  const expandMilestone = useCallback(async (milestoneId: string) => {
    const core = coreRef.current;
    if (!core) {
      console.warn('[useMilestoneData] Core not available');
      return;
    }

    // Find milestone state
    const milestoneState = milestones.find((m) => m.milestone.id === milestoneId);
    if (!milestoneState) {
      console.warn(`[useMilestoneData] Milestone ${milestoneId} not found`);
      return;
    }

    // If already expanded with tasks, just mark as expanded
    if (milestoneState.tasks.length > 0) {
      setMilestones((prev) =>
        prev.map((m) =>
          m.milestone.id === milestoneId ? { ...m, isExpanded: true } : m
        )
      );
      return;
    }

    // Set loading state
    setMilestones((prev) =>
      prev.map((m) =>
        m.milestone.id === milestoneId
          ? { ...m, isLoading: true, isExpanded: true }
          : m
      )
    );

    try {
      // Load tasks by IDs from milestone
      const taskIds = milestoneState.milestone.tasks;
      console.log(`[useMilestoneData] Loading ${taskIds.length} tasks for milestone ${milestoneId}`);

      const tasks = await core.loadTasksByIds(taskIds);

      console.log(`[useMilestoneData] Loaded ${tasks.length} tasks`);

      setMilestones((prev) =>
        prev.map((m) =>
          m.milestone.id === milestoneId
            ? { ...m, tasks, isLoading: false }
            : m
        )
      );
    } catch (err) {
      console.error(`[useMilestoneData] Failed to load tasks for ${milestoneId}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
      setMilestones((prev) =>
        prev.map((m) =>
          m.milestone.id === milestoneId ? { ...m, isLoading: false } : m
        )
      );
    }
  }, [milestones]);

  // Collapse milestone
  const collapseMilestone = useCallback((milestoneId: string) => {
    setMilestones((prev) =>
      prev.map((m) =>
        m.milestone.id === milestoneId ? { ...m, isExpanded: false } : m
      )
    );
  }, []);

  // Toggle milestone
  const toggleMilestone = useCallback(async (milestoneId: string) => {
    const milestoneState = milestones.find((m) => m.milestone.id === milestoneId);
    if (!milestoneState) return;

    if (milestoneState.isExpanded) {
      collapseMilestone(milestoneId);
    } else {
      await expandMilestone(milestoneId);
    }
  }, [milestones, expandMilestone, collapseMilestone]);

  // Refresh
  const refreshData = useCallback(async () => {
    fileTreeVersionRef.current = null;
    await loadMilestoneData();
  }, [loadMilestoneData]);

  return {
    milestones,
    isLoading,
    error,
    isBacklogProject,
    expandMilestone,
    collapseMilestone,
    toggleMilestone,
    refreshData,
    // Write support
    canWrite,
    core: coreRef.current,
  };
}
