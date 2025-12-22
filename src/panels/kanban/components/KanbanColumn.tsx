import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { Task } from '@backlog-md/core';

interface KanbanColumnProps {
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
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status,
  tasks,
  total,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onTaskClick,
}) => {
  const { theme } = useTheme();

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return theme.colors.error;
      case 'medium':
        return theme.colors.warning;
      case 'low':
        return theme.colors.info;
      default:
        return theme.colors.border;
    }
  };

  const remaining = total !== undefined ? total - tasks.length : 0;

  return (
    <div
      style={{
        flex: '1 1 0', // Grow to fill available width equally
        minWidth: '280px',
        maxWidth: '500px', // Cap max width for readability
        height: '100%', // Fill parent height
        minHeight: 0, // Allow shrinking
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        background: theme.colors.backgroundSecondary,
        borderRadius: theme.radii[2],
        padding: 'clamp(12px, 3vw, 16px)', // Responsive padding for mobile
        border: `1px solid ${theme.colors.border}`,
      }}
    >
      {/* Column Header */}
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
          <div
            key={task.id}
            onClick={() => onTaskClick?.(task)}
            style={{
              flexShrink: 0, // Prevent card from shrinking
              background: theme.colors.surface,
              borderRadius: theme.radii[2],
              padding: '12px',
              border: `1px solid ${theme.colors.border}`,
              borderLeft: `4px solid ${getPriorityColor(task.priority)}`,
              cursor: onTaskClick ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              minHeight: '44px', // Minimum touch target size for mobile
            }}
            onMouseEnter={(e) => {
              if (onTaskClick) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = `0 4px 8px ${theme.colors.border}`;
              }
            }}
            onMouseLeave={(e) => {
              if (onTaskClick) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            {/* Task Title */}
            <h4
              style={{
                margin: '0 0 8px 0',
                fontSize: theme.fontSizes[2],
                color: theme.colors.text,
                fontWeight: theme.fontWeights.medium,
              }}
            >
              {task.title}
            </h4>

            {/* Task Description */}
            {task.description && (
              <p
                style={{
                  margin: '0 0 8px 0',
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textSecondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: '1.4',
                }}
              >
                {task.description}
              </p>
            )}

            {/* Task Labels */}
            {task.labels && task.labels.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  gap: '4px',
                  flexWrap: 'wrap',
                  marginBottom: '8px',
                }}
              >
                {task.labels.map((label) => (
                  <span
                    key={label}
                    style={{
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.primary,
                      background: `${theme.colors.primary}20`,
                      padding: '2px 8px',
                      borderRadius: theme.radii[1],
                      fontWeight: theme.fontWeights.medium,
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}

            {/* Task Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: theme.fontSizes[0],
                color: theme.colors.textMuted,
              }}
            >
              <span
                style={{
                  fontFamily: theme.fonts.monospace,
                }}
              >
                {task.id}
              </span>
              {task.assignee && task.assignee.length > 0 && (
                <span
                  style={{
                    color: theme.colors.textSecondary,
                  }}
                >
                  {task.assignee.length} assignee
                  {task.assignee.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
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
