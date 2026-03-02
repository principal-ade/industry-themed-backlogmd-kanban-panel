import { useState, useCallback, useEffect, useRef } from 'react';
import { Core, type Milestone, type Task } from '@backlog-md/core';

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
  /** Shared Core instance from useBacklogCore (required) */
  core: Core | null;
}

/**
 * Hook for managing milestone data with lazy task loading
 *
 * Milestones are loaded on init with their task IDs.
 * Task content is only loaded when a milestone is expanded.
 *
 * Requires a shared Core instance from useBacklogCore.
 */
export function useMilestoneData(
  options: UseMilestoneDataOptions
): UseMilestoneDataResult {
  const { core } = options;

  const [milestones, setMilestones] = useState<MilestoneState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track whether we've loaded data for this Core instance
  const loadedCoreRef = useRef<Core | null>(null);

  // Load milestone data using the provided Core
  const loadMilestoneData = useCallback(async () => {
    if (!core) {
      console.log('[useMilestoneData] No Core provided');
      setMilestones([]);
      setIsLoading(false);
      return;
    }

    // Skip if already loaded for this Core instance
    if (loadedCoreRef.current === core) {
      console.log('[useMilestoneData] Already loaded for this Core');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[useMilestoneData] Loading milestone data...');

      // Load milestones
      const milestoneList = await core.listMilestones();
      console.log(`[useMilestoneData] Loaded ${milestoneList.length} milestones`);

      // Pre-load all tasks for progress calculation
      const allTaskIds = milestoneList.flatMap((m) => m.tasks);
      const uniqueTaskIds = [...new Set(allTaskIds)];
      let allTasks: Task[] = [];

      if (uniqueTaskIds.length > 0) {
        try {
          allTasks = await core.loadTasksByIds(uniqueTaskIds);
          console.log(`[useMilestoneData] Pre-loaded ${allTasks.length} tasks for progress`);
        } catch (err) {
          console.warn('[useMilestoneData] Failed to pre-load tasks:', err);
        }
      }

      // Create a map for quick task lookup
      const taskMap = new Map(allTasks.map((t) => [t.id, t]));

      // Build milestone states with tasks pre-loaded
      const milestoneStates: MilestoneState[] = milestoneList.map((m) => {
        const loadedTasks = m.tasks.map((id) => taskMap.get(id)).filter((t): t is Task => !!t);
        return {
          milestone: m,
          tasks: loadedTasks,
          isLoading: false,
          isExpanded: false,
        };
      });

      loadedCoreRef.current = core;
      setMilestones(milestoneStates);
    } catch (err) {
      console.error('[useMilestoneData] Failed to load:', err);
      setError(err instanceof Error ? err.message : 'Failed to load milestone data');
      setMilestones([]);
      loadedCoreRef.current = null;
    } finally {
      setIsLoading(false);
    }
  }, [core]);

  // Load when Core becomes available
  useEffect(() => {
    loadMilestoneData();
  }, [loadMilestoneData]);

  // Expand milestone and load its tasks
  const expandMilestone = useCallback(async (milestoneId: string) => {
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
  }, [core, milestones]);

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
    loadedCoreRef.current = null; // Force reload
    await loadMilestoneData();
  }, [loadMilestoneData]);

  return {
    milestones,
    isLoading,
    error,
    expandMilestone,
    collapseMilestone,
    toggleMilestone,
    refreshData,
  };
}
