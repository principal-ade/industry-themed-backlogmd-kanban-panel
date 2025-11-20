import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { Task } from '../backlog-types';

interface KanbanColumnProps {
  status: string;
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status,
  tasks,
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

  return (
    <div
      style={{
        flex: '1',
        minWidth: 'min(280px, 85vw)', // Responsive width for mobile
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
          {tasks.length}
        </span>
      </div>

      {/* Task Cards */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {tasks.map((task) => (
          <div
            key={task.id}
            onClick={() => onTaskClick?.(task)}
            style={{
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
                  {task.assignee.length} assignee{task.assignee.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
