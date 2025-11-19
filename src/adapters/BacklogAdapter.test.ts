/**
 * Tests for BacklogAdapter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BacklogAdapter, createBacklogAdapter } from './BacklogAdapter';
import { BacklogAdapterError } from './types';
import type { FileAccessFunctions } from './types';

describe('BacklogAdapter', () => {
  let mockFileAccess: FileAccessFunctions;

  beforeEach(() => {
    // Reset mock before each test
    mockFileAccess = {
      listFiles: vi.fn(),
      fetchFile: vi.fn(),
    };
  });

  describe('isBacklogProject', () => {
    it('should return true when config.yml exists', () => {
      (mockFileAccess.listFiles as any).mockReturnValue([
        'README.md',
        'backlog/config.yml',
        'backlog/tasks/task-001.md',
      ]);

      const adapter = new BacklogAdapter(mockFileAccess);
      expect(adapter.isBacklogProject()).toBe(true);
    });

    it('should return false when config.yml does not exist', () => {
      (mockFileAccess.listFiles as any).mockReturnValue([
        'README.md',
        'src/index.ts',
      ]);

      const adapter = new BacklogAdapter(mockFileAccess);
      expect(adapter.isBacklogProject()).toBe(false);
    });

    it('should return false for empty repository', () => {
      (mockFileAccess.listFiles as any).mockReturnValue([]);

      const adapter = new BacklogAdapter(mockFileAccess);
      expect(adapter.isBacklogProject()).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should fetch and parse config.yml', async () => {
      const configContent = `
project_name: "Test Project"
default_status: "To Do"
statuses:
  - To Do
  - In Progress
  - Done
labels: []
milestones: []
      `.trim();

      (mockFileAccess.listFiles as any).mockReturnValue(['backlog/config.yml']);
      (mockFileAccess.fetchFile as any).mockResolvedValue(configContent);

      const adapter = new BacklogAdapter(mockFileAccess);
      const config = await adapter.getConfig();

      expect(config.project_name).toBe('Test Project');
      expect(config.statuses).toEqual(['To Do', 'In Progress', 'Done']);
      expect(mockFileAccess.fetchFile).toHaveBeenCalledWith('backlog/config.yml');
    });

    it('should cache config after first fetch', async () => {
      const configContent = `
project_name: "Test"
statuses: ["To Do"]
      `.trim();

      (mockFileAccess.listFiles as any).mockReturnValue(['backlog/config.yml']);
      (mockFileAccess.fetchFile as any).mockResolvedValue(configContent);

      const adapter = new BacklogAdapter(mockFileAccess);

      // First call
      await adapter.getConfig();

      // Second call - should use cache
      await adapter.getConfig();

      // fetchFile should only be called once
      expect(mockFileAccess.fetchFile).toHaveBeenCalledTimes(1);
    });

    it('should throw error if not a Backlog.md project', async () => {
      (mockFileAccess.listFiles as any).mockReturnValue(['README.md']);

      const adapter = new BacklogAdapter(mockFileAccess);

      await expect(adapter.getConfig()).rejects.toThrow(BacklogAdapterError);
      await expect(adapter.getConfig()).rejects.toThrow('backlog/config.yml not found');
    });

    it('should throw error if config.yml is invalid', async () => {
      (mockFileAccess.listFiles as any).mockReturnValue(['backlog/config.yml']);
      (mockFileAccess.fetchFile as any).mockResolvedValue('invalid: yaml: content');

      const adapter = new BacklogAdapter(mockFileAccess);

      await expect(adapter.getConfig()).rejects.toThrow(BacklogAdapterError);
    });
  });

  describe('getStatuses', () => {
    it('should return statuses from config', async () => {
      const configContent = `
project_name: "Test"
statuses:
  - To Do
  - In Progress
  - Done
      `.trim();

      (mockFileAccess.listFiles as any).mockReturnValue(['backlog/config.yml']);
      (mockFileAccess.fetchFile as any).mockResolvedValue(configContent);

      const adapter = new BacklogAdapter(mockFileAccess);
      const statuses = await adapter.getStatuses();

      expect(statuses).toEqual(['To Do', 'In Progress', 'Done']);
    });
  });

  describe('getTasks', () => {
    it('should fetch and parse task files', async () => {
      const taskContent = `---
id: "001"
title: "Test Task"
status: "To Do"
created_date: "2025-01-01 10:00"
---

Test content
      `.trim();

      (mockFileAccess.listFiles as any).mockReturnValue([
        'backlog/config.yml',
        'backlog/tasks/task-001.md',
        'backlog/tasks/task-002.md',
      ]);
      (mockFileAccess.fetchFile as any).mockResolvedValue(taskContent);

      const adapter = new BacklogAdapter(mockFileAccess);
      const tasks = await adapter.getTasks();

      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe('001');
      expect(tasks[0].title).toBe('Test Task');
    });

    it('should include completed tasks when includeCompleted is true', async () => {
      const taskContent = `---
id: "001"
title: "Test"
status: "Done"
created_date: "2025-01-01"
---
Content`;

      (mockFileAccess.listFiles as any).mockReturnValue([
        'backlog/tasks/task-001.md',
        'backlog/completed/task-002.md',
      ]);
      (mockFileAccess.fetchFile as any).mockResolvedValue(taskContent);

      const adapter = new BacklogAdapter(mockFileAccess);
      const tasks = await adapter.getTasks(true);

      expect(tasks).toHaveLength(2);
    });

    it('should exclude completed tasks when includeCompleted is false', async () => {
      const taskContent = `---
id: "001"
title: "Test"
status: "To Do"
created_date: "2025-01-01"
---
Content`;

      (mockFileAccess.listFiles as any).mockReturnValue([
        'backlog/tasks/task-001.md',
        'backlog/completed/task-002.md',
      ]);
      (mockFileAccess.fetchFile as any).mockResolvedValue(taskContent);

      const adapter = new BacklogAdapter(mockFileAccess);
      const tasks = await adapter.getTasks(false);

      expect(tasks).toHaveLength(1);
    });

    it('should cache tasks after first fetch', async () => {
      const taskContent = `---
id: "001"
title: "Test"
status: "To Do"
created_date: "2025-01-01"
---`;

      (mockFileAccess.listFiles as any).mockReturnValue([
        'backlog/tasks/task-001.md',
      ]);
      (mockFileAccess.fetchFile as any).mockResolvedValue(taskContent);

      const adapter = new BacklogAdapter(mockFileAccess);

      await adapter.getTasks();
      await adapter.getTasks();

      // Should only fetch once due to caching
      expect(mockFileAccess.fetchFile).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no task files exist', async () => {
      (mockFileAccess.listFiles as any).mockReturnValue(['backlog/config.yml']);

      const adapter = new BacklogAdapter(mockFileAccess);
      const tasks = await adapter.getTasks();

      expect(tasks).toEqual([]);
    });

    it('should skip invalid task files and continue', async () => {
      (mockFileAccess.listFiles as any).mockReturnValue([
        'backlog/tasks/task-001.md',
        'backlog/tasks/task-002.md',
      ]);

      // First task is valid, second is invalid
      (mockFileAccess.fetchFile as any).mockImplementation((path: string) => {
        if (path.includes('task-001')) {
          return Promise.resolve(`---
id: "001"
title: "Valid"
status: "To Do"
created_date: "2025-01-01"
---`);
        }
        return Promise.resolve('invalid content');
      });

      const adapter = new BacklogAdapter(mockFileAccess);
      const tasks = await adapter.getTasks();

      // Should only return the valid task
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('001');
    });
  });

  describe('getTasksByStatus', () => {
    it('should group tasks by status', async () => {
      const configContent = `
project_name: "Test"
default_status: "To Do"
statuses:
  - To Do
  - In Progress
  - Done
      `.trim();

      (mockFileAccess.listFiles as any).mockReturnValue([
        'backlog/config.yml',
        'backlog/tasks/task-001.md',
        'backlog/tasks/task-002.md',
      ]);

      (mockFileAccess.fetchFile as any).mockImplementation((path: string) => {
        if (path === 'backlog/config.yml') {
          return Promise.resolve(configContent);
        }
        if (path.includes('task-001')) {
          return Promise.resolve(`---
id: "001"
title: "Task 1"
status: "To Do"
created_date: "2025-01-01"
---`);
        }
        return Promise.resolve(`---
id: "002"
title: "Task 2"
status: "In Progress"
created_date: "2025-01-01"
---`);
      });

      const adapter = new BacklogAdapter(mockFileAccess);
      const tasksByStatus = await adapter.getTasksByStatus();

      expect(tasksByStatus.get('To Do')).toHaveLength(1);
      expect(tasksByStatus.get('In Progress')).toHaveLength(1);
      expect(tasksByStatus.get('Done')).toHaveLength(0);
    });

    it('should initialize all status columns even if empty', async () => {
      const configContent = `
project_name: "Test"
statuses:
  - To Do
  - In Progress
  - Done
      `.trim();

      (mockFileAccess.listFiles as any).mockReturnValue(['backlog/config.yml']);
      (mockFileAccess.fetchFile as any).mockResolvedValue(configContent);

      const adapter = new BacklogAdapter(mockFileAccess);
      const tasksByStatus = await adapter.getTasksByStatus();

      expect(tasksByStatus.has('To Do')).toBe(true);
      expect(tasksByStatus.has('In Progress')).toBe(true);
      expect(tasksByStatus.has('Done')).toBe(true);
      expect(tasksByStatus.get('To Do')).toEqual([]);
    });
  });

  describe('clearCache', () => {
    it('should clear cached config and tasks', async () => {
      const configContent = `
project_name: "Test"
statuses: ["To Do"]
      `.trim();

      const taskContent = `---
id: "001"
title: "Test"
status: "To Do"
created_date: "2025-01-01"
---`;

      (mockFileAccess.listFiles as any).mockReturnValue([
        'backlog/config.yml',
        'backlog/tasks/task-001.md',
      ]);
      (mockFileAccess.fetchFile as any).mockImplementation((path: string) => {
        if (path === 'backlog/config.yml') {
          return Promise.resolve(configContent);
        }
        return Promise.resolve(taskContent);
      });

      const adapter = new BacklogAdapter(mockFileAccess);

      // Fetch data to populate cache
      await adapter.getConfig();
      await adapter.getTasks();

      // Clear cache
      adapter.clearCache();

      // Fetch again - should call fetchFile again
      await adapter.getConfig();
      await adapter.getTasks();

      // Should have been called twice for each (once before clear, once after)
      expect(mockFileAccess.fetchFile).toHaveBeenCalledTimes(4);
    });
  });

  describe('createBacklogAdapter factory', () => {
    it('should create a BacklogAdapter instance', () => {
      const adapter = createBacklogAdapter(mockFileAccess);
      expect(adapter).toBeInstanceOf(BacklogAdapter);
    });
  });
});
