import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileText, X, Bot, Loader2, CheckCircle, AlertCircle, ExternalLink, Trash2 } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import { usePanelFocusListener } from '@principal-ade/panel-layouts';
import { DocumentView } from 'themed-markdown';
import type { TaskDetailPanelPropsTyped, PanelEventEmitter } from '../types';
import type { Task } from '@backlog-md/core';
import { getTracer, SpanStatusCode } from '../telemetry';

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

/** Claude assignment status for a task */
type ClaudeAssignmentStatus = 'idle' | 'loading' | 'success' | 'error';

interface ClaudeAssignmentState {
  status: ClaudeAssignmentStatus;
  issueUrl?: string;
  issueNumber?: number;
  error?: string;
}

/** Delete status for a task */
type DeleteStatus = 'idle' | 'loading' | 'success' | 'error';

interface DeleteState {
  status: DeleteStatus;
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
export interface TaskDetailPanelProps extends TaskDetailPanelPropsTyped {
  config?: TaskDetailPanelConfig;
}

/**
 * Priority badge colors
 */
const getPriorityStyles = (theme: ReturnType<typeof useTheme>['theme'], priority?: string) => {
  const baseStyles = {
    padding: '2px 8px',
    borderRadius: theme.radii[1],
    fontFamily: theme.fonts.body,
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
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[0],
        fontWeight: theme.fontWeights.medium,
        background: `${theme.colors.primary}20`,
        color: theme.colors.primary,
        textTransform: 'capitalize',
      }}
    >
      Status: {status}
    </span>
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
export const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({ context, events, config }) => {
  const { theme } = useTheme();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [claudeAssignment, setClaudeAssignment] = useState<ClaudeAssignmentState>({ status: 'idle' });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteState, setDeleteState] = useState<DeleteState>({ status: 'idle' });
  const panelRef = useRef<HTMLDivElement>(null);

  // Extract config options
  const { editable = false } = config ?? {};

  // Listen for panel focus events
  usePanelFocusListener(
    'task-detail',
    events,
    () => panelRef.current?.focus()
  );

  // Read repository capabilities (Claude workflow detection)
  const repoCapabilities = context.getRepositorySlice<{
    hasClaudeWorkflow: boolean;
    claudeWorkflowPath?: string;
  }>('repoCapabilities');
  const hasClaudeWorkflow = repoCapabilities?.data?.hasClaudeWorkflow ?? false;

