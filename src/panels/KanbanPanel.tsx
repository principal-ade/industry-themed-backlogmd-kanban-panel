import React, { useState, useCallback } from 'react';
import { Kanban, AlertCircle } from 'lucide-react';
import { ThemeProvider, useTheme } from '@principal-ade/industry-theme';
import type { PanelComponentProps } from '../types';
import { useKanbanData, SOURCE_DISPLAY_LABELS, type SourceColumn } from './kanban/hooks/useKanbanData';
import { KanbanColumn } from './kanban/components/KanbanColumn';
import { EmptyState } from './kanban/components/EmptyState';
import { Core, type Task } from '@backlog-md/core';

/**
 * KanbanPanelContent - Internal component that uses theme
 */
const KanbanPanelContent: React.FC<PanelComponentProps> = ({
  context,
  actions,
}) => {
  const { theme } = useTheme();
  const [_selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { sources, tasksBySource, columnStates, loadMore, error, isBacklogProject, refreshData } = useKanbanData({
    context,
    actions,
    tasksLimit: 20,
    completedLimit: 5,
  });

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    // In the future, this will open a task detail modal
    // Task click logged for development
  };

  // Check if we can initialize (need file system adapter with write capability)
  const fileSystem = context.adapters?.fileSystem;
  const canInitialize = Boolean(
    fileSystem?.writeFile && fileSystem?.createDir && context.currentScope.repository?.path
  );

  // Initialize Backlog.md project
  const handleInitialize = useCallback(async () => {
    if (!fileSystem?.writeFile || !fileSystem?.createDir) {
      throw new Error('File system adapter not available');
    }

    const repoPath = context.currentScope.repository?.path;
    if (!repoPath) {
      throw new Error('Repository path not available');
    }

    // Create a minimal adapter for Core that wraps the panel's fileSystem
    // Only the methods used by initProject need real implementations
    const notImplemented = () => { throw new Error('Not implemented'); };
    const fsAdapter = {
      // Used by initProject
      exists: async (path: string) => {
        try {
          await fileSystem.readFile(path);
          return true;
        } catch {
          return false;
        }
      },
      writeFile: async (path: string, content: string) => { await fileSystem.writeFile(path, content); },
      createDir: async (path: string, _options?: { recursive?: boolean }) => { await fileSystem.createDir!(path); },
      join: (...paths: string[]) => paths.join('/').replace(/\/+/g, '/'),
      // Not used by initProject - stubs
      readFile: async (path: string) => fileSystem.readFile(path) as Promise<string>,
      deleteFile: async () => notImplemented(),
      readDir: async () => [] as string[],
      isDirectory: async () => false,
      rename: async () => notImplemented(),
      stat: async () => ({ mtime: new Date(), isDirectory: false, size: 0 }),
      dirname: (path: string) => path.split('/').slice(0, -1).join('/') || '/',
      basename: (path: string) => path.split('/').pop() || '',
      extname: (path: string) => {
        const base = path.split('/').pop() || '';
        const dot = base.lastIndexOf('.');
        return dot > 0 ? base.slice(dot) : '';
      },
      relative: (_from: string, to: string) => to,
      isAbsolute: (path: string) => path.startsWith('/'),
      normalize: (path: string) => path.replace(/\/+/g, '/'),
      homedir: () => '/',
    };

    const core = new Core({
      projectRoot: repoPath,
      adapters: { fs: fsAdapter },
    });

    // Get project name from repo
    const projectName = context.currentScope.repository?.name || 'Backlog';

    await core.initProject({ projectName });

    // Refresh to pick up the new project
    await refreshData();
  }, [fileSystem, context.currentScope.repository, refreshData]);

  return (
    <div
      style={{
        padding: 'clamp(12px, 3vw, 20px)', // Responsive padding for mobile
        fontFamily: theme.fonts.body,
        height: '100%',
        boxSizing: 'border-box', // Include padding in height calculation
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflow: 'hidden', // Prevent outer scrolling
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
      }}
    >
      {/* Header */}
      <div
        style={{
          flexShrink: 0, // Don't shrink header
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <Kanban size={24} color={theme.colors.primary} />
        <h2
          style={{
            margin: 0,
            fontSize: theme.fontSizes[4],
            color: theme.colors.text,
          }}
        >
          Kanban Board
        </h2>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            flexShrink: 0, // Don't shrink error message
            padding: '12px',
            background: `${theme.colors.error}20`,
            border: `1px solid ${theme.colors.error}`,
            borderRadius: theme.radii[2],
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: theme.colors.error,
            fontSize: theme.fontSizes[1],
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Board Container or Empty State */}
      {!isBacklogProject ? (
        <EmptyState
          canInitialize={canInitialize}
          onInitialize={handleInitialize}
        />
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            gap: '16px',
            justifyContent: 'center', // Center columns when they hit max-width
            overflowX: 'auto',
            overflowY: 'hidden',
            paddingBottom: '8px',
            minHeight: 0, // Allow flex child to shrink below content size
            WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
          }}
        >
          {sources.map((source) => {
            const columnTasks = tasksBySource.get(source) || [];
            const columnState = columnStates.get(source);
            return (
              <KanbanColumn
                key={source}
                status={SOURCE_DISPLAY_LABELS[source as SourceColumn]}
                tasks={columnTasks}
                total={columnState?.total}
                hasMore={columnState?.hasMore}
                isLoadingMore={columnState?.isLoadingMore}
                onLoadMore={() => loadMore(source as SourceColumn)}
                onTaskClick={handleTaskClick}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * KanbanPanel - A kanban board panel for visualizing Backlog.md tasks.
 *
 * This panel shows:
 * - Kanban board with configurable status columns
 * - Task cards with priority indicators
 * - Labels and assignee information
 * - Mock data for testing (to be replaced with real data)
 */
export const KanbanPanel: React.FC<PanelComponentProps> = (props) => {
  return (
    <ThemeProvider>
      <KanbanPanelContent {...props} />
    </ThemeProvider>
  );
};
