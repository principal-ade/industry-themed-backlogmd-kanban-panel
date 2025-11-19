/**
 * Adapter Types
 *
 * Defines the interfaces and types used by the BacklogAdapter
 * to provide a clean abstraction over Backlog.md file access.
 */

/**
 * File access functions provided to the adapter
 */
export interface FileAccessFunctions {
  /**
   * Fetch the content of a file by path
   * @param path - Relative path from repository root (e.g., "backlog/config.yml")
   * @returns Promise resolving to file content as string
   */
  fetchFile: (path: string) => Promise<string>;

  /**
   * List all files in the repository
   * @returns Array of file paths relative to repository root
   */
  listFiles: () => string[];
}

/**
 * Backlog.md project configuration
 */
export interface BacklogConfig {
  project_name: string;
  default_status: string;
  statuses: string[];
  labels?: string[];
  milestones?: string[];
  date_format?: string;
  default_editor?: string;
  auto_commit?: boolean;
  zero_padded_ids?: number;
}

/**
 * Task metadata from YAML frontmatter
 */
export interface TaskMetadata {
  id: string;
  title: string;
  status: string;
  assignee: string[];
  created_date: string;
  updated_date?: string;
  labels: string[];
  dependencies: string[];
  priority?: 'low' | 'medium' | 'high';
  ordinal?: number;
  parent?: string;
}

/**
 * Complete task with parsed content
 */
export interface Task extends TaskMetadata {
  // Normalized field names to match existing backlog-types
  createdDate: string; // Normalized from created_date
  updatedDate?: string; // Normalized from updated_date
  parentTaskId?: string; // Normalized from parent

  // Additional fields
  body: string;
  rawContent?: string;
  description?: string;
  acceptanceCriteriaItems?: AcceptanceCriterion[];
  implementationPlan?: string;
  implementationNotes?: string;
  subtasks?: string[];
  reporter?: string;
  milestone?: string;
  branch?: string;
  filePath?: string;
  lastModified?: Date;
  source?: 'local' | 'remote' | 'completed';
}

/**
 * Acceptance criterion from task
 */
export interface AcceptanceCriterion {
  index: number; // 1-based index
  text: string;
  checked: boolean;
}

/**
 * Main adapter interface
 */
export interface IBacklogAdapter {
  /**
   * Get the Backlog.md project configuration
   */
  getConfig(): Promise<BacklogConfig>;

  /**
   * Get all tasks from the backlog
   * @param includeCompleted - Whether to include completed tasks (default: true)
   */
  getTasks(includeCompleted?: boolean): Promise<Task[]>;

  /**
   * Get the list of status columns from config
   */
  getStatuses(): Promise<string[]>;

  /**
   * Get tasks grouped by status
   * @param includeCompleted - Whether to include completed tasks (default: true)
   */
  getTasksByStatus(includeCompleted?: boolean): Promise<Map<string, Task[]>>;

  /**
   * Check if the repository is a Backlog.md project
   */
  isBacklogProject(): boolean;
}

/**
 * Error thrown when Backlog.md files are not found or invalid
 */
export class BacklogAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BacklogAdapterError';
  }
}
