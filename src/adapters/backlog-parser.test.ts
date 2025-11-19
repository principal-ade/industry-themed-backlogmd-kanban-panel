/**
 * Tests for Backlog Parser Utilities
 */

import { describe, it, expect } from 'vitest';
import {
  parseYaml,
  parseBacklogConfig,
  parseTaskFile,
  sortTasks,
} from './backlog-parser';
import { BacklogAdapterError } from './types';
import type { Task } from './types';

describe('parseYaml', () => {
  it('should parse basic key-value pairs', () => {
    const yaml = `
project_name: "Test Project"
default_status: "To Do"
auto_commit: true
zero_padded_ids: 3
    `.trim();

    const result = parseYaml(yaml);

    expect(result).toEqual({
      project_name: 'Test Project',
      default_status: 'To Do',
      auto_commit: true,
      zero_padded_ids: 3,
    });
  });

  it('should parse arrays', () => {
    const yaml = `
statuses:
  - To Do
  - In Progress
  - Done
labels:
  - bug
  - feature
    `.trim();

    const result = parseYaml(yaml);

    expect(result.statuses).toEqual(['To Do', 'In Progress', 'Done']);
    expect(result.labels).toEqual(['bug', 'feature']);
  });

  it('should parse empty arrays', () => {
    const yaml = `
labels: []
milestones: []
    `.trim();

    const result = parseYaml(yaml);

    expect(result.labels).toEqual([]);
    expect(result.milestones).toEqual([]);
  });

  it('should skip comments and empty lines', () => {
    const yaml = `
# This is a comment
project_name: "Test"

# Another comment
default_status: "To Do"
    `.trim();

    const result = parseYaml(yaml);

    expect(result).toEqual({
      project_name: 'Test',
      default_status: 'To Do',
    });
  });

  it('should handle booleans and null values', () => {
    const yaml = `
enabled: true
disabled: false
nothing: null
    `.trim();

    const result = parseYaml(yaml);

    expect(result.enabled).toBe(true);
    expect(result.disabled).toBe(false);
    expect(result.nothing).toBe(null);
  });
});

describe('parseBacklogConfig', () => {
  it('should parse valid config.yml (Backlog.md format)', () => {
    const configContent = `
project_name: "Backlog.md"
default_status: "To Do"
statuses: ["To Do", "In Progress", "Done"]
labels: []
milestones: []
date_format: yyyy-mm-dd hh:mm
default_editor: "rider"
auto_commit: false
zero_padded_ids: 3
    `.trim();

    const config = parseBacklogConfig(configContent);

    expect(config.project_name).toBe('Backlog.md');
    expect(config.default_status).toBe('To Do');
    expect(config.statuses).toEqual(['To Do', 'In Progress', 'Done']);
    expect(config.labels).toEqual([]);
    expect(config.date_format).toBe('yyyy-mm-dd hh:mm');
    expect(config.default_editor).toBe('rider');
    expect(config.auto_commit).toBe(false);
    expect(config.zero_padded_ids).toBe(3);
  });

  it('should throw error if project_name is missing', () => {
    const configContent = `
statuses: ["To Do"]
    `.trim();

    expect(() => parseBacklogConfig(configContent)).toThrow(BacklogAdapterError);
    expect(() => parseBacklogConfig(configContent)).toThrow(
      'Invalid config.yml: missing or invalid project_name'
    );
  });

  it('should use default statuses if statuses is missing', () => {
    const configContent = `
project_name: "Test"
    `.trim();

    const config = parseBacklogConfig(configContent);

    // Official Backlog.md parser provides default statuses
    expect(config.statuses).toEqual(['To Do', 'In Progress', 'Done']);
    expect(config.project_name).toBe('Test');
  });

  it('should use defaults for optional fields', () => {
    const configContent = `
project_name: "Test"
statuses: ["To Do"]
    `.trim();

    const config = parseBacklogConfig(configContent);

    expect(config.default_status).toBe('To Do');
    expect(config.labels).toEqual([]);
    expect(config.milestones).toEqual([]);
    expect(config.date_format).toBe('yyyy-mm-dd hh:mm');
  });
});

