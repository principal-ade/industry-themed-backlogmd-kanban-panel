import { useState, useCallback, useEffect, useRef } from 'react';
import { Core } from '@backlog-md/core';
import { PanelFileSystemAdapter } from '../adapters/PanelFileSystemAdapter';
import type { KanbanPanelContext, KanbanPanelActions } from '../types';
import type { PanelContextValue } from '@principal-ade/panel-framework-core';
import { getTracer, SpanStatusCode } from '../telemetry';

export interface UseBacklogCoreResult {
  /** The shared Core instance (null if not initialized) */
  core: Core | null;
  /** Whether the Core is currently initializing */
  isInitializing: boolean;
  /** Whether this is a valid Backlog.md project */
  isBacklogProject: boolean;
  /** Any error that occurred during initialization */
  error: string | null;
  /** Whether write operations are available */
  canWrite: boolean;
  /** Force re-initialization */
  reinitialize: () => Promise<void>;
  /** File paths available in the project */
  filePaths: string[];
}

interface UseBacklogCoreOptions {
  context?: PanelContextValue<KanbanPanelContext>;
  actions?: KanbanPanelActions;
}

/**
 * Hook for creating and managing a shared Core instance.
 *
 * This hook handles:
 * - Creating the PanelFileSystemAdapter
 * - Creating and initializing the Core instance
 * - Tracking initialization state and errors
 *
 * Use this with useKanbanData and useMilestoneData to share a single Core:
 *
 * ```tsx
 * const { core, isInitializing, ... } = useBacklogCore({ context, actions });
 * const kanbanData = useKanbanData({ context, actions, core });
 * const milestoneData = useMilestoneData({ context, actions, core });
 * ```
 */
export function useBacklogCore(options?: UseBacklogCoreOptions): UseBacklogCoreResult {
  const { context, actions } = options || {};

  const [core, setCore] = useState<Core | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isBacklogProject, setIsBacklogProject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [filePaths, setFilePaths] = useState<string[]>([]);

  // Track file tree version to detect changes
  const fileTreeVersionRef = useRef<string | null>(null);

  // Keep stable references
  const contextRef = useRef(context);
  const actionsRef = useRef(actions);

  useEffect(() => {
    contextRef.current = context;
    actionsRef.current = actions;
  }, [context, actions]);

  // Helper to fetch file content
  const fetchFileContent = useCallback(async (path: string): Promise<string> => {
    const currentActions = actionsRef.current;

    if (!currentActions?.readFile) {
      throw new Error('actions.readFile not available');
    }

    return await currentActions.readFile(path);
  }, []);

  // Initialize Core
  const initializeCore = useCallback(async () => {
    const tracer = getTracer();

    // Use startActiveSpan so child spans (core.init) are parented correctly
    return tracer.startActiveSpan('backlog.core.init', async (span) => {
      const startTime = Date.now();

      try {
        span.addEvent('backlog.core.init.started');

        if (!context || !actions) {
          console.log('[useBacklogCore] No context provided');
          setIsBacklogProject(false);
          setCore(null);
          setIsInitializing(false);
          setFilePaths([]);
          span.setAttributes({ 'output.skipped': true, 'output.reason': 'no_context' });
          span.setStatus({ code: SpanStatusCode.OK });
          return;
        }

        const fileTreeSlice = context.fileTree;

        if (!fileTreeSlice?.data?.allFiles) {
          console.log('[useBacklogCore] FileTree not available');
          setIsBacklogProject(false);
          setCore(null);
          setFilePaths([]);
          span.setAttributes({ 'output.skipped': true, 'output.reason': 'no_filetree' });
          span.setStatus({ code: SpanStatusCode.OK });
          return;
        }

        const currentVersion = fileTreeSlice.data.sha || fileTreeSlice.data.metadata?.sourceSha || 'unknown';

        // Skip if already initialized for this version
        if (core && fileTreeVersionRef.current === currentVersion) {
          console.log('[useBacklogCore] Already initialized for this version');
          setIsInitializing(false);
          span.setAttributes({ 'output.skipped': true, 'output.reason': 'already_initialized' });
          span.setStatus({ code: SpanStatusCode.OK });
          return;
        }

        setIsInitializing(true);
        setError(null);

        const files = fileTreeSlice.data.allFiles;
        const paths = files.map((f: { path: string }) => f.path);
        setFilePaths(paths);

        // Create FileSystemAdapter
        const fs = new PanelFileSystemAdapter({
          fetchFile: fetchFileContent,
          filePaths: paths,
          hostFileSystem: {
            writeFile: actions.writeFile,
            createDir: actions.createDir,
            deleteFile: actions.deleteFile,
          },
        });

        // Create Core instance
        const newCore = new Core({
          projectRoot: '',
          adapters: { fs },
        });

        // Check if this is a Backlog.md project
        const isProject = await newCore.isBacklogProject();
        if (!isProject) {
          console.log('[useBacklogCore] Not a Backlog.md project');
          setIsBacklogProject(false);
          setCore(null);
          span.setAttributes({ 'output.isBacklogProject': false });
          span.setStatus({ code: SpanStatusCode.OK });
          return;
        }

        console.log('[useBacklogCore] Initializing Core with lazy loading...');
        setIsBacklogProject(true);
        setCanWrite(fs.canWrite);

        // Initialize with lazy loading - this creates the core.init span as a child
        await newCore.initializeLazy(paths);

        fileTreeVersionRef.current = currentVersion;
        setCore(newCore);

        console.log('[useBacklogCore] Core initialized successfully');

        span.addEvent('backlog.core.init.complete', {
          'duration.ms': Date.now() - startTime,
          'fileCount': paths.length,
        });
        span.setAttributes({
          'output.isBacklogProject': true,
          'output.canWrite': fs.canWrite,
          'duration.ms': Date.now() - startTime,
        });
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (err) {
        console.error('[useBacklogCore] Failed to initialize:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Core';
        setError(errorMessage);
        setIsBacklogProject(false);
        setCore(null);
        fileTreeVersionRef.current = null;

        span.addEvent('backlog.core.init.error', {
          'error.type': err instanceof Error ? err.name : 'Unknown',
          'error.message': errorMessage,
        });
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
      } finally {
        setIsInitializing(false);
        span.end();
      }
    });
  }, [context, actions, core, fetchFileContent]);

  // Initialize on mount or when context changes
  useEffect(() => {
    initializeCore();
  }, [initializeCore]);

  // Reinitialize function for manual refresh
  const reinitialize = useCallback(async () => {
    fileTreeVersionRef.current = null;
    await initializeCore();
  }, [initializeCore]);

  return {
    core,
    isInitializing,
    isBacklogProject,
    error,
    canWrite,
    reinitialize,
    filePaths,
  };
}
