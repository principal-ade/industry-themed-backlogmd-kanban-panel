/**
 * Backlog Parser Utilities
 *
 * Functions for parsing Backlog.md YAML frontmatter and markdown content.
 */

import YAML from 'yaml';
import type {
  Task,
  TaskMetadata,
  BacklogConfig,
  AcceptanceCriterion,
} from './types';
import { BacklogAdapterError } from './types';
import { parseBacklogConfig as parseConfigWithOfficialParser } from './backlog-config-parser';

/**
 * Parse YAML string using the yaml library (for task frontmatter only)
 */
export function parseYaml(yamlString: string): Record<string, unknown> {
  return YAML.parse(yamlString) as Record<string, unknown>;
}

/**
 * Parse Backlog.md config.yml file
 * Uses the official Backlog.md parser implementation
 */
export function parseBacklogConfig(content: string): BacklogConfig {
  console.log('[parseBacklogConfig] Using official Backlog.md parser');

  try {
    const config = parseConfigWithOfficialParser(content);

    console.log('[parseBacklogConfig] Parsed config:', {
      project_name: config.project_name,
      statuses: config.statuses,
      labels: config.labels?.length || 0,
    });

    // Validate required fields
    if (!config.project_name) {
      throw new BacklogAdapterError(
        'Invalid config.yml: missing or invalid project_name'
      );
    }

    if (!config.statuses || config.statuses.length === 0) {
      throw new BacklogAdapterError(
        'Invalid config.yml: missing or invalid statuses array'
      );
    }

    return config;
  } catch (error) {
    console.error('[parseBacklogConfig] Failed to parse config:', error);
    throw error instanceof BacklogAdapterError
      ? error
      : new BacklogAdapterError(
          `Failed to parse config.yml: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
  }
}

/**
 * Parse a Backlog.md task file
 */
export function parseTaskFile(content: string, filepath: string): Task {
  // Extract YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  if (!frontmatterMatch) {
    throw new BacklogAdapterError(
      `Invalid task file: ${filepath} - missing YAML frontmatter`
    );
  }

  // Parse YAML frontmatter
  const parsed = parseYaml(frontmatterMatch[1]);
  const metadata = validateTaskMetadata(parsed, filepath);

  // Extract body content (everything after frontmatter)
  const body = content.slice(frontmatterMatch[0].length).trim();

  // Extract sections from the body
  const description = extractSection(body, 'Description');
  const acceptanceCriteria = extractAcceptanceCriteria(body);
  const implementationPlan = extractSection(body, 'Implementation Plan');
  const notes = extractSection(body, 'Implementation Notes');

  return {
    ...metadata,
    // Normalize field names to match existing backlog-types
    createdDate: metadata.created_date,
    updatedDate: metadata.updated_date,
    parentTaskId: metadata.parent,
    // Content fields
    body,
    rawContent: body,
    description,
    acceptanceCriteriaItems: acceptanceCriteria,
    implementationPlan,
    implementationNotes: notes,
    // Set source based on filepath
    source: filepath.includes('/completed/') ? 'completed' as const : 'local' as const,
    filePath: filepath,
  };
}

/**
 * Validate and normalize task metadata from parsed YAML
 */
function validateTaskMetadata(
  parsed: Record<string, unknown>,
  filepath: string
): TaskMetadata {
  // Validate required fields
  if (!parsed.id || typeof parsed.id !== 'string') {
    throw new BacklogAdapterError(
      `Invalid task file: ${filepath} - missing or invalid id`
    );
  }

  if (!parsed.title || typeof parsed.title !== 'string') {
    throw new BacklogAdapterError(
      `Invalid task file: ${filepath} - missing or invalid title`
    );
  }

  if (!parsed.status || typeof parsed.status !== 'string') {
    throw new BacklogAdapterError(
      `Invalid task file: ${filepath} - missing or invalid status`
    );
  }

  if (!parsed.created_date || typeof parsed.created_date !== 'string') {
    throw new BacklogAdapterError(
      `Invalid task file: ${filepath} - missing or invalid created_date`
    );
  }

  return {
    id: parsed.id as string,
    title: parsed.title as string,
    status: parsed.status as string,
    created_date: parsed.created_date as string,
    assignee: Array.isArray(parsed.assignee) ? (parsed.assignee as string[]) : [],
    updated_date: parsed.updated_date as string | undefined,
    labels: Array.isArray(parsed.labels) ? (parsed.labels as string[]) : [],
    dependencies: Array.isArray(parsed.dependencies) ? (parsed.dependencies as string[]) : [],
    priority: (parsed.priority as 'low' | 'medium' | 'high') || undefined,
    ordinal: parsed.ordinal as number | undefined,
    parent: parsed.parent as string | undefined,
  };
}

/**
 * Extract a markdown section by heading
 */
function extractSection(
  body: string,
  heading: string
): string | undefined {
  const regex = new RegExp(
    `## ${heading}\\n\\n([\\s\\S]*?)(?=\\n## |$)`,
    'i'
  );
  const match = body.match(regex);
  return match ? match[1].trim() : undefined;
}

/**
 * Extract acceptance criteria from task body
 */
function extractAcceptanceCriteria(
  body: string
): AcceptanceCriterion[] | undefined {
  // Match the AC section between markers
  const acMatch = body.match(
    /## Acceptance Criteria\n<!-- AC:BEGIN -->\n([\s\S]*?)\n<!-- AC:END -->/
  );

  if (!acMatch) {
    return undefined;
  }

  const acSection = acMatch[1];
  const lines = acSection.split('\n');
  const criteria: AcceptanceCriterion[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Match checkbox items: - [ ] #1 Text or - [x] #1 Text
    const match = trimmed.match(/^- \[([ x])\] #(\d+) (.+)$/);

    if (match) {
      const [, checked, idStr, text] = match;
      criteria.push({
        index: parseInt(idStr, 10),
        text: text.trim(),
        checked: checked === 'x',
      });
    }
  }

  return criteria.length > 0 ? criteria : undefined;
}

/**
 * Sort tasks within a status column
 */
export function sortTasks(tasks: Task[]): Task[] {
  return tasks.sort((a, b) => {
    // Sort by ordinal if present
    if (a.ordinal !== undefined && b.ordinal !== undefined) {
      return a.ordinal - b.ordinal;
    }

    // Then by priority (high > medium > low)
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const aPriority = priorityOrder[a.priority || 'medium'];
    const bPriority = priorityOrder[b.priority || 'medium'];

    if (aPriority !== bPriority) {
      return bPriority - aPriority; // Higher priority first
    }

    // Finally by creation date (newest first)
    const aDate = new Date(a.created_date).getTime();
    const bDate = new Date(b.created_date).getTime();
    return bDate - aDate;
  });
}