describe('parseTaskFile', () => {
  it('should parse valid task file', () => {
    const taskContent = `---
id: "001"
title: "Test Task"
status: "To Do"
created_date: "2025-01-01 10:00"
assignee:
  - john
labels:
  - bug
priority: high
---

## Description

This is a test task.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 First criterion
- [x] #2 Second criterion
<!-- AC:END -->

## Implementation Plan

Step 1: Do something
Step 2: Do another thing
    `.trim();

    const task = parseTaskFile(taskContent, 'backlog/tasks/task-001.md');

    expect(task.id).toBe('001');
    expect(task.title).toBe('Test Task');
    expect(task.status).toBe('To Do');
    expect(task.created_date).toBe('2025-01-01 10:00');
    expect(task.assignee).toEqual(['john']);
    expect(task.labels).toEqual(['bug']);
    expect(task.priority).toBe('high');
    expect(task.description).toContain('This is a test task');
    expect(task.acceptanceCriteriaItems).toHaveLength(2);
    expect(task.acceptanceCriteriaItems?.[0].text).toBe('First criterion');
    expect(task.acceptanceCriteriaItems?.[0].checked).toBe(false);
    expect(task.acceptanceCriteriaItems?.[1].checked).toBe(true);
    expect(task.implementationPlan).toContain('Step 1');
    expect(task.filePath).toBe('backlog/tasks/task-001.md');
  });

  it('should throw error if frontmatter is missing', () => {
    const taskContent = 'Just some content without frontmatter';

    expect(() => parseTaskFile(taskContent, 'test.md')).toThrow(BacklogAdapterError);
    expect(() => parseTaskFile(taskContent, 'test.md')).toThrow(
      'missing YAML frontmatter'
    );
  });

  it('should throw error if required fields are missing', () => {
    const taskContent = `---
title: "Test"
---`;

    expect(() => parseTaskFile(taskContent, 'test.md')).toThrow(BacklogAdapterError);
  });

  it('should set source to completed for completed tasks', () => {
    const taskContent = `---
id: "001"
title: "Test"
status: "Done"
created_date: "2025-01-01 10:00"
---

Content
    `.trim();

    const task = parseTaskFile(taskContent, 'backlog/completed/task-001.md');

    expect(task.source).toBe('completed');
  });

  it('should set source to local for active tasks', () => {
    const taskContent = `---
id: "001"
title: "Test"
status: "To Do"
created_date: "2025-01-01 10:00"
---

Content
    `.trim();

    const task = parseTaskFile(taskContent, 'backlog/tasks/task-001.md');

    expect(task.source).toBe('local');
  });
});

describe('sortTasks', () => {
  it('should sort by ordinal when present', () => {
    const tasks: Task[] = [
      {
        id: '3',
        title: 'Third',
        status: 'To Do',
        created_date: '2025-01-01',
        ordinal: 3,
      } as Task,
      {
        id: '1',
        title: 'First',
        status: 'To Do',
        created_date: '2025-01-01',
        ordinal: 1,
      } as Task,
      {
        id: '2',
        title: 'Second',
        status: 'To Do',
        created_date: '2025-01-01',
        ordinal: 2,
      } as Task,
    ];

    const sorted = sortTasks(tasks);

    expect(sorted[0].id).toBe('1');
    expect(sorted[1].id).toBe('2');
    expect(sorted[2].id).toBe('3');
  });

  it('should sort by priority when ordinals are absent', () => {
    const tasks: Task[] = [
      {
        id: '1',
        title: 'Low Priority',
        status: 'To Do',
        created_date: '2025-01-01',
        priority: 'low',
      } as Task,
      {
        id: '2',
        title: 'High Priority',
        status: 'To Do',
        created_date: '2025-01-01',
        priority: 'high',
      } as Task,
      {
        id: '3',
        title: 'Medium Priority',
        status: 'To Do',
        created_date: '2025-01-01',
        priority: 'medium',
      } as Task,
    ];

    const sorted = sortTasks(tasks);

    expect(sorted[0].id).toBe('2'); // high
    expect(sorted[1].id).toBe('3'); // medium
    expect(sorted[2].id).toBe('1'); // low
  });

  it('should sort by creation date when priority is same', () => {
    const tasks: Task[] = [
      {
        id: '1',
        title: 'Older',
        status: 'To Do',
        created_date: '2025-01-01 10:00',
        priority: 'medium',
      } as Task,
      {
        id: '2',
        title: 'Newer',
        status: 'To Do',
        created_date: '2025-01-02 10:00',
        priority: 'medium',
      } as Task,
    ];

    const sorted = sortTasks(tasks);

    expect(sorted[0].id).toBe('2'); // Newer first
    expect(sorted[1].id).toBe('1');
  });
});
