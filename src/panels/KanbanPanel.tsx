import React, { useState } from 'react';
import { Kanban, AlertCircle } from 'lucide-react';
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
    error,
    isBacklogProject,
  } = useKanbanData({ context, actions });

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    // In the future, this will open a task detail modal
    // Task click logged for development
  };

  return (
    <div
      style={{
        padding: 'clamp(12px, 3vw, 20px)', // Responsive padding for mobile
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
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
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
        <EmptyState />
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            gap: '16px',
            overflowX: 'auto',
            overflowY: 'hidden',
            paddingBottom: '8px',
            WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
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
