/**
 * BacklogAdapter
 *
 * Provides a clean interface for accessing Backlog.md data from a repository.
 * Encapsulates all Backlog.md-specific logic and file parsing.
 */

import type {
  FileAccessFunctions,
  IBacklogAdapter,
  BacklogConfig,
  Task,
} from './types';
import { BacklogAdapterError } from './types';
import {
  parseBacklogConfig,
  parseTaskFile,
  sortTasks,
} from './backlog-parser';

export class BacklogAdapter implements IBacklogAdapter {
  private fileAccess: FileAccessFunctions;
  private configCache: BacklogConfig | null = null;
  private tasksCache: Task[] | null = null;

  constructor(fileAccess: FileAccessFunctions) {
    this.fileAccess = fileAccess;
  }

  /**
   * Check if the repository is a Backlog.md project
   */
  public isBacklogProject(): boolean {
    const files = this.fileAccess.listFiles();
    const hasConfig = files.some((path) => path === 'backlog/config.yml');

    console.log('[BacklogAdapter] Checking if Backlog.md project...');
    console.log('[BacklogAdapter] Total files:', files.length);
    console.log('[BacklogAdapter] Has config.yml:', hasConfig);

    if (!hasConfig) {
      // Log first 50 files to help debug
      const backlogFiles = files.filter(f => f.startsWith('backlog/')).slice(0, 50);
      console.log('[BacklogAdapter] Backlog directory files:', backlogFiles);
    }

    return hasConfig;
  }

  /**
   * Get the Backlog.md project configuration
   */
  public async getConfig(): Promise<BacklogConfig> {
    // Return cached config if available
    if (this.configCache) {
      return this.configCache;
    }

    // Check if config file exists
    if (!this.isBacklogProject()) {
      const files = this.fileAccess.listFiles();
      const backlogFiles = files.filter(f => f.startsWith('backlog/'));

      throw new BacklogAdapterError(
        `Not a Backlog.md project: backlog/config.yml not found. ` +
        `Found ${backlogFiles.length} files in backlog/ directory. ` +
        `Ensure your repository has a backlog/config.yml file at the root.`
      );
    }

    try {
      console.log('[BacklogAdapter] Fetching config.yml...');

      // Fetch and parse config
      const content = await this.fileAccess.fetchFile('backlog/config.yml');

      console.log('[BacklogAdapter] Config content length:', content.length);

      const config = parseBacklogConfig(content);

      console.log('[BacklogAdapter] Parsed config:', {
        project: config.project_name,
        statuses: config.statuses,
        labels: config.labels?.length || 0,
      });

      // Cache the config
      this.configCache = config;

      return config;
    } catch (error) {
      console.error('[BacklogAdapter] Failed to load config:', error);

      if (error instanceof BacklogAdapterError) {
        throw error;
      }
      throw new BacklogAdapterError(
        `Failed to load config: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get the list of status columns from config
   */
  public async getStatuses(): Promise<string[]> {
    const config = await this.getConfig();
    return config.statuses;
  }

  /**
   * Get all tasks from the backlog
   */
  public async getTasks(includeCompleted = true): Promise<Task[]> {
    // Return cached tasks if available
    if (this.tasksCache) {
      console.log('[BacklogAdapter] Returning cached tasks:', this.tasksCache.length);
      return this.tasksCache;
    }

    const files = this.fileAccess.listFiles();

    // Find all task files
    const taskPaths = this.findTaskFiles(files, includeCompleted);

    console.log('[BacklogAdapter] Found task files:', taskPaths.length);

    if (taskPaths.length === 0) {
      console.log('[BacklogAdapter] No task files found');
      return [];
    }

    try {
      // Fetch all task files
      const taskPromises = taskPaths.map(async (path) => {
        try {
          console.log('[BacklogAdapter] Fetching task:', path);
          const content = await this.fileAccess.fetchFile(path);
          return parseTaskFile(content, path);
        } catch (error) {
          console.error(`[BacklogAdapter] Failed to parse task file ${path}:`, error);
          return null;
        }
      });

      const taskResults = await Promise.all(taskPromises);

      // Filter out failed parses
      const tasks = taskResults.filter((task): task is Task => task !== null);

      console.log('[BacklogAdapter] Successfully parsed tasks:', tasks.length);

      // Cache the tasks
      this.tasksCache = tasks;

      return tasks;
    } catch (error) {
      console.error('[BacklogAdapter] Failed to load tasks:', error);
      throw new BacklogAdapterError(
        `Failed to load tasks: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get tasks grouped by status
   */
  public async getTasksByStatus(
    includeCompleted = true
  ): Promise<Map<string, Task[]>> {
    const [config, tasks] = await Promise.all([
      this.getConfig(),
      this.getTasks(includeCompleted),
    ]);

    const grouped = new Map<string, Task[]>();

    // Initialize all status columns
    for (const status of config.statuses) {
      grouped.set(status, []);
    }

    // Group tasks by status
    for (const task of tasks) {
      const statusKey = task.status || config.default_status;
      const column = grouped.get(statusKey);

      if (column) {
        column.push(task);
      } else {
        // Handle tasks with unknown status
        console.warn(
          `Task ${task.id} has unknown status: ${task.status}. Placing in default status.`
        );
        const defaultColumn = grouped.get(config.default_status);
        if (defaultColumn) {
          defaultColumn.push(task);
        }
      }
    }

    // Sort tasks within each column
    grouped.forEach((tasks, status) => {
      grouped.set(status, sortTasks(tasks));
    });

    return grouped;
  }

  /**
   * Clear all caches (useful for refresh)
   */
  public clearCache(): void {
    this.configCache = null;
    this.tasksCache = null;
  }

  /**
   * Find all task files in the repository
   */
  private findTaskFiles(files: string[], includeCompleted: boolean): string[] {
    const taskFiles: string[] = [];

    for (const path of files) {
      // Check if it's in the tasks directory
      if (path.startsWith('backlog/tasks/') && this.isTaskFile(path)) {
        taskFiles.push(path);
        continue;
      }

      // Check if it's in the completed directory
      if (
        includeCompleted &&
        path.startsWith('backlog/completed/') &&
        this.isTaskFile(path)
      ) {
        taskFiles.push(path);
        continue;
      }
    }

    return taskFiles;
  }

  /**
   * Check if a file path is a task file
   */
  private isTaskFile(path: string): boolean {
    // Must end with .md
    if (!path.endsWith('.md')) {
      return false;
    }

    // Must contain task-<id> pattern (supports dotted IDs like task-24.1)
    const filename = path.split('/').pop() || '';
    return /^task-[\d.]+/.test(filename);
  }
}

/**
 * Factory function to create a BacklogAdapter
 */
export function createBacklogAdapter(
  fileAccess: FileAccessFunctions
): IBacklogAdapter {
  return new BacklogAdapter(fileAccess);
}
