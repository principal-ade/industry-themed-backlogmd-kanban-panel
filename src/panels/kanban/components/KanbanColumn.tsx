import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useTheme } from '@principal-ade/industry-theme';
import type { Task } from '@backlog-md/core';
import { TaskCard } from './TaskCard';
import type { StatusColumn } from '../hooks/useKanbanData';

interface KanbanColumnProps {
  /** The column status key (used as droppable ID) */
  columnId: StatusColumn;
  /** Display label for the column */
  status: string;
  tasks: Task[];
  /** Total number of tasks in this column (for pagination) */
  total?: number;
  /** Whether more tasks are available to load */
  hasMore?: boolean;
  /** Whether more tasks are currently being loaded */
  isLoadingMore?: boolean;
  /** Callback to load more tasks */
  onLoadMore?: () => void;
  onTaskClick?: (task: Task) => void;
  /** Whether column should take full width (for narrow/mobile views) */
  fullWidth?: boolean;
  /** Currently selected task ID */
  selectedTaskId?: string | null;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  columnId,
  status,
  tasks,
  total,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onTaskClick,
  fullWidth = false,
  selectedTaskId,
}) => {
  const { theme } = useTheme();

  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
  });

  const remaining = total !== undefined ? total - tasks.length : 0;

  return (
    <div
      ref={setNodeRef}
      style={{
        flex: fullWidth ? '1 1 auto' : '1 1 0', // Grow to fill available width equally
        minWidth: fullWidth ? undefined : '280px',
        alignSelf: 'stretch', // Fill parent height via flexbox
        minHeight: 0, // Allow shrinking
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        background: isOver
          ? `${theme.colors.primary}10`
          : theme.colors.backgroundSecondary,
        borderRadius: theme.radii[2],
        padding: 'clamp(12px, 3vw, 16px)', // Responsive padding for mobile
        border: isOver
          ? `2px dashed ${theme.colors.primary}`
          : `1px solid ${theme.colors.border}`,
        transition: 'background-color 0.2s ease, border 0.2s ease',
      }}
    >
      {/* Column Header - hidden in narrow/mobile view (tabs show this info) */}
      {!fullWidth && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: theme.fontSizes[3],
              color: theme.colors.text,
              fontWeight: theme.fontWeights.semibold,
            }}
          >
            {status}
          </h3>
          <span
            style={{
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
              background: theme.colors.background,
              padding: '2px 8px',
              borderRadius: theme.radii[1],
            }}
          >
            {total !== undefined ? `${tasks.length}/${total}` : tasks.length}
          </span>
        </div>
      )}

      {/* Task Cards */}
      <div
        style={{
          flex: 1,
          minHeight: 0, // Critical: allows flex child to shrink and scroll
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          // Add padding for scroll content, use margin trick to prevent clipping
          paddingRight: '4px',
          marginRight: '-4px',
        }}
      >
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={onTaskClick}
            isSelected={selectedTaskId === task.id}
          />
        ))}

        {/* Load More Button */}
        {hasMore && onLoadMore && (
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            style={{
              background: theme.colors.background,
              border: `1px dashed ${theme.colors.border}`,
              borderRadius: theme.radii[2],
              padding: '12px',
              cursor: isLoadingMore ? 'wait' : 'pointer',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
              transition: 'all 0.2s ease',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              if (!isLoadingMore) {
                e.currentTarget.style.background = theme.colors.backgroundSecondary;
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.color = theme.colors.primary;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = theme.colors.background;
              e.currentTarget.style.borderColor = theme.colors.border;
              e.currentTarget.style.color = theme.colors.textSecondary;
            }}
          >
            {isLoadingMore ? (
              <>
                <span
                  style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    border: `2px solid ${theme.colors.border}`,
                    borderTopColor: theme.colors.primary,
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                Loading...
              </>
            ) : (
              `Load more (${remaining} remaining)`
            )}
          </button>
        )}

        {/* Bottom spacer to prevent last item from being cut off */}
        <div style={{ flexShrink: 0, height: '4px' }} />
      </div>

      {/* Inline keyframes for spinner animation */}
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};
