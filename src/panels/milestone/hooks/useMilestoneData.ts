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

  // Keep reference to Core instance for lazy loading
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
      if (currentActions.openFile) {
        const result = await currentActions.openFile(path);
        if (typeof result === 'string') {
          return result;
        }
      } else {
        throw new Error('openFile action not available');
      }

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

      const fs = new PanelFileSystemAdapter({
        fetchFile: fetchFileContent,
        filePaths,
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

      // Initialize Core (need full init to access milestones)
      await core.initializeLazy(filePaths);
      coreRef.current = core;

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

      // Build milestone states (tasks not loaded yet)
      const milestoneStates: MilestoneState[] = milestoneList.map((m) => ({
        milestone: m,
        tasks: [],
        isLoading: false,
        isExpanded: false,
      }));

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
  };
}
