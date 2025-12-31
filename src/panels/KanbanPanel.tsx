import React, { useState, useCallback, useRef, useLayoutEffect } from 'react';
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
import { Kanban, AlertCircle, Plus } from 'lucide-react';
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
import { Core, type Task, type TaskCreateInput, type TaskUpdateInput } from '@backlog-md/core';

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

  // Drag-and-drop state
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Task modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

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
    columnStates,
    loadMore,
    activeTasksState,
    loadMoreActive,
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
    completedLimit: 5,
  });

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
      'Done': 'completed',
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

  // Get available statuses and milestones for task modal
  const availableStatuses = ['To Do', 'In Progress', 'Done'];

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
        </div>

        {/* Status counts and Load more active button */}
        {isBacklogProject && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {/* Status counts - hidden in narrow view since tabs show counts */}
            {!isNarrowView && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {statusColumns.map((status) => {
                  const statusState = tasksByStatus.get(status);
                  const count = statusState?.count || 0;
                  // For completed, show loaded/total
                  const completedState = columnStates.get('completed');
                  const displayCount = status === 'completed' && completedState
                    ? `${count}/${completedState.total}`
                    : count;
                  return (
                    <span
                      key={status}
                      style={{
                        fontSize: theme.fontSizes[1],
                        color: theme.colors.textSecondary,
                        background: theme.colors.backgroundSecondary,
                        padding: '4px 10px',
                        borderRadius: theme.radii[1],
                        fontWeight: theme.fontWeights.medium,
                      }}
                    >
                      {STATUS_DISPLAY_LABELS[status]}: {displayCount}
                    </span>
                  );
                })}
              </div>
            )}

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

            {/* Load more active button */}
            {activeTasksState.hasMore && (
              <button
                onClick={loadMoreActive}
                disabled={activeTasksState.isLoadingMore}
                style={{
                  background: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radii[2],
                  padding: '6px 12px',
                  fontSize: theme.fontSizes[1],
                  fontWeight: theme.fontWeights.medium,
                  cursor: activeTasksState.isLoadingMore ? 'wait' : 'pointer',
                  opacity: activeTasksState.isLoadingMore ? 0.7 : 1,
                  transition: 'opacity 0.2s ease',
                }}
              >
                {activeTasksState.isLoadingMore
                  ? 'Loading...'
                  : `Load more active (${activeTasksState.total - activeTasksState.loaded} remaining)`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
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
          <span>{error}</span>
        </div>
      )}

      {/* Board Container or Empty State */}
      {!isBacklogProject ? (
        <EmptyState
          canInitialize={canInitialize}
          onInitialize={handleInitialize}
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
                const statusState = tasksByStatus.get(status);
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
            {/* Inner flex container for columns - uses margin auto for centering */}
            <div
              style={{
                display: 'flex',
                gap: '16px',
                flex: '1 0 auto',
                paddingBottom: '8px',
                minWidth: '100%',
                alignItems: 'stretch',
              }}
            >
              {statusColumns
                .filter((status) => !isNarrowView || status === selectedTab)
                .map((status) => {
                  const statusState = tasksByStatus.get(status);
                  const columnTasks = statusState?.tasks || [];
                  // Only completed column has its own load more
                  const isCompleted = status === 'completed';
                  const completedState = columnStates.get('completed');
                  return (
                    <KanbanColumn
                      key={status}
                      columnId={status}
                      status={STATUS_DISPLAY_LABELS[status]}
                      tasks={columnTasks}
                      total={isCompleted ? completedState?.total : undefined}
                      hasMore={isCompleted ? completedState?.hasMore : false}
                      isLoadingMore={isCompleted ? completedState?.isLoadingMore : false}
                      onLoadMore={isCompleted ? () => loadMore('completed') : undefined}
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
    </div>
  );
};
