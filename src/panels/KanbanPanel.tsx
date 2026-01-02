import React, { useState, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
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
import { Kanban, AlertCircle, Plus, Search, X, Milestone as MilestoneIcon, RefreshCw } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import type { PanelComponentProps } from '../types';
import {
  useKanbanData,
  STATUS_DISPLAY_LABELS,
  type StatusColumn,
} from './kanban/hooks/useKanbanData';
import { KanbanColumn } from './kanban/components/KanbanColumn';
import { TaskCard } from './kanban/components/TaskCard';
import { EmptyState } from './kanban/components/EmptyState';
import { TaskModal } from './kanban/components/TaskModal';
import { useMilestoneData } from './milestone/hooks/useMilestoneData';
import { MilestoneCard } from './milestone/components/MilestoneCard';
import { MilestoneModal } from './milestone/components/MilestoneModal';
import { Core, type Task, type TaskCreateInput, type TaskUpdateInput, type Milestone, type MilestoneCreateInput, type MilestoneUpdateInput } from '@backlog-md/core';

type ViewMode = 'board' | 'milestones';

/**
 * KanbanPanel - A kanban board panel for visualizing Backlog.md tasks.
 *
 * This panel shows:
 * - Kanban board with configurable status columns
 * - Task cards with priority indicators
 * - Labels and assignee information
 */
export const KanbanPanel: React.FC<PanelComponentProps> = ({
  context,
  actions,
  events,
}) => {
  const { theme } = useTheme();
  const [_selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTab, setSelectedTab] = useState<StatusColumn>('todo');
  const [isNarrowView, setIsNarrowView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

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
    const container = containerRef.current;
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

  const {
    statusColumns,
    tasksByStatus,
    totalTasksState,
    loadMoreTasks,
    error,
    isBacklogProject,
    refreshData,
    moveTaskOptimistic,
    getTaskById,
    canWrite,
    core,
  } = useKanbanData({
    context,
    actions,
    tasksLimit: 20,
  });

  // Milestone data hook (always called to satisfy React hook rules)
  const {
    milestones,
    isLoading: isMilestonesLoading,
    error: milestonesError,
    toggleMilestone,
    refreshData: refreshMilestones,
    canWrite: canWriteMilestones,
    core: milestoneCore,
  } = useMilestoneData({
    context,
    actions,
  });

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

  // Drag event handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const task = getTaskById(active.id as string);
    if (task) {
      setActiveTask(task);
    }
  }, [getTaskById]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const targetColumn = over.id as StatusColumn;

    // Find current column for the task
    const task = getTaskById(taskId);
    if (!task) return;

    // Determine current column from task status
    const statusToColumn: Record<string, StatusColumn> = {
      'To Do': 'todo',
      'In Progress': 'in-progress',
      'Done': 'done',
    };
    const currentColumn = statusToColumn[task.status] || 'todo';

    // Only move if dropping in a different column
    if (currentColumn !== targetColumn) {
      moveTaskOptimistic(taskId, targetColumn);
    }
  }, [getTaskById, moveTaskOptimistic]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
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

  // Check if we can initialize (need file system adapter with write capability)
  const fileSystem = context.adapters?.fileSystem;
  const canInitialize = Boolean(
    fileSystem?.writeFile && fileSystem?.createDir && context.currentScope.repository?.path
  );

  // Initialize Backlog.md project
  const handleInitialize = useCallback(async () => {
    if (!fileSystem?.writeFile || !fileSystem?.createDir) {
      throw new Error('File system adapter not available');
    }

    const repoPath = context.currentScope.repository?.path;
    if (!repoPath) {
      throw new Error('Repository path not available');
    }

    // Create a minimal adapter for Core that wraps the panel's fileSystem
    // Only the methods used by initProject need real implementations
    const notImplemented = () => { throw new Error('Not implemented'); };
    const fsAdapter = {
      // Used by initProject
      exists: async (path: string) => {
        try {
          await fileSystem.readFile(path);
          return true;
        } catch {
          return false;
        }
      },
      writeFile: async (path: string, content: string) => { await fileSystem.writeFile(path, content); },
      createDir: async (path: string, _options?: { recursive?: boolean }) => { await fileSystem.createDir!(path); },
      join: (...paths: string[]) => paths.join('/').replace(/\/+/g, '/'),
      // Not used by initProject - stubs
      readFile: async (path: string) => fileSystem.readFile(path) as Promise<string>,
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
  }, [fileSystem, context.currentScope.repository, refreshData]);

  // Task modal handlers
  const handleOpenNewTask = useCallback(() => {
    setEditingTask(undefined);
    setIsTaskModalOpen(true);
  }, []);

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  }, []);

  const handleCloseTaskModal = useCallback(() => {
    setIsTaskModalOpen(false);
    setEditingTask(undefined);
  }, []);

  const handleSaveTask = useCallback(async (input: TaskCreateInput | TaskUpdateInput) => {
    if (!core) {
      throw new Error('Backlog not loaded');
    }

    if (editingTask) {
      // Update existing task
      await core.updateTask(editingTask.id, input as TaskUpdateInput);
    } else {
      // Create new task
      await core.createTask(input as TaskCreateInput);
    }

    // Refresh to show the new/updated task
    await refreshData();
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
    setSelectedTask(task);
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
  const availableStatuses = ['To Do', 'In Progress', 'Done'];

  // Determine which error to show based on view mode
  const currentError = viewMode === 'board' ? error : milestonesError;

  return (
    <div
      ref={containerRef}
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
          <Kanban size={24} color={theme.colors.primary} />
          <h2
            style={{
              margin: 0,
              fontSize: theme.fontSizes[4],
              color: theme.colors.text,
            }}
          >
            Kanban Board
          </h2>

          {/* View mode toggle */}
          {isBacklogProject && (
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

        {/* Search input - only show in board view */}
        {isBacklogProject && viewMode === 'board' && (
          <div
            style={{
              position: 'relative',
              flex: '1 1 200px',
              maxWidth: '300px',
              minWidth: '150px',
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
              onChange={(e) => setSearchQuery(e.target.value)}
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
                onClick={() => setSearchQuery('')}
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
        )}

        {/* Header actions - view-dependent */}
        {isBacklogProject && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {viewMode === 'board' ? (
              <>
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

                {/* Load more tasks button */}
                {totalTasksState.hasMore && (
                  <button
                    onClick={loadMoreTasks}
                    disabled={totalTasksState.isLoadingMore}
                    style={{
                      background: theme.colors.backgroundSecondary,
                      color: theme.colors.text,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radii[2],
                      padding: '6px 12px',
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
              </>
            ) : (
              <>
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
                    onClick={() => setSelectedTab(status)}
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
                    {STATUS_DISPLAY_LABELS[status]}
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
                      status={STATUS_DISPLAY_LABELS[status]}
                      tasks={columnTasks}
                      onTaskClick={handleTaskClick}
                      fullWidth={isNarrowView}
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
      ) : (
        /* Milestones View */
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
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
                  onTaskClick={handleMilestoneTaskClick}
                />
              ))}
            </div>
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
        availableStatuses={availableStatuses}
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
