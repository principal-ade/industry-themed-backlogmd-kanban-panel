import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useTheme } from '@principal-ade/industry-theme';
import type { Task } from '@backlog-md/core';

interface TaskCardProps {
  task: Task;
  onClick?: (task: Task) => void;
  isDragOverlay?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onClick,
  isDragOverlay = false,
}) => {
  const { theme } = useTheme();

  // Only use draggable hook for non-overlay cards
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id: task.id,
    data: { task },
    disabled: isDragOverlay,
  });

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

  // Base styles for the card
  const style: React.CSSProperties = {
    flexShrink: 0,
    background: theme.colors.surface,
    borderRadius: theme.radii[2],
    padding: '12px',
    border: `1px solid ${theme.colors.border}`,
    borderLeft: `4px solid ${getPriorityColor(task.priority)}`,
    cursor: isDragOverlay ? 'grabbing' : 'grab',
    transition: isDragging ? 'none' : 'all 0.2s ease',
    minHeight: '44px',
    touchAction: 'none',
    userSelect: 'none',
    // When dragging, the original card stays in place but becomes a placeholder
    // The DragOverlay handles the visual movement
    opacity: isDragging ? 0.4 : 1,
    // Overlay card styling
    ...(isDragOverlay && {
      boxShadow: `0 8px 16px rgba(0, 0, 0, 0.15)`,
      transform: 'rotate(2deg) scale(1.02)',
      opacity: 1,
      zIndex: 1000,
    }),
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger click if not dragging
    if (!isDragging && onClick) {
      onClick(task);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      {...listeners}
      {...attributes}
      onMouseEnter={(e) => {
        if (!isDragging && !isDragOverlay) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = `0 4px 8px ${theme.colors.border}`;
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging && !isDragOverlay) {
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
  );
};
