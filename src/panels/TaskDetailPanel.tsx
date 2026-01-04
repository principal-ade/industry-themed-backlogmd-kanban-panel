import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Tag, User, Calendar, Flag, GitBranch, X, Bot, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import { DocumentView } from 'themed-markdown';
import type { PanelComponentProps, PanelEventEmitter } from '../types';
import type { Task } from '@backlog-md/core';

/** Claude assignment status for a task */
type ClaudeAssignmentStatus = 'idle' | 'loading' | 'success' | 'error';

interface ClaudeAssignmentState {
  status: ClaudeAssignmentStatus;
  issueUrl?: string;
  issueNumber?: number;
  error?: string;
}

/**
 * Extract the markdown body from a Task object for rendering.
 * This is a local implementation until @backlog-md/core exports getTaskBodyMarkdown.
 */
function getTaskBodyMarkdown(task: Task, options: { includeTitle?: boolean } = {}): string {
  const { includeTitle = false } = options;

  // If we have rawContent, use it (stripping title if needed)
  if (task.rawContent) {
    let body = task.rawContent;

    if (!includeTitle && task.title) {
      // Remove the h1 title line
      const escapedTitle = task.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      body = body.replace(new RegExp(`^#\\s+${escapedTitle}\\s*\\n?`, 'm'), '');
    }

    return body.trim();
  }

  // Reconstruct from parsed fields if no rawContent
  const sections: string[] = [];

  if (includeTitle && task.title) {
    sections.push(`# ${task.title}`);
    sections.push('');
  }

  if (task.description) {
    sections.push(task.description);
    sections.push('');
  }

  if (task.acceptanceCriteriaItems && task.acceptanceCriteriaItems.length > 0) {
    sections.push('## Acceptance Criteria');
    sections.push('');
    for (const criterion of task.acceptanceCriteriaItems) {
      const checkbox = criterion.checked ? '[x]' : '[ ]';
      sections.push(`- ${checkbox} ${criterion.text}`);
    }
    sections.push('');
  }

  if (task.implementationPlan) {
    sections.push('## Implementation Plan');
    sections.push('');
    sections.push(task.implementationPlan);
    sections.push('');
  }

  if (task.implementationNotes) {
    sections.push('## Implementation Notes');
    sections.push('');
    sections.push(task.implementationNotes);
    sections.push('');
  }

  return sections.join('\n').trim();
}

/**
 * Event payload for task selection
 */
interface TaskSelectedPayload {
  taskId: string;
  task: Task;
}

/**
 * Configuration options for TaskDetailPanel
 */
export interface TaskDetailPanelConfig {
  editable?: boolean; // When true, checkboxes are interactive. Default: false
}

/**
 * Extended props for TaskDetailPanel that includes optional config
 */
export interface TaskDetailPanelProps extends PanelComponentProps {
  config?: TaskDetailPanelConfig;
}

/**
 * Priority badge colors
 */
const getPriorityStyles = (theme: ReturnType<typeof useTheme>['theme'], priority?: string) => {
  const baseStyles = {
    padding: '2px 8px',
    borderRadius: theme.radii[1],
    fontSize: theme.fontSizes[0],
    fontWeight: theme.fontWeights.medium,
  };

  switch (priority) {
    case 'high':
      return { ...baseStyles, background: `${theme.colors.error}20`, color: theme.colors.error };
    case 'medium':
      return { ...baseStyles, background: `${theme.colors.warning}20`, color: theme.colors.warning };
    case 'low':
      return { ...baseStyles, background: `${theme.colors.info}20`, color: theme.colors.info };
    default:
      return { ...baseStyles, background: theme.colors.backgroundSecondary, color: theme.colors.textSecondary };
  }
};

/**
 * Status badge component
 */
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const { theme } = useTheme();
  return (
    <span
      style={{
        padding: '4px 12px',
        borderRadius: theme.radii[2],
        fontSize: theme.fontSizes[1],
        fontWeight: theme.fontWeights.medium,
        background: `${theme.colors.primary}20`,
        color: theme.colors.primary,
        textTransform: 'capitalize',
      }}
    >
      {status}
    </span>
  );
};

/**
 * Metadata row component
 */
const MetadataRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}> = ({ icon, label, value }) => {
  const { theme } = useTheme();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: theme.fontSizes[1],
      }}
    >
      <span style={{ color: theme.colors.textMuted, display: 'flex', alignItems: 'center' }}>
        {icon}
      </span>
      <span style={{ color: theme.colors.textSecondary }}>{label}:</span>
      <span style={{ color: theme.colors.text }}>{value}</span>
    </div>
  );
};

