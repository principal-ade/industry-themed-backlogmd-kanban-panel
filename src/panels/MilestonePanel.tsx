import React, { useState, useCallback } from 'react';
import { Milestone as MilestoneIcon, AlertCircle, RefreshCw, Plus } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import type { PanelComponentProps } from '../types';
import { useMilestoneData } from './milestone/hooks/useMilestoneData';
import { MilestoneCard } from './milestone/components/MilestoneCard';
import { MilestoneModal } from './milestone/components/MilestoneModal';
import type { Task, Milestone, MilestoneCreateInput, MilestoneUpdateInput } from '@backlog-md/core';

/**
 * MilestonePanel - A panel for viewing and managing Backlog.md milestones.
 *
 * Features:
 * - List of milestones with progress bars
 * - Expandable milestone cards with lazy-loaded tasks
 * - Click tasks to view details in TaskDetailPanel
 */
export const MilestonePanel: React.FC<PanelComponentProps> = ({
  context,
  actions,
  events,
}) => {
  const { theme } = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Milestone modal state
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | undefined>(undefined);

  const {
    milestones,
    isLoading,
    error,
    isBacklogProject,
    toggleMilestone,
    refreshData,
    canWrite,
    core,
  } = useMilestoneData({
    context,
    actions,
  });

  const handleTaskClick = (task: Task) => {
    // Emit task:selected event for other panels
    if (events) {
      events.emit({
        type: 'task:selected',
        source: 'milestone-panel',
        timestamp: Date.now(),
        payload: { taskId: task.id, task },
      });
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Milestone modal handlers
  const handleOpenNewMilestone = useCallback(() => {
    setEditingMilestone(undefined);
    setIsMilestoneModalOpen(true);
  }, []);

  const handleEditMilestone = useCallback((milestone: Milestone) => {
    setEditingMilestone(milestone);
    setIsMilestoneModalOpen(true);
  }, []);

  const handleCloseMilestoneModal = useCallback(() => {
    setIsMilestoneModalOpen(false);
    setEditingMilestone(undefined);
  }, []);

  const handleSaveMilestone = useCallback(async (input: MilestoneCreateInput | MilestoneUpdateInput) => {
    if (!core) {
      throw new Error('Backlog not loaded');
    }

    if (editingMilestone) {
      // Update existing milestone
      await core.updateMilestone(editingMilestone.id, input as MilestoneUpdateInput);
    } else {
      // Create new milestone
      await core.createMilestone(input as MilestoneCreateInput);
    }

    // Refresh to show the new/updated milestone
    await refreshData();
  }, [core, editingMilestone, refreshData]);

  return (
    <div
      style={{
        padding: 'clamp(12px, 3vw, 20px)',
        fontFamily: theme.fonts.body,
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
      }}
    >
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <MilestoneIcon size={24} color={theme.colors.primary} />
          <h2
            style={{
              margin: 0,
              fontSize: theme.fontSizes[4],
              color: theme.colors.text,
            }}
          >
            Milestones
          </h2>
        </div>

        {isBacklogProject && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Add Milestone button - only shown when write operations are available */}
            {canWrite && (
              <button
                onClick={handleOpenNewMilestone}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: theme.colors.primary,
                  color: theme.colors.background,
                  border: 'none',
                  borderRadius: theme.radii[2],
                  padding: '6px 12px',
                  fontSize: theme.fontSizes[1],
                  fontWeight: theme.fontWeights.medium,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s ease',
                }}
              >
                <Plus size={14} />
                Add Milestone
              </button>
            )}

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              style={{
                background: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radii[1],
                padding: '6px',
                cursor: isRefreshing ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              title="Refresh milestones"
            >
              <RefreshCw
                size={16}
                color={theme.colors.textSecondary}
                style={{
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                }}
              />
            </button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            flexShrink: 0,
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

      {/* Content */}
      {isLoading ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.colors.textSecondary,
          }}
        >
          Loading milestones...
        </div>
      ) : !isBacklogProject ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            color: theme.colors.textSecondary,
          }}
        >
          <MilestoneIcon size={48} color={theme.colors.border} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: theme.fontSizes[2] }}>
              No Backlog.md project found
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: theme.fontSizes[1] }}>
              Initialize a project from the Kanban Board panel
            </p>
          </div>
        </div>
      ) : milestones.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            color: theme.colors.textSecondary,
          }}
        >
          <MilestoneIcon size={48} color={theme.colors.border} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: theme.fontSizes[2] }}>
              No milestones yet
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: theme.fontSizes[1] }}>
              Create milestones to organize your tasks into releases or sprints
            </p>
          </div>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            paddingRight: '4px',
            marginRight: '-4px',
          }}
        >
          {milestones.map((milestoneState) => (
            <MilestoneCard
              key={milestoneState.milestone.id}
              milestoneState={milestoneState}
              onToggle={() => toggleMilestone(milestoneState.milestone.id)}
              onTaskClick={handleTaskClick}
            />
          ))}
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

      {/* Milestone Modal */}
      <MilestoneModal
        isOpen={isMilestoneModalOpen}
        onClose={handleCloseMilestoneModal}
        onSave={handleSaveMilestone}
        milestone={editingMilestone}
      />
    </div>
  );
};
