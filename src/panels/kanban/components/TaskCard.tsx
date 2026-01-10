import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useTheme } from '@principal-ade/industry-theme';
import { ExternalLink, GitBranch } from 'lucide-react';
import type { Task } from '@backlog-md/core';
import { TaskContextMenu } from './TaskContextMenu';

/** Extract GitHub issue info from a task's references */
function getGitHubIssueFromRefs(references?: string[]): { number: number; url: string } | null {
  if (!references) return null;
  for (const ref of references) {
    // Match GitHub issue URLs like https://github.com/owner/repo/issues/123
    const match = ref.match(/github\.com\/[^/]+\/[^/]+\/issues\/(\d+)/);
    if (match) {
      return { number: parseInt(match[1], 10), url: ref };
    }
  }
  return null;
}

export interface TaskCardProps {
  task: Task;
  onClick?: (task: Task) => void;
  isDragOverlay?: boolean;
  isSelected?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onClick,
  isDragOverlay = false,
  isSelected = false,
}) => {
  const { theme } = useTheme();
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

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
        return theme.colors.primary;
      default:
        return theme.colors.primary;
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

  const handleContextMenu = (e: React.MouseEvent) => {
    // Don't show context menu while dragging
    if (isDragging) return;

    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  };

  const handleCopyPath = async (task: Task) => {
    if (task.filePath) {
      try {
        await navigator.clipboard.writeText(task.filePath);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      } catch (err) {
        console.error('Failed to copy task path:', err);
      }
    }
  };

  // Strip "Task ###" prefix from title since ID is shown at bottom
  const displayTitle = task.title.replace(/^Task\s+\d+\s*[:\-–—]?\s*/i, '').trim() || task.title;

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        {...listeners}
        {...attributes}
        onMouseEnter={(e) => {
        if (!isDragging && !isDragOverlay) {
          // Expand description on hover
          const desc = e.currentTarget.querySelector('p');
          if (desc) {
            (desc as HTMLElement).style.maxHeight = '20em';
          }
          // Ensure border stays
          e.currentTarget.style.borderLeft = `4px solid ${getPriorityColor(task.priority)}`;
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging && !isDragOverlay) {
          // Collapse description on leave
          const desc = e.currentTarget.querySelector('p');
          if (desc) {
            (desc as HTMLElement).style.maxHeight = '2.8em';
          }
          // Ensure border stays
          e.currentTarget.style.borderLeft = `4px solid ${getPriorityColor(task.priority)}`;
        }
      }}
    >
      {/* Task Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <h4
          style={{
            margin: 0,
            fontSize: theme.fontSizes[2],
            color: isSelected ? getPriorityColor(task.priority) : theme.colors.text,
            fontWeight: theme.fontWeights.medium,
            flex: 1,
          }}
        >
          {displayTitle}
        </h4>
        {getGitHubIssueFromRefs(task.references) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              padding: '2px 6px',
              borderRadius: theme.radii[1],
              background: `${theme.colors.success}20`,
              color: theme.colors.success,
              fontSize: theme.fontSizes[0],
              fontWeight: theme.fontWeights.medium,
              flexShrink: 0,
            }}
            title="Assigned to Claude"
          >
            <GitBranch size={10} />
          </div>
        )}
      </div>

      {/* Task Description */}
      {task.description && (
        <p
          style={{
            margin: '0 0 8px 0',
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            overflow: 'hidden',
            lineHeight: '1.4',
            maxHeight: '2.8em', // 2 lines (1.4 * 2)
            transition: 'max-height 0.3s ease',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontFamily: theme.fonts.monospace,
            }}
          >
            {task.id}
          </span>
          {(() => {
            const issue = getGitHubIssueFromRefs(task.references);
            if (!issue) return null;
            return (
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  color: theme.colors.primary,
                  textDecoration: 'none',
                  fontSize: theme.fontSizes[0],
                }}
                title={`View issue #${issue.number} on GitHub`}
              >
                <ExternalLink size={10} />
                #{issue.number}
              </a>
            );
          })()}
        </div>
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

      {contextMenuPosition && (
        <TaskContextMenu
          task={task}
          position={contextMenuPosition}
          onClose={() => setContextMenuPosition(null)}
          onCopyPath={handleCopyPath}
        />
      )}

      {copyFeedback && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: theme.colors.success,
            color: 'white',
            padding: '12px 16px',
            borderRadius: theme.radii[2],
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 10001,
            fontSize: theme.fontSizes[1],
            fontWeight: theme.fontWeights.medium,
          }}
        >
          Task path copied to clipboard!
        </div>
      )}
    </>
  );
};
