import React, { useState, useCallback, useRef, useLayoutEffect, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { AlertCircle, Plus, Search, X, Milestone as MilestoneIcon, RefreshCw } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import { usePanelFocusListener } from '@principal-ade/panel-layouts';
import type { KanbanPanelPropsTyped } from '../types';
import {
  useKanbanData,
  type StatusColumn,
} from './kanban/hooks/useKanbanData';
import { KanbanColumn } from './kanban/components/KanbanColumn';
import { TaskCard } from './kanban/components/TaskCard';
import { EmptyState } from './kanban/components/EmptyState';
import { BoardEmptyState } from './kanban/components/BoardEmptyState';
import { TaskModal } from './kanban/components/TaskModal';
import { useMilestoneData } from './milestone/hooks/useMilestoneData';
import { MilestoneModal } from './milestone/components/MilestoneModal';
import { Core, type Task, type TaskCreateInput, type TaskUpdateInput, type Milestone, type MilestoneCreateInput, type MilestoneUpdateInput, DEFAULT_TASK_STATUSES } from '@backlog-md/core';
import { getTracer, getActiveSpan, withSpan, SpanStatusCode } from '../telemetry';

type ViewMode = 'board' | 'milestones';

/**
 * KanbanPanel - A kanban board panel for visualizing Backlog.md tasks.
 *
 * This panel shows:
 * - Kanban board with configurable status columns
 * - Task cards with priority indicators
 * - Labels and assignee information
 */
export const KanbanPanel: React.FC<KanbanPanelPropsTyped> = ({
  context,
  actions,
  events,
}) => {
  const { theme } = useTheme();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<StatusColumn>(DEFAULT_TASK_STATUSES.TODO);
  const [isNarrowView, setIsNarrowView] = useState(false);
  const kanbanPanelRef = useRef<HTMLDivElement>(null);

  // View mode state (board vs milestones)
  const [viewMode, setViewMode] = useState<ViewMode>('board');

  // Drag-and-drop state
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Task modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  // Milestone modal state
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | undefined>(undefined);
  const [isRefreshingMilestones, setIsRefreshingMilestones] = useState(false);

  // Selected milestone for detail view
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);

  // Milestone task status filter (null = show all)
  const [milestoneStatusFilter, setMilestoneStatusFilter] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  // Debounce timer for search telemetry
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Emit panel.initialized on mount
  useEffect(() => {
    const tracer = getTracer();
    const span = tracer.startSpan('panel.lifecycle', {
      attributes: {
        'panel.id': 'kanban-panel',
      },
    });
    span.addEvent('panel.initialized', {
      'panel.id': 'kanban-panel',
      'has.file.tree': Boolean(context?.fileTree?.data),
      'has.file.system': Boolean(actions?.writeFile),
    });
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Search handler with telemetry
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);

    // Debounce telemetry to avoid spam on every keystroke
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      if (value.trim()) {
        const tracer = getTracer();
        const span = tracer.startSpan('board.interaction', {
          attributes: {
            'search.query': value.trim(),
          },
        });
        span.addEvent('search.performed', {
          'search.query': value.trim(),
        });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
      }
    }, 500);
  }, []);

  // Clear search handler with telemetry
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    const tracer = getTracer();
    const span = tracer.startSpan('board.interaction');
    span.addEvent('filter.cleared');
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  }, []);

  // Tab/column selection handler with telemetry
  const handleTabSelect = useCallback((status: StatusColumn) => {
    const previousTab = selectedTab;
    setSelectedTab(status);

    const tracer = getTracer();
    const span = tracer.startSpan('board.interaction', {
      attributes: {
        'column.selected': status,
        'column.previous': previousTab,
      },
    });
    span.addEvent('column.selected', {
      'column.status': status,
      'column.previous': previousTab,
    });
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  }, [selectedTab]);

  // Configure sensors for drag detection
  // PointerSensor requires a small drag distance before activating
  // to allow clicks to work properly
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    })
  );

  // Measuring configuration to prevent layout shifts during drag
  const measuringConfig = {
    droppable: {
      strategy: MeasuringStrategy.Always,
    },
  };

  // Detect narrow viewport using ResizeObserver
  useLayoutEffect(() => {
    const container = kanbanPanelRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Switch to tabs when width is less than 768px
        setIsNarrowView(entry.contentRect.width < 768);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Listen for panel focus events
  usePanelFocusListener(
    'backlog-kanban',
    events,
    () => kanbanPanelRef.current?.focus()
  );

  // Subscribe to task:selected events from other panels
  useEffect(() => {
    if (!events) return;

    const unsubscribe = events.on('task:selected', (event) => {
      const payload = event.payload as { taskId?: string };
      if (payload?.taskId) {
        setSelectedTaskId(payload.taskId);
      }
    });

    return unsubscribe;
  }, [events]);

  const {
    statusColumns,
    tasksByStatus,
    totalTasksState,
    loadMoreTasks,
    error,
    isLoading,
    isBacklogProject,
    refreshData,
    moveTaskOptimistic,
    getTaskById,
    canWrite,
    core,
  } = useKanbanData({
    context,
    actions,
    events,
    tasksLimit: 20,
  });

  // Milestone data hook (always called to satisfy React hook rules)
  const {
    milestones,
    isLoading: isMilestonesLoading,
    error: milestonesError,
    refreshData: refreshMilestones,
    canWrite: canWriteMilestones,
    core: milestoneCore,
  } = useMilestoneData({
    context,
    actions,
  });

  // Track ref to emit kanban.skipped only once
  const hasEmittedSkipped = useRef(false);

  // Emit kanban.skipped when not a backlog project
  useEffect(() => {
    if (!isLoading && !isBacklogProject && !hasEmittedSkipped.current) {
      hasEmittedSkipped.current = true;
      const tracer = getTracer();
      const span = tracer.startSpan('board.interaction', {
        attributes: { 'is.backlog.project': false },
      });
      span.addEvent('kanban.skipped', {
        'reason': 'not_backlog_project',
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    }
    // Reset when project status changes (e.g., after initialization)
    if (isBacklogProject) {
      hasEmittedSkipped.current = false;
    }
  }, [isLoading, isBacklogProject]);

  // Filter tasks by search query
  const filteredTasksByStatus = useMemo(() => {
    if (!searchQuery.trim()) {
      return tasksByStatus;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = new Map<StatusColumn, { tasks: Task[]; count: number }>();

    for (const [status, state] of tasksByStatus) {
      const filteredTasks = state.tasks.filter((task) => {
        // Search in title
        if (task.title.toLowerCase().includes(query)) return true;
        // Search in description
        if (task.description?.toLowerCase().includes(query)) return true;
        // Search in labels
        if (task.labels?.some((label) => label.toLowerCase().includes(query))) return true;
        // Search in assignees
        if (task.assignee?.some((a) => a.toLowerCase().includes(query))) return true;
        // Search in milestone
        if (task.milestone?.toLowerCase().includes(query)) return true;
        return false;
      });
      filtered.set(status, { tasks: filteredTasks, count: filteredTasks.length });
    }

    return filtered;
  }, [tasksByStatus, searchQuery]);

  // Track active drag span for context propagation
  const dragSpanRef = useRef<ReturnType<ReturnType<typeof getTracer>['startSpan']> | null>(null);

  // Drag event handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const task = getTaskById(active.id as string);
    if (task) {
      setActiveTask(task);

      // Start a span for the drag operation
      const tracer = getTracer();
      const span = tracer.startSpan('task.edit', {
        attributes: {
          'input.taskId': task.id,
          'input.fromStatus': task.status || 'unknown',
        },
      });
      dragSpanRef.current = span;

      // Emit drag started event
      span.addEvent('task.drag.started', {
        'task.id': task.id,
        'from.status': task.status || 'unknown',
      });
    }
  }, [getTaskById]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    const span = dragSpanRef.current;

    setActiveTask(null);

    if (!over) {
      // Drag was cancelled (dropped outside valid target)
      if (span) {
        span.addEvent('task.drag.cancelled');
        span.setAttributes({ 'output.cancelled': true });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        dragSpanRef.current = null;
      }
      return;
    }

    const taskId = active.id as string;
    const targetColumn = over.id as StatusColumn;

    // Find current column for the task
    const task = getTaskById(taskId);
    if (!task) {
      if (span) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Task not found' });
        span.end();
        dragSpanRef.current = null;
      }
      return;
    }

    // Current column IS the task status (no mapping needed)
    const currentColumn = task.status || DEFAULT_TASK_STATUSES.TODO;

    // Only move if dropping in a different column
    if (currentColumn !== targetColumn) {
      // moveTaskOptimistic will emit task.moved event using the active span
      if (span) {
        // Set the span in context for moveTaskOptimistic to use
        withSpan(span, async () => {
          moveTaskOptimistic(taskId, targetColumn);
        });
        span.setAttributes({
          'output.toStatus': targetColumn,
          'output.moved': true,
        });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        dragSpanRef.current = null;
      } else {
        moveTaskOptimistic(taskId, targetColumn);
      }
    } else {
      // Dropped in same column - effectively cancelled
      if (span) {
        span.addEvent('task.drag.cancelled');
        span.setAttributes({ 'output.cancelled': true, 'output.reason': 'same_column' });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        dragSpanRef.current = null;
      }
    }
  }, [getTaskById, moveTaskOptimistic]);

  const handleTaskClick = (task: Task) => {
    setSelectedTaskId(task.id);

    // Emit telemetry event with its own span
    const tracer = getTracer();
    const span = tracer.startSpan('board.interaction', {
      attributes: {
        'task.id': task.id,
        'task.status': task.status || 'unknown',
      },
    });
    span.addEvent('task.selected', {
      'task.id': task.id,
      'task.status': task.status || 'unknown',
    });
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();

    // Emit task:selected event for other panels (e.g., TaskDetailPanel)
    if (events) {
      events.emit({
        type: 'task:selected',
        source: 'kanban-panel',
        timestamp: Date.now(),
        payload: { taskId: task.id, task },
      });
    }
  };

  // Check if we can initialize (need file operations on actions)
  const canInitialize = Boolean(
    actions.writeFile && actions.createDir && context.currentScope.repository?.path
  );

  // Initialize Backlog.md project
  const handleInitialize = useCallback(async () => {
    if (!actions.writeFile || !actions.createDir) {
      throw new Error('File operations not available on actions');
    }

    const repoPath = context.currentScope.repository?.path;
    if (!repoPath) {
      throw new Error('Repository path not available');
    }

    // Create a minimal adapter for Core that wraps actions
    // Only the methods used by initProject need real implementations
    const notImplemented = () => { throw new Error('Not implemented'); };
    const fsAdapter = {
      // Used by initProject
      exists: async (path: string) => {
        if (actions.exists) {
          return actions.exists(path);
        }
        // Fallback: try to read and catch error
        try {
          await actions.readFile?.(path);
          return true;
        } catch {
          return false;
        }
      },
      writeFile: async (path: string, content: string) => { await actions.writeFile!(path, content); },
      createDir: async (path: string, _options?: { recursive?: boolean }) => { await actions.createDir!(path); },
      join: (...paths: string[]) => paths.join('/').replace(/\/+/g, '/'),
      // Not used by initProject - stubs
      readFile: async (path: string) => actions.readFile?.(path) ?? Promise.reject(new Error('readFile not available')),
      deleteFile: async () => notImplemented(),
      readDir: async () => [] as string[],
      isDirectory: async () => false,
      rename: async () => notImplemented(),
      stat: async () => ({ mtime: new Date(), isDirectory: false, size: 0 }),
      dirname: (path: string) => path.split('/').slice(0, -1).join('/') || '/',
      basename: (path: string) => path.split('/').pop() || '',
      extname: (path: string) => {
        const base = path.split('/').pop() || '';
        const dot = base.lastIndexOf('.');
        return dot > 0 ? base.slice(dot) : '';
      },
      relative: (_from: string, to: string) => to,
      isAbsolute: (path: string) => path.startsWith('/'),
      normalize: (path: string) => path.replace(/\/+/g, '/'),
      homedir: () => '/',
    };

    const core = new Core({
      projectRoot: repoPath,
      adapters: { fs: fsAdapter },
    });

    // Get project name from repo
    const projectName = context.currentScope.repository?.name || 'Backlog';

    await core.initProject({ projectName });

    // Refresh to pick up the new project
    await refreshData();
  }, [actions, context.currentScope.repository, refreshData]);

  // Track if a save was completed (to distinguish cancel from save+close)
  const taskSaveCompletedRef = useRef(false);
  // Track the active task modal span
  const taskModalSpanRef = useRef<ReturnType<ReturnType<typeof getTracer>['startSpan']> | null>(null);

  // Task modal handlers
  const handleOpenNewTask = useCallback(() => {
    setEditingTask(undefined);
    setIsTaskModalOpen(true);
    taskSaveCompletedRef.current = false;

    // Start a span for the task create operation
    const tracer = getTracer();
    const span = tracer.startSpan('task.create');
    taskModalSpanRef.current = span;

    // Emit modal opened event
    span.addEvent('modal.opened', {
      'modal.type': 'task',
      'modal.mode': 'create',
    });
  }, []);

  const handleCloseTaskModal = useCallback(() => {
    const span = taskModalSpanRef.current;

    // If save was not completed, this is a cancel
    if (!taskSaveCompletedRef.current && span) {
      span.addEvent('modal.cancelled', {
        'had.changes': false, // We don't track dirty state yet
      });
      span.setAttributes({ 'output.cancelled': true });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    }

    setIsTaskModalOpen(false);
    setEditingTask(undefined);
    taskModalSpanRef.current = null;
  }, []);

  const handleSaveTask = useCallback(async (input: TaskCreateInput | TaskUpdateInput) => {
    if (!core) {
      throw new Error('Backlog not loaded');
    }

    const span = taskModalSpanRef.current;
    const isEditing = !!editingTask;

    try {
      if (isEditing) {
        // Update existing task
        await core.updateTask(editingTask.id, input as TaskUpdateInput);

        // Emit task updated event
        span?.addEvent('task.updated', {
          'task.id': editingTask.id,
          'updated.fields': Object.keys(input).join(', '),
        });
      } else {
        // Create new task
        const newTask = await core.createTask(input as TaskCreateInput);

        // Emit task created event
        span?.addEvent('task.created', {
          'task.id': newTask?.id || 'unknown',
          'task.status': (input as TaskCreateInput).status || 'To Do',
        });
      }

      taskSaveCompletedRef.current = true;

      // Complete the span
      if (span) {
        span.setAttributes({
          'output.success': true,
          'output.operation': isEditing ? 'update' : 'create',
        });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        taskModalSpanRef.current = null;
      }

      // Refresh to show the new/updated task
      await refreshData();
    } catch (err) {
      // Emit error event
      const errorMessage = err instanceof Error ? err.message : 'Failed to save task';
      span?.addEvent('task.save.error', {
        'error.type': err instanceof Error ? err.name : 'Unknown',
        'error.message': errorMessage,
      });
      span?.recordException(err as Error);
      span?.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });

      throw err; // Re-throw so TaskModal can show the error
    }
  }, [core, editingTask, refreshData]);

  // Milestone modal handlers
  const handleOpenNewMilestone = useCallback(() => {
    setEditingMilestone(undefined);
    setIsMilestoneModalOpen(true);
  }, []);

  const handleCloseMilestoneModal = useCallback(() => {
    setIsMilestoneModalOpen(false);
    setEditingMilestone(undefined);
  }, []);

  const handleSaveMilestone = useCallback(async (input: MilestoneCreateInput | MilestoneUpdateInput) => {
    if (!milestoneCore) {
      throw new Error('Backlog not loaded');
    }

    if (editingMilestone) {
      await milestoneCore.updateMilestone(editingMilestone.id, input as MilestoneUpdateInput);
    } else {
      await milestoneCore.createMilestone(input as MilestoneCreateInput);
    }

    await refreshMilestones();
  }, [milestoneCore, editingMilestone, refreshMilestones]);

  const handleRefreshMilestones = async () => {
    setIsRefreshingMilestones(true);
    try {
      await refreshMilestones();
    } finally {
      setIsRefreshingMilestones(false);
    }
  };

  const handleMilestoneTaskClick = (task: Task) => {
    setSelectedTaskId(task.id);
    if (events) {
      events.emit({
        type: 'task:selected',
        source: 'kanban-panel',
        timestamp: Date.now(),
        payload: { taskId: task.id, task },
      });
    }
  };

  // Get available statuses and milestones for task modal
  const availableStatuses = [
    DEFAULT_TASK_STATUSES.TODO,
    DEFAULT_TASK_STATUSES.IN_PROGRESS,
    DEFAULT_TASK_STATUSES.DONE
  ];

  // Determine which error to show based on view mode
  const currentError = viewMode === 'board' ? error : milestonesError;

  return (
    <div
      ref={kanbanPanelRef}
      tabIndex={-1}
      style={{
        padding: 'clamp(12px, 3vw, 20px)', // Responsive padding for mobile
        fontFamily: theme.fonts.body,
        height: '100%',
        boxSizing: 'border-box', // Include padding in height calculation
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflow: 'hidden', // Prevent outer scrolling
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        outline: 'none', // Remove default focus outline
      }}
    >
      {/* Header */}
      <div
        style={{
          flexShrink: 0, // Don't shrink header
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2
            style={{
              margin: 0,
              fontSize: theme.fontSizes[4],
              color: theme.colors.text,
            }}
          >
            <a
              href="https://github.com/MrLesk/Backlog.md"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'inherit',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              Backlog.md
            </a>
          </h2>

          {/* View mode toggle - only show when there are tasks */}
          {isBacklogProject && totalTasksState.total > 0 && (
            <div
              style={{
                display: 'flex',
                background: theme.colors.backgroundSecondary,
                borderRadius: theme.radii[2],
                padding: '3px',
                gap: '2px',
              }}
            >
              <button
                onClick={() => setViewMode('board')}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: theme.radii[1],
                  background: viewMode === 'board' ? theme.colors.primary : 'transparent',
                  color: viewMode === 'board' ? theme.colors.textOnPrimary : theme.colors.textSecondary,
                  fontSize: theme.fontSizes[1],
                  fontWeight: theme.fontWeights.medium,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                Board
              </button>
              <button
                onClick={() => setViewMode('milestones')}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: theme.radii[1],
                  background: viewMode === 'milestones' ? theme.colors.primary : 'transparent',
                  color: viewMode === 'milestones' ? theme.colors.textOnPrimary : theme.colors.textSecondary,
                  fontSize: theme.fontSizes[1],
                  fontWeight: theme.fontWeights.medium,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                Milestones
              </button>
            </div>
          )}
        </div>

        {/* Header actions - view-dependent, only show when there are tasks */}
        {isBacklogProject && totalTasksState.total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {viewMode === 'board' ? (
              <>
                {/* Search toggle button */}
                <button
                  onClick={() => {
                    const newVisible = !isSearchVisible;
                    setIsSearchVisible(newVisible);
                    if (!newVisible) {
                      setSearchQuery('');
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isSearchVisible ? theme.colors.primary : theme.colors.backgroundSecondary,
                    color: isSearchVisible ? theme.colors.textOnPrimary : theme.colors.textSecondary,
                    border: isSearchVisible ? 'none' : `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radii[2],
                    padding: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  title={isSearchVisible ? 'Hide search' : 'Search tasks'}
                >
                  <Search size={16} />
                </button>

                {/* Add Task button - only shown when write operations are available */}
                {canWrite && (
                  <button
                    onClick={handleOpenNewTask}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: theme.colors.primary,
                      color: theme.colors.textOnPrimary,
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
                    Add Task
                  </button>
                )}
              </>
            ) : (
              <>
                {/* Add Task button - enabled when milestone selected */}
                {canWrite && (
                  <button
                    onClick={handleOpenNewTask}
                    disabled={!selectedMilestoneId}
                    title={selectedMilestoneId ? 'Add task to milestone' : 'Select a milestone first'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: selectedMilestoneId ? theme.colors.primary : theme.colors.backgroundSecondary,
                      color: selectedMilestoneId ? theme.colors.textOnPrimary : theme.colors.textMuted,
                      border: selectedMilestoneId ? 'none' : `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radii[2],
                      padding: '6px 12px',
                      fontSize: theme.fontSizes[1],
                      fontWeight: theme.fontWeights.medium,
                      cursor: selectedMilestoneId ? 'pointer' : 'not-allowed',
                      opacity: selectedMilestoneId ? 1 : 0.6,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Plus size={14} />
                    Add Task
                  </button>
                )}

                {/* Add Milestone button */}
                {canWriteMilestones && (
                  <button
                    onClick={handleOpenNewMilestone}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: theme.colors.primary,
                      color: theme.colors.textOnPrimary,
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
                  onClick={handleRefreshMilestones}
                  disabled={isRefreshingMilestones || isMilestonesLoading}
                  style={{
                    background: theme.colors.backgroundSecondary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radii[1],
                    padding: '6px',
                    cursor: isRefreshingMilestones ? 'wait' : 'pointer',
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
                      animation: isRefreshingMilestones ? 'spin 1s linear infinite' : 'none',
                    }}
                  />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Search bar row - only show in board view when there are tasks and search is visible */}
      {isBacklogProject && viewMode === 'board' && totalTasksState.total > 0 && isSearchVisible && (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              position: 'relative',
              flex: 1,
            }}
          >
            <Search
              size={16}
              color={theme.colors.textSecondary}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 32px 8px 32px',
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts.body,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radii[2],
                background: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme.colors.textSecondary,
                }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Load more tasks button */}
          {totalTasksState.hasMore && (
            <button
              onClick={loadMoreTasks}
              disabled={totalTasksState.isLoadingMore}
              style={{
                flexShrink: 0,
                background: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radii[2],
                padding: '8px 12px',
                fontSize: theme.fontSizes[1],
                fontWeight: theme.fontWeights.medium,
                cursor: totalTasksState.isLoadingMore ? 'wait' : 'pointer',
                opacity: totalTasksState.isLoadingMore ? 0.7 : 1,
                transition: 'opacity 0.2s ease',
              }}
            >
              {totalTasksState.isLoadingMore
                ? 'Loading...'
                : `Load more (${totalTasksState.total - totalTasksState.loaded} remaining)`}
            </button>
          )}
        </div>
      )}

      {/* Error Message */}
      {currentError && (
        <div
          style={{
            flexShrink: 0, // Don't shrink error message
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
          <span>{currentError}</span>
        </div>
      )}

      {/* Content Container or Empty State */}
      {!isBacklogProject ? (
        <EmptyState
          canInitialize={canInitialize}
          onInitialize={handleInitialize}
        />
      ) : viewMode === 'board' ? (
        !isLoading && totalTasksState.total === 0 ? (
          <BoardEmptyState
            onAddTask={handleOpenNewTask}
            onAddMilestone={handleOpenNewMilestone}
            canWrite={canWrite}
          />
        ) : (
          <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          measuring={measuringConfig}
        >
          {/* Flex wrapper to maintain layout - DndContext is just a provider */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              gap: '16px',
            }}
          >
            {/* Tab bar for narrow screens */}
            {isNarrowView && (
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                gap: '4px',
                background: theme.colors.backgroundSecondary,
                borderRadius: theme.radii[2],
                padding: '4px',
              }}
            >
              {statusColumns.map((status) => {
                const isSelected = status === selectedTab;
                const statusState = filteredTasksByStatus.get(status);
                const count = statusState?.count || 0;
                return (
                  <button
                    key={status}
                    onClick={() => handleTabSelect(status)}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      border: 'none',
                      borderRadius: theme.radii[1],
                      background: isSelected ? theme.colors.primary : 'transparent',
                      color: isSelected ? theme.colors.textOnPrimary : theme.colors.textSecondary,
                      fontSize: theme.fontSizes[1],
                      fontWeight: theme.fontWeights.medium,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    {status}
                    <span
                      style={{
                        background: isSelected ? 'rgba(255,255,255,0.2)' : theme.colors.background,
                        padding: '2px 6px',
                        borderRadius: theme.radii[1],
                        fontSize: theme.fontSizes[0],
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Columns scroll container */}
          <div
            style={{
              flex: '1 1 0',
              display: 'flex',
              overflowX: isNarrowView ? 'hidden' : 'auto',
              overflowY: 'hidden',
              minHeight: 0, // Allow flex child to shrink below content size
              WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
            }}
          >
            {/* Inner flex container for columns */}
            <div
              style={{
                display: 'flex',
                gap: '16px',
                width: '100%',
                paddingBottom: '8px',
                alignItems: 'stretch',
              }}
            >
              {statusColumns
                .filter((status) => !isNarrowView || status === selectedTab)
                .map((status) => {
                  const statusState = filteredTasksByStatus.get(status);
                  const columnTasks = statusState?.tasks || [];
                  return (
                    <KanbanColumn
                      key={status}
                      columnId={status}
                      status={status}
                      tasks={columnTasks}
                      onTaskClick={handleTaskClick}
                      fullWidth={isNarrowView}
                      selectedTaskId={selectedTaskId}
                    />
                  );
                })}
            </div>
          </div>
          </div>

          {/* Drag overlay - rendered in portal to avoid layout shifts */}
          {typeof document !== 'undefined' &&
            createPortal(
              <DragOverlay
                dropAnimation={{
                  duration: 200,
                  easing: 'ease',
                }}
              >
                {activeTask ? (
                  <TaskCard task={activeTask} isDragOverlay />
                ) : null}
              </DragOverlay>,
              document.body
            )}
        </DndContext>
        )
      ) : (
        /* Milestones View - Two Column Layout */
        <div
          style={{
            flex: 1,
            display: 'flex',
            gap: '16px',
            overflow: 'hidden',
          }}
        >
          {isMilestonesLoading ? (
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
            <>
              {/* Left Column - Milestone List */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    paddingRight: '4px',
                  }}
                >
                  {milestones.map((milestoneState) => {
                    const isSelected = selectedMilestoneId === milestoneState.milestone.id;
                    const totalTasks = milestoneState.milestone.tasks.length;
                    const doneTasks = milestoneState.tasks.filter(
                      (t) => t.status?.toLowerCase().includes('done') || t.status?.toLowerCase().includes('complete')
                    ).length;
                    const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
                    const showProgress = milestoneState.tasks.length > 0 || totalTasks === 0;

                    return (
                      <div
                        key={milestoneState.milestone.id}
                        onClick={() => {
                          setSelectedMilestoneId(milestoneState.milestone.id);
                          setMilestoneStatusFilter(null); // Reset filter when switching milestones
                        }}
                        style={{
                          padding: '12px 16px',
                          background: isSelected ? theme.colors.primary + '15' : theme.colors.surface,
                          border: `1px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
                          borderRadius: theme.radii[2],
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                          <h3
                            style={{
                              margin: 0,
                              fontSize: theme.fontSizes[2],
                              fontWeight: theme.fontWeights.semibold,
                              color: theme.colors.text,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {milestoneState.milestone.title}
                          </h3>
                          <span
                            style={{
                              fontSize: theme.fontSizes[1],
                              color: theme.colors.textSecondary,
                              background: theme.colors.backgroundSecondary,
                              padding: '2px 8px',
                              borderRadius: theme.radii[1],
                              flexShrink: 0,
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
                        {isSelected && milestoneState.milestone.description && (
                          <p
                            style={{
                              margin: '8px 0 0 0',
                              fontSize: theme.fontSizes[1],
                              color: theme.colors.textSecondary,
                              lineHeight: '1.4',
                            }}
                          >
                            {milestoneState.milestone.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column - Tasks for Selected Milestone */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  background: theme.colors.surface,
                  borderRadius: theme.radii[2],
                  border: `1px solid ${theme.colors.border}`,
                  overflow: 'hidden',
                }}
              >
                {(() => {
                  const selectedMilestone = milestones.find((m) => m.milestone.id === selectedMilestoneId);
                  if (!selectedMilestone) {
                    return (
                      <div
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          color: theme.colors.textMuted,
                          padding: '24px',
                        }}
                      >
                        <MilestoneIcon size={32} color={theme.colors.border} />
                        <span style={{ fontSize: theme.fontSizes[1] }}>Select a milestone to view tasks</span>
                      </div>
                    );
                  }

                  const tasks = selectedMilestone.tasks;
                  const getPriorityColor = (priority?: string) => {
                    switch (priority) {
                      case 'high': return theme.colors.error;
                      case 'medium': return theme.colors.warning;
                      case 'low': return theme.colors.info;
                      default: return theme.colors.border;
                    }
                  };

                  // Calculate status breakdown
                  const todoCount = tasks.filter((t) => t.status === 'To Do').length;
                  const inProgressCount = tasks.filter((t) => t.status === 'In Progress').length;
                  const doneCount = tasks.filter((t) =>
                    t.status?.toLowerCase().includes('done') || t.status?.toLowerCase().includes('complete')
                  ).length;

                  // Filter tasks based on selected status filter
                  const filteredTasks = milestoneStatusFilter
                    ? tasks.filter((t) => {
                        if (milestoneStatusFilter === 'Done') {
                          return t.status?.toLowerCase().includes('done') || t.status?.toLowerCase().includes('complete');
                        }
                        return t.status === milestoneStatusFilter;
                      })
                    : tasks;

                  // Status filter button styles
                  const getFilterButtonStyle = (status: string, count: number, color: string) => {
                    const isActive = milestoneStatusFilter === status;
                    return {
                      flex: 1,
                      padding: '8px 12px',
                      border: 'none',
                      borderBottom: isActive ? `2px solid ${color}` : '2px solid transparent',
                      background: isActive ? `${color}15` : 'transparent',
                      color: isActive ? color : theme.colors.textSecondary,
                      fontSize: theme.fontSizes[1],
                      fontWeight: isActive ? theme.fontWeights.medium : theme.fontWeights.body,
                      cursor: count > 0 ? 'pointer' : 'default',
                      transition: 'all 0.2s ease',
                      textAlign: 'center' as const,
                      opacity: count === 0 ? 0.5 : 1,
                    };
                  };

                  const handleFilterClick = (status: string, count: number) => {
                    if (count === 0) return;
                    setMilestoneStatusFilter(milestoneStatusFilter === status ? null : status);
                  };

                  return (
                    <>
                      <div
                        style={{
                          borderBottom: `1px solid ${theme.colors.border}`,
                          background: theme.colors.backgroundSecondary,
                          display: 'flex',
                        }}
                      >
                        <button
                          onClick={() => handleFilterClick('To Do', todoCount)}
                          style={getFilterButtonStyle('To Do', todoCount, theme.colors.textSecondary)}
                        >
                          {todoCount} To Do
                        </button>
                        <button
                          onClick={() => handleFilterClick('In Progress', inProgressCount)}
                          style={getFilterButtonStyle('In Progress', inProgressCount, theme.colors.warning)}
                        >
                          {inProgressCount} In Progress
                        </button>
                        <button
                          onClick={() => handleFilterClick('Done', doneCount)}
                          style={getFilterButtonStyle('Done', doneCount, theme.colors.success)}
                        >
                          {doneCount} Done
                        </button>
                      </div>
                      <div
                        style={{
                          flex: 1,
                          overflowY: 'auto',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        {filteredTasks.length === 0 ? (
                          <div
                            style={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: theme.colors.textMuted,
                              fontSize: theme.fontSizes[1],
                            }}
                          >
                            {milestoneStatusFilter ? `No ${milestoneStatusFilter.toLowerCase()} tasks` : 'No tasks in this milestone'}
                          </div>
                        ) : (
                          filteredTasks.map((task) => (
                            <div
                              key={task.id}
                              onClick={() => handleMilestoneTaskClick(task)}
                              style={{
                                padding: '10px 12px',
                                background: selectedTaskId === task.id ? `${theme.colors.primary}10` : theme.colors.background,
                                border: `1px solid ${selectedTaskId === task.id ? theme.colors.primary : theme.colors.border}`,
                                borderLeft: `3px solid ${getPriorityColor(task.priority)}`,
                                borderRadius: theme.radii[1],
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '12px',
                                ...(selectedTaskId === task.id && {
                                  boxShadow: `0 0 0 1px ${theme.colors.primary}`,
                                }),
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
                                  color: task.status?.toLowerCase().includes('done')
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
                          ))
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      )}

      {/* Task Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={handleCloseTaskModal}
        onSave={handleSaveTask}
        task={editingTask}
        defaultStatus="To Do"
        defaultMilestone={viewMode === 'milestones' ? selectedMilestoneId || '' : ''}
        availableStatuses={availableStatuses}
        availableMilestones={milestones.map((m) => ({ id: m.milestone.id, title: m.milestone.title }))}
      />

      {/* Milestone Modal */}
      <MilestoneModal
        isOpen={isMilestoneModalOpen}
        onClose={handleCloseMilestoneModal}
        onSave={handleSaveMilestone}
        milestone={editingMilestone}
      />

      {/* Spinner animation for refresh button */}
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
