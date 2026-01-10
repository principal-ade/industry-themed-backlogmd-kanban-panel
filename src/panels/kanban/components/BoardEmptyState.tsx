import React from 'react';
import { Rocket, Plus, Milestone } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';

interface BoardEmptyStateProps {
  onAddTask: () => void;
  onAddMilestone: () => void;
  canWrite: boolean;
}

/**
 * BoardEmptyState component displayed when the backlog is initialized but has no tasks
 */
export const BoardEmptyState: React.FC<BoardEmptyStateProps> = ({
  onAddTask,
  onAddMilestone,
  canWrite,
}) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '48px 24px',
        textAlign: 'center',
        color: theme.colors.textMuted,
      }}
    >
      <Rocket
        size={64}
        color={theme.colors.textMuted}
        style={{ marginBottom: '24px', opacity: 0.5 }}
      />

      <h3
        style={{
          fontSize: theme.fontSizes[4],
          fontWeight: 600,
          color: theme.colors.text,
          marginBottom: '12px',
        }}
      >
        Your backlog is empty!
      </h3>

      <p
        style={{
          fontSize: theme.fontSizes[2],
          color: theme.colors.textMuted,
          marginBottom: '32px',
          maxWidth: '480px',
          lineHeight: 1.6,
        }}
      >
        Ready to get started? Add your first task to begin organizing your work.
      </p>

      {canWrite ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <button
            onClick={onAddTask}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              backgroundColor: theme.colors.primary,
              color: theme.colors.textOnPrimary,
              borderRadius: theme.radii[2],
              border: 'none',
              fontSize: theme.fontSizes[2],
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            <Plus size={16} />
            <span>Add Task</span>
          </button>
          <button
            onClick={onAddMilestone}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              backgroundColor: theme.colors.backgroundSecondary,
              color: theme.colors.text,
              borderRadius: theme.radii[2],
              border: `1px solid ${theme.colors.border}`,
              fontSize: theme.fontSizes[2],
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            <Milestone size={16} />
            <span>Add Milestone</span>
          </button>
        </div>
      ) : (
        <p
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textMuted,
            fontStyle: 'italic',
          }}
        >
          You don't have permission to add tasks
        </p>
      )}
    </div>
  );
};