  // Handle "Assign to Claude" button click
  const handleAssignToClaude = useCallback(() => {
    if (!events || !selectedTask) return;

    // Emit telemetry event
    const tracer = getTracer();
    const span = tracer.startSpan('detail.interaction', {
      attributes: { 'task.id': selectedTask.id },
    });
    span.addEvent('task.assign.requested', {
      'task.id': selectedTask.id,
      'task.title': selectedTask.title,
    });
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();

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

  // Handle opening delete modal
  const handleOpenDeleteModal = useCallback(() => {
    if (!selectedTask) return;

    // Emit telemetry event
    const tracer = getTracer();
    const span = tracer.startSpan('detail.interaction', {
      attributes: { 'task.id': selectedTask.id },
    });
    span.addEvent('delete.modal.opened', {
      'task.id': selectedTask.id,
    });
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();

    setIsDeleteModalOpen(true);
  }, [selectedTask]);

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(() => {
    if (!events || !selectedTask) return;

    setDeleteState({ status: 'loading' });

    // Emit event for KanbanPanel to handle
    (events as PanelEventEmitter).emit({
      type: 'task:delete-requested',
      source: 'task-detail-panel',
      timestamp: Date.now(),
      payload: {
        taskId: selectedTask.id,
        task: selectedTask,
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

  // Listen for delete success/failure events
  useEffect(() => {
    if (!events) return;

    const unsubscribers = [
      (events as PanelEventEmitter).on('task:deleted:success', (event) => {
        const payload = event.payload as { taskId: string };
        if (payload.taskId === selectedTask?.id) {
          // Emit telemetry event for successful deletion
          const tracer = getTracer();
          const span = tracer.startSpan('task.mutation', {
            attributes: { 'task.id': payload.taskId },
          });
          span.addEvent('task.deleted', {
            'task.id': payload.taskId,
          });
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();

          setDeleteState({ status: 'success' });
          setIsDeleteModalOpen(false);

          // Show success message for 2 seconds, then close and emit task:deleted
          setTimeout(() => {
            // Emit task:deleted event for host orchestration
            (events as PanelEventEmitter).emit({
              type: 'task:deleted',
              source: 'task-detail-panel',
              timestamp: Date.now(),
              payload: { taskId: payload.taskId },
            });

            // Close the panel
            setSelectedTask(null);
            setDeleteState({ status: 'idle' });
          }, 2000);
        }
      }),
      (events as PanelEventEmitter).on('task:deleted:error', (event) => {
        const payload = event.payload as { taskId: string; error: string };
        if (payload.taskId === selectedTask?.id) {
          setDeleteState({
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
  const handleBack = useCallback(() => {
    // Emit telemetry event before clearing state
    if (selectedTask) {
      const tracer = getTracer();
      const span = tracer.startSpan('detail.interaction', {
        attributes: { 'task.id': selectedTask.id },
      });
      span.addEvent('task.deselected', {
        'task.id': selectedTask.id,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    }

    setSelectedTask(null);
    setDeleteState({ status: 'idle' });
    setIsDeleteModalOpen(false);
    // Optionally emit an event to notify other panels
    if (events) {
      (events as PanelEventEmitter).emit({
        type: 'task:deselected',
        source: 'task-detail-panel',
        timestamp: Date.now(),
        payload: {},
      });
    }
  }, [selectedTask, events]);

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
      ref={panelRef}
      tabIndex={-1}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        overflow: 'hidden',
        outline: 'none',
      }}
    >
      {/* Header - 40px fixed height */}
      <div
        style={{
          flexShrink: 0,
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontFamily: theme.fonts.monospace,
              fontSize: theme.fontSizes[0],
              fontWeight: theme.fontWeights.medium,
              color: theme.colors.textMuted,
            }}
          >
            {selectedTask.id}
          </span>
          <StatusBadge status={selectedTask.status} />
          {selectedTask.priority && (
            <span style={getPriorityStyles(theme, selectedTask.priority)}>
              Priority: {selectedTask.priority}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Delete button */}
          {deleteState.status === 'idle' && (
            <button
              onClick={handleOpenDeleteModal}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                border: `1px solid ${theme.colors.error}`,
                borderRadius: theme.radii[1],
                background: 'transparent',
                cursor: 'pointer',
                color: theme.colors.error,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme.colors.error;
                e.currentTarget.style.color = theme.colors.background;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = theme.colors.error;
              }}
              title="Delete task"
            >
              <Trash2 size={14} />
            </button>
          )}

          {/* Delete success indicator */}
          {deleteState.status === 'success' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                border: `1px solid ${theme.colors.success}`,
                borderRadius: theme.radii[1],
                background: `${theme.colors.success}15`,
                color: theme.colors.success,
              }}
              title="Task deleted"
            >
              <CheckCircle size={14} />
            </div>
          )}

          {/* Close button */}
          <button
            onClick={handleBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
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
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Task metadata section */}
      <div
        style={{
          flexShrink: 0,
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.background,
        }}
      >
        {/* Action buttons row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          {/* Assign to Claude button - shown if no GitHub issue yet */}
          {hasClaudeWorkflow && claudeAssignment.status === 'idle' && !getGitHubIssueFromRefs(selectedTask.references) && (
              <button
                onClick={handleAssignToClaude}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
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

            {/* View Progress button - shown when task has a GitHub issue */}
            {(() => {
              const existingIssue = getGitHubIssueFromRefs(selectedTask.references);
              if (!existingIssue || claudeAssignment.status !== 'idle') return null;
              return (
                <a
                  href={existingIssue.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    border: `1px solid ${theme.colors.primary}`,
                    borderRadius: theme.radii[1],
                    background: 'transparent',
                    color: theme.colors.primary,
                    fontSize: theme.fontSizes[1],
                    fontWeight: theme.fontWeights.medium,
                    textDecoration: 'none',
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
                  title={`View issue #${existingIssue.number} on GitHub`}
                >
                  <Bot size={14} />
                  View Progress
                  <ExternalLink size={12} />
                </a>
              );
            })()}

            {/* Loading state */}
            {claudeAssignment.status === 'loading' && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
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
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
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
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
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
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[5],
            fontWeight: theme.fontWeights.bold,
            color: theme.colors.text,
            lineHeight: 1.3,
          }}
        >
          {selectedTask.title}
        </h1>

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

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            {/* Backdrop */}
            <div
              onClick={() => setIsDeleteModalOpen(false)}
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
              }}
            />

            {/* Modal */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: '400px',
                backgroundColor: theme.colors.background,
                borderRadius: theme.radii[3],
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderBottom: `1px solid ${theme.colors.border}`,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: theme.fontSizes[4],
                    fontWeight: 600,
                    color: theme.colors.text,
                  }}
                >
                  Delete Task?
                </h2>
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: theme.radii[1],
                    color: theme.colors.textMuted,
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '20px' }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: theme.fontSizes[2],
                    color: theme.colors.text,
                    lineHeight: 1.5,
                  }}
                >
                  Are you sure you want to delete <strong>"{selectedTask.title}"</strong>? This action cannot be undone.
                </p>

                {/* Error message */}
                {deleteState.status === 'error' && (
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '10px 12px',
                      backgroundColor: `${theme.colors.error}15`,
                      border: `1px solid ${theme.colors.error}`,
                      borderRadius: theme.radii[2],
                      color: theme.colors.error,
                      fontSize: theme.fontSizes[1],
                    }}
                  >
                    {deleteState.error || 'Failed to delete task'}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  padding: '16px 20px',
                  borderTop: `1px solid ${theme.colors.border}`,
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={deleteState.status === 'loading'}
                  style={{
                    padding: '10px 20px',
                    fontSize: theme.fontSizes[2],
                    fontWeight: 500,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radii[2],
                    backgroundColor: 'transparent',
                    color: theme.colors.text,
                    cursor: deleteState.status === 'loading' ? 'not-allowed' : 'pointer',
                    opacity: deleteState.status === 'loading' ? 0.5 : 1,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deleteState.status === 'loading'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    fontSize: theme.fontSizes[2],
                    fontWeight: 500,
                    border: 'none',
                    borderRadius: theme.radii[2],
                    backgroundColor: theme.colors.error,
                    color: theme.colors.background,
                    cursor: deleteState.status === 'loading' ? 'wait' : 'pointer',
                    opacity: deleteState.status === 'loading' ? 0.7 : 1,
                  }}
                >
                  {deleteState.status === 'loading' && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
                  Delete
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
