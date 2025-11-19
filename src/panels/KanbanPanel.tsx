import React, { useState } from 'react';
import { Kanban, RefreshCw, AlertCircle } from 'lucide-react';
import { ThemeProvider, useTheme } from '@principal-ade/industry-theme';
import type { PanelComponentProps } from '../types';
import { useKanbanData } from './kanban/hooks/useKanbanData';
import { KanbanColumn } from './kanban/components/KanbanColumn';
import { EmptyState } from './kanban/components/EmptyState';
import type { Task } from './kanban/backlog-types';

/**
 * KanbanPanelContent - Internal component that uses theme
 */
const KanbanPanelContent: React.FC<PanelComponentProps> = ({
  context,
  actions,
}) => {
  const { theme } = useTheme();
  const [_selectedTask, setSelectedTask] = useState<Task | null>(null);
  const {
    statuses,
    tasksByStatus,
    isLoading,
    error,
    isBacklogProject,
    refreshData,
  } = useKanbanData({ context, actions });

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    // In the future, this will open a task detail modal
    // Task click logged for development
  };

  const handleRefresh = async () => {
    await refreshData();
  };

  return (
    <div
      style={{
        padding: '20px',
        fontFamily: theme.fonts.body,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
        {context.currentScope.repository && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
              fontFamily: theme.fonts.monospace,
            }}
          >
            {context.currentScope.repository.name}
          </span>
        )}
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          style={{
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radii[1],
            background: theme.colors.surface,
            color: theme.colors.text,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          <RefreshCw size={16} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: '12px',
            background: `${theme.colors.error}20`,
            border: `1px solid ${theme.colors.error}`,
            borderRadius: theme.radii[2],
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: theme.colors.error,
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Board Container or Empty State */}
      {!isBacklogProject ? (
        <EmptyState />
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            gap: '16px',
            overflowX: 'auto',
            paddingBottom: '8px',
          }}
        >
          {statuses.map((status) => {
            const columnTasks = tasksByStatus.get(status) || [];
            return (
              <KanbanColumn
                key={status}
                status={status}
                tasks={columnTasks}
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