/**
 * TaskDetailPanel - A panel for viewing task details from Backlog.md
 *
 * This panel shows:
 * - Task header with title, status, and metadata
 * - Frontmatter fields (priority, assignee, labels, dates)
 * - Markdown body content (description, acceptance criteria, etc.)
 *
 * Listens for 'task:selected' events from other panels (e.g., KanbanPanel)
 */
export const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({ context, actions, events, config }) => {
  const { theme } = useTheme();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [claudeAssignment, setClaudeAssignment] = useState<ClaudeAssignmentState>({ status: 'idle' });

  // Extract config options
  const { editable = false } = config ?? {};

  // Read repository capabilities (Claude workflow detection)
  const repoCapabilities = context.getRepositorySlice<{
    hasClaudeWorkflow: boolean;
    claudeWorkflowPath?: string;
  }>('repoCapabilities');
  const hasClaudeWorkflow = repoCapabilities?.data?.hasClaudeWorkflow ?? false;

  // Handle "Assign to Claude" button click
  const handleAssignToClaude = useCallback(() => {
    if (!events || !selectedTask) return;

    setClaudeAssignment({ status: 'loading' });

    // Emit event for host to handle
    (events as PanelEventEmitter).emit({
      type: 'task:assign-to-claude',
      source: 'task-detail-panel',
      timestamp: Date.now(),
      payload: {
        taskId: selectedTask.id,
        task: {
          id: selectedTask.id,
          title: selectedTask.title,
          description: selectedTask.description,
          priority: selectedTask.priority,
          labels: selectedTask.labels,
          assignee: selectedTask.assignee,
          acceptanceCriteria: selectedTask.acceptanceCriteriaItems,
          implementationPlan: selectedTask.implementationPlan,
          rawContent: selectedTask.rawContent,
          filePath: selectedTask.filePath,
          status: selectedTask.status,
          references: selectedTask.references,
        },
      },
    });
  }, [events, selectedTask]);

  // Listen for task:selected events
  useEffect(() => {
    if (!events) return;

    const handleTaskSelected = (event: { payload: TaskSelectedPayload }) => {
      setSelectedTask(event.payload.task);
      // Reset claude assignment state when a new task is selected
      setClaudeAssignment({ status: 'idle' });
    };

    // Subscribe to task:selected events
    const unsubscribe = (events as PanelEventEmitter).on('task:selected', handleTaskSelected);

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [events]);

  // Listen for Claude assignment success/failure events
  useEffect(() => {
    if (!events) return;

    const unsubscribers = [
      (events as PanelEventEmitter).on('task:assigned-to-claude', (event) => {
        const payload = event.payload as { taskId: string; issueNumber: number; issueUrl: string };
        if (payload.taskId === selectedTask?.id) {
          setClaudeAssignment({
            status: 'success',
            issueNumber: payload.issueNumber,
            issueUrl: payload.issueUrl,
          });
        }
      }),
      (events as PanelEventEmitter).on('task:assign-to-claude:error', (event) => {
        const payload = event.payload as { taskId: string; error: string };
        if (payload.taskId === selectedTask?.id) {
          setClaudeAssignment({
            status: 'error',
            error: payload.error,
          });
        }
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, [events, selectedTask?.id]);

  // Handle back/close
  const handleBack = () => {
    setSelectedTask(null);
    // Optionally emit an event to notify other panels
    if (events) {
      (events as PanelEventEmitter).emit({
        type: 'task:deselected',
        source: 'task-detail-panel',
        timestamp: Date.now(),
        payload: {},
      });
    }
  };

  // Empty state when no task is selected
  if (!selectedTask) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          backgroundColor: theme.colors.background,
          color: theme.colors.textSecondary,
          gap: '16px',
        }}
      >
        <FileText size={48} color={theme.colors.textMuted} />
        <div style={{ textAlign: 'center' }}>
          <h3
            style={{
              margin: '0 0 8px 0',
              fontSize: theme.fontSizes[3],
              color: theme.colors.text,
              fontWeight: theme.fontWeights.semibold,
            }}
          >
            No Task Selected
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
            }}
          >
            Click on a task in the Kanban board to view its details
          </p>
        </div>
      </div>
    );
  }

  // Get markdown body for rendering
  const bodyMarkdown = getTaskBodyMarkdown(selectedTask, { includeTitle: false });

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          padding: '16px 20px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
        }}
      >
        {/* ID, Status, and Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                fontFamily: theme.fonts.monospace,
                fontSize: theme.fontSizes[0],
                color: theme.colors.textMuted,
              }}
            >
              {selectedTask.id}
            </span>
            <StatusBadge status={selectedTask.status} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Assign to Claude button */}
            {hasClaudeWorkflow && claudeAssignment.status === 'idle' && (
              <button
                onClick={handleAssignToClaude}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  border: `1px solid ${theme.colors.primary}`,
                  borderRadius: theme.radii[1],
                  background: 'transparent',
                  cursor: 'pointer',
                  color: theme.colors.primary,
                  fontSize: theme.fontSizes[1],
                  fontWeight: theme.fontWeights.medium,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = theme.colors.primary;
                  e.currentTarget.style.color = theme.colors.background;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = theme.colors.primary;
                }}
                title="Assign to Claude"
              >
                <Bot size={14} />
                Assign to Claude
              </button>
            )}

            {/* Loading state */}
            {claudeAssignment.status === 'loading' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  color: theme.colors.textSecondary,
                  fontSize: theme.fontSizes[1],
                }}
              >
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Assigning...
              </div>
            )}

            {/* Success state */}
            {claudeAssignment.status === 'success' && (
              <a
                href={claudeAssignment.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  border: `1px solid ${theme.colors.success}`,
                  borderRadius: theme.radii[1],
                  background: `${theme.colors.success}15`,
                  color: theme.colors.success,
                  fontSize: theme.fontSizes[1],
                  fontWeight: theme.fontWeights.medium,
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <CheckCircle size={14} />
                Issue #{claudeAssignment.issueNumber}
              </a>
            )}

            {/* Error state */}
            {claudeAssignment.status === 'error' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  border: `1px solid ${theme.colors.error}`,
                  borderRadius: theme.radii[1],
                  background: `${theme.colors.error}15`,
                  color: theme.colors.error,
                  fontSize: theme.fontSizes[1],
                }}
                title={claudeAssignment.error}
              >
                <AlertCircle size={14} />
                Failed
                <button
                  onClick={() => setClaudeAssignment({ status: 'idle' })}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: theme.colors.error,
                    cursor: 'pointer',
                    padding: '0 0 0 4px',
                    fontSize: theme.fontSizes[0],
                    textDecoration: 'underline',
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {/* Close button */}
            <button
              onClick={handleBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radii[1],
                background: theme.colors.surface,
                cursor: 'pointer',
                color: theme.colors.textSecondary,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme.colors.backgroundSecondary;
                e.currentTarget.style.color = theme.colors.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = theme.colors.surface;
                e.currentTarget.style.color = theme.colors.textSecondary;
              }}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Spinner animation */}
        <style>
          {`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}
        </style>

        {/* Title */}
        <h1
          style={{
            margin: '0 0 16px 0',
            fontSize: theme.fontSizes[5],
            fontWeight: theme.fontWeights.bold,
            color: theme.colors.text,
            lineHeight: 1.3,
          }}
        >
          {selectedTask.title}
        </h1>

        {/* Metadata grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
          }}
        >
          {selectedTask.priority && (
            <MetadataRow
              icon={<Flag size={14} />}
              label="Priority"
              value={
                <span style={getPriorityStyles(theme, selectedTask.priority)}>
                  {selectedTask.priority}
                </span>
              }
            />
          )}

          {selectedTask.assignee && selectedTask.assignee.length > 0 && (
            <MetadataRow
              icon={<User size={14} />}
              label="Assignee"
              value={selectedTask.assignee.join(', ')}
            />
          )}

          {selectedTask.createdDate && (
            <MetadataRow
              icon={<Calendar size={14} />}
              label="Created"
              value={selectedTask.createdDate}
            />
          )}

          {selectedTask.branch && (
            <MetadataRow
              icon={<GitBranch size={14} />}
              label="Branch"
              value={selectedTask.branch}
            />
          )}
        </div>

        {/* Labels */}
        {selectedTask.labels && selectedTask.labels.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '12px',
              flexWrap: 'wrap',
            }}
          >
            <Tag size={14} color={theme.colors.textMuted} />
            {selectedTask.labels.map((label) => (
              <span
                key={label}
                style={{
                  padding: '2px 8px',
                  borderRadius: theme.radii[1],
                  fontSize: theme.fontSizes[0],
                  fontWeight: theme.fontWeights.medium,
                  background: `${theme.colors.primary}15`,
                  color: theme.colors.primary,
                }}
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Body Content */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {bodyMarkdown ? (
          <DocumentView
            content={bodyMarkdown}
            theme={theme}
            maxWidth="100%"
            transparentBackground
            editable={editable}
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.colors.textMuted,
              fontStyle: 'italic',
              padding: '40px',
            }}
          >
            No description or content available
          </div>
        )}
      </div>
    </div>
  );
};
