import React from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import type { Task } from '@backlog-md/core';
import type { MilestoneState } from '../hooks/useMilestoneData';

interface MilestoneCardProps {
  milestoneState: MilestoneState;
  onToggle: () => void;
  onTaskClick?: (task: Task) => void;
}

export const MilestoneCard: React.FC<MilestoneCardProps> = ({
  milestoneState,
  onToggle,
  onTaskClick,
}) => {
  const { theme } = useTheme();
  const { milestone, tasks, isLoading, isExpanded } = milestoneState;

  // Calculate progress
  const totalTasks = milestone.tasks.length;
  const doneTasks = tasks.filter(
    (t) => t.status?.toLowerCase().includes('done') || t.status?.toLowerCase().includes('complete')
  ).length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Only show progress if tasks are loaded
  const showProgress = tasks.length > 0 || totalTasks === 0;

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
        flexShrink: 0,
        background: theme.colors.surface,
        borderRadius: theme.radii[2],
        border: `1px solid ${theme.colors.border}`,
        overflow: 'hidden',
      }}
    >
      {/* Header - Clickable */}
      <div
        onClick={onToggle}
        style={{
          padding: '16px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          transition: 'background 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = theme.colors.backgroundSecondary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        {/* Title row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isLoading ? (
              <Loader2
                size={16}
                color={theme.colors.primary}
                style={{ animation: 'spin 1s linear infinite' }}
              />
            ) : isExpanded ? (
              <ChevronDown size={16} color={theme.colors.textSecondary} />
            ) : (
              <ChevronRight size={16} color={theme.colors.textSecondary} />
            )}
            <h3
              style={{
                margin: 0,
                fontSize: theme.fontSizes[3],
                fontWeight: theme.fontWeights.semibold,
                color: theme.colors.text,
              }}
            >
              {milestone.title}
            </h3>
          </div>

          {/* Task count and progress badge */}
          <span
            style={{
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
              background: theme.colors.backgroundSecondary,
              padding: '4px 10px',
              borderRadius: theme.radii[1],
              fontWeight: theme.fontWeights.medium,
            }}
          >
            {totalTasks} task{totalTasks !== 1 ? 's' : ''}
            {showProgress && (
              <>
                {' · '}
                <span style={{ color: progress === 100 ? theme.colors.success : theme.colors.text }}>
                  {progress}%
                </span>
              </>
            )}
          </span>
        </div>

        {/* Description preview (if not expanded) */}
        {!isExpanded && milestone.description && (
          <p
            style={{
              margin: 0,
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
            {milestone.description}
          </p>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div
          style={{
            borderTop: `1px solid ${theme.colors.border}`,
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Full description */}
          {milestone.description && (
            <p
              style={{
                margin: 0,
                fontSize: theme.fontSizes[1],
                color: theme.colors.textSecondary,
                lineHeight: '1.5',
              }}
            >
              {milestone.description}
            </p>
          )}

          {/* Status summary */}
          {tasks.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
                fontSize: theme.fontSizes[1],
              }}
            >
              <span style={{ color: theme.colors.success }}>
                {doneTasks} done
              </span>
              <span style={{ color: theme.colors.textSecondary }}>
                {totalTasks - doneTasks} remaining
              </span>
            </div>
          )}

          {/* Task list */}
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                color: theme.colors.textSecondary,
                gap: '8px',
              }}
            >
              <Loader2
                size={16}
                style={{ animation: 'spin 1s linear infinite' }}
              />
              Loading tasks...
            </div>
          ) : tasks.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '300px',
                overflowY: 'auto',
                paddingRight: '4px',
              }}
            >
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTaskClick?.(task);
                  }}
                  style={{
                    background: theme.colors.background,
                    borderRadius: theme.radii[1],
                    padding: '10px 12px',
                    border: `1px solid ${theme.colors.border}`,
                    borderLeft: `3px solid ${getPriorityColor(task.priority)}`,
                    cursor: onTaskClick ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                  onMouseEnter={(e) => {
                    if (onTaskClick) {
                      e.currentTarget.style.background = theme.colors.backgroundSecondary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = theme.colors.background;
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: theme.fonts.monospace,
                        fontSize: theme.fontSizes[0],
                        color: theme.colors.textMuted,
                        flexShrink: 0,
                      }}
                    >
                      #{task.id}
                    </span>
                    <span
                      style={{
                        fontSize: theme.fontSizes[1],
                        color: theme.colors.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {task.title}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: theme.fontSizes[0],
                      color:
                        task.status?.toLowerCase().includes('done')
                          ? theme.colors.success
                          : theme.colors.textSecondary,
                      background: theme.colors.backgroundSecondary,
                      padding: '2px 8px',
                      borderRadius: theme.radii[1],
                      flexShrink: 0,
                    }}
                  >
                    {task.status}
                  </span>
                </div>
              ))}
            </div>
          ) : totalTasks === 0 ? (
            <div
              style={{
                padding: '16px',
                textAlign: 'center',
                color: theme.colors.textMuted,
                fontSize: theme.fontSizes[1],
              }}
            >
              No tasks in this milestone
            </div>
          ) : null}
        </div>
      )}

      {/* Spinner animation */}
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
