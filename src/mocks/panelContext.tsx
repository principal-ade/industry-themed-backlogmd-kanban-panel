import React from 'react';
import { PathsFileTreeBuilder } from '@principal-ai/repository-abstraction';
import type {
  PanelComponentProps,
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
  PanelEvent,
  PanelEventType,
  DataSlice,
} from '../types';

/**
 * Create a mock file system adapter for Storybook
 * Stores files in memory and logs operations
 */
export const createMockFileSystemAdapter = () => {
  const files = new Map<string, string>();

  return {
    exists: async (path: string) => files.has(path),
    readFile: async (path: string) => {
      const content = files.get(path);
      if (content === undefined) throw new Error(`File not found: ${path}`);
      return content;
    },
    writeFile: async (path: string, content: string) => {
      console.log('[Mock FS] Writing file:', path);
      files.set(path, content);
    },
    deleteFile: async (path: string) => {
      console.log('[Mock FS] Deleting file:', path);
      files.delete(path);
    },
    createDir: async (path: string) => {
      console.log('[Mock FS] Creating directory:', path);
      // Directories are implicit in the Map-based storage
    },
    readDir: async (path: string) => {
      const prefix = path.endsWith('/') ? path : path + '/';
      const entries = new Set<string>();
      for (const key of files.keys()) {
        if (key.startsWith(prefix)) {
          const rest = key.slice(prefix.length);
          const firstSegment = rest.split('/')[0];
          if (firstSegment) entries.add(firstSegment);
        }
      }
      return Array.from(entries);
    },
    isDirectory: async (path: string) => {
      const prefix = path.endsWith('/') ? path : path + '/';
      for (const key of files.keys()) {
        if (key.startsWith(prefix)) return true;
      }
      return false;
    },
    // Expose the internal files map for testing
    _files: files,
  };
};

/**
 * Mock Git Status data for Storybook
 */
const mockGitStatusData = {
  staged: ['src/components/Button.tsx', 'src/styles/theme.css'],
  unstaged: ['README.md', 'package.json'],
  untracked: ['src/new-feature.tsx'],
  deleted: [],
};

/**
 * Create a mock DataSlice
 */
const createMockSlice = <T,>(
  name: string,
  data: T,
  scope: 'workspace' | 'repository' | 'global' = 'repository'
): DataSlice<T> => ({
  scope,
  name,
  data,
  loading: false,
  error: null,
  refresh: async () => {
    // eslint-disable-next-line no-console
    console.log(`[Mock] Refreshing slice: ${name}`);
  },
});

/**
 * Options for creating mock context
 */
interface MockContextOptions {
  /** Override default context values */
  overrides?: Partial<PanelContextValue>;
  /** Additional slices to add/override */
  slices?: Record<string, DataSlice>;
}

/**
 * Mock Panel Context for Storybook
 */
export const createMockContext = (
  options?: MockContextOptions | Partial<PanelContextValue>
): PanelContextValue => {
  // Support both old signature (direct overrides) and new signature (options object)
  const opts: MockContextOptions = options && 'slices' in options
    ? options as MockContextOptions
    : { overrides: options as Partial<PanelContextValue> };

  const { overrides, slices: customSlices } = opts;

  // Create default fileTree using PathsFileTreeBuilder
  const builder = new PathsFileTreeBuilder();
  const defaultFileTree = builder.build({
    files: ['src', 'package.json'],
  });

  // Create mock data slices
  const mockSlices = new Map<string, DataSlice>([
    ['git', createMockSlice('git', mockGitStatusData)],
    [
      'markdown',
      createMockSlice('markdown', [
        {
          path: 'README.md',
          title: 'Project README',
          lastModified: Date.now() - 3600000,
        },
        {
          path: 'docs/API.md',
          title: 'API Documentation',
          lastModified: Date.now() - 86400000,
        },
      ]),
    ],
    ['fileTree', createMockSlice('fileTree', defaultFileTree)],
    [
      'packages',
      createMockSlice('packages', [
        { name: 'react', version: '19.0.0', path: '/node_modules/react' },
        {
          name: 'typescript',
          version: '5.0.4',
          path: '/node_modules/typescript',
        },
      ]),
    ],
    [
      'quality',
      createMockSlice('quality', {
        coverage: 85,
        issues: 3,
        complexity: 12,
      }),
    ],
  ]);

  // Add custom slices if provided
  if (customSlices) {
    for (const [name, slice] of Object.entries(customSlices)) {
      mockSlices.set(name, slice);
    }
  }

  // Create mock file system adapter
  const mockFileSystem = createMockFileSystemAdapter();

  // Get fileTree slice for typed context (KanbanPanel expects context.fileTree)
  const fileTreeSlice = customSlices?.fileTree || mockSlices.get('fileTree');

  const defaultContext: PanelContextValue & { fileTree?: DataSlice } = {
    // Add fileTree as direct property for typed panel props
    fileTree: fileTreeSlice,
    currentScope: {
      type: 'repository',
      workspace: {
        name: 'my-workspace',
        path: '/Users/developer/my-workspace',
      },
      repository: {
        name: 'my-project',
        path: '/Users/developer/my-project',
      },
    },
    slices: mockSlices,
    adapters: {
      fileSystem: mockFileSystem,
    },
    getSlice: <T,>(name: string): DataSlice<T> | undefined => {
      return mockSlices.get(name) as DataSlice<T> | undefined;
    },
    getWorkspaceSlice: <T,>(name: string): DataSlice<T> | undefined => {
      const slice = mockSlices.get(name);
      return slice?.scope === 'workspace' ? (slice as DataSlice<T>) : undefined;
    },
    getRepositorySlice: <T,>(name: string): DataSlice<T> | undefined => {
      const slice = mockSlices.get(name);
      return slice?.scope === 'repository'
        ? (slice as DataSlice<T>)
        : undefined;
    },
    hasSlice: (name: string, scope?: 'workspace' | 'repository'): boolean => {
      const slice = mockSlices.get(name);
      if (!slice) return false;
      if (!scope) return true;
      return slice.scope === scope;
    },
    isSliceLoading: (
      name: string,
      scope?: 'workspace' | 'repository'
    ): boolean => {
      const slice = mockSlices.get(name);
      if (!slice) return false;
      if (scope && slice.scope !== scope) return false;
      return slice.loading;
    },
    refresh: async (
      scope?: 'workspace' | 'repository',
      slice?: string
    ): Promise<void> => {
      // eslint-disable-next-line no-console
      console.log('[Mock] Context refresh called', { scope, slice });
    },
  };

  return { ...defaultContext, ...overrides };
};

/**
 * Mock Panel Actions for Storybook
 */
export const createMockActions = (
  overrides?: Partial<PanelActions>
): PanelActions => ({
  openFile: (filePath: string) => {
    // eslint-disable-next-line no-console
    console.log('[Mock] Opening file:', filePath);
  },
  openGitDiff: (filePath: string, status) => {
    // eslint-disable-next-line no-console
    console.log('[Mock] Opening git diff:', filePath, status);
  },
  navigateToPanel: (panelId: string) => {
    // eslint-disable-next-line no-console
    console.log('[Mock] Navigating to panel:', panelId);
  },
  notifyPanels: (event) => {
    // eslint-disable-next-line no-console
    console.log('[Mock] Notifying panels:', event);
  },
  ...overrides,
});

/**
 * Mock Event Emitter for Storybook
 */
export const createMockEvents = (): PanelEventEmitter => {
  const handlers = new Map<
    PanelEventType,
    Set<(event: PanelEvent<unknown>) => void>
  >();

  return {
    emit: (event) => {
      // eslint-disable-next-line no-console
      console.log('[Mock] Emitting event:', event);
      const eventHandlers = handlers.get(event.type);
      if (eventHandlers) {
        eventHandlers.forEach((handler) => handler(event));
      }
    },
    on: (type, handler) => {
      // eslint-disable-next-line no-console
      console.log('[Mock] Subscribing to event:', type);
      if (!handlers.has(type)) {
        handlers.set(type, new Set());
      }
      handlers.get(type)!.add(handler as (event: PanelEvent<unknown>) => void);

      // Return cleanup function
      return () => {
        // eslint-disable-next-line no-console
        console.log('[Mock] Unsubscribing from event:', type);
        handlers
          .get(type)
          ?.delete(handler as (event: PanelEvent<unknown>) => void);
      };
    },
    off: (type, handler) => {
      // eslint-disable-next-line no-console
      console.log('[Mock] Removing event handler:', type);
      handlers
        .get(type)
        ?.delete(handler as (event: PanelEvent<unknown>) => void);
    },
  };
};

/**
 * Mock Panel Props Provider
 * Wraps components with mock context for Storybook
 */
export const MockPanelProvider: React.FC<{
  children: (props: PanelComponentProps) => React.ReactNode;
  contextOverrides?: Partial<PanelContextValue>;
  actionsOverrides?: Partial<PanelActions>;
}> = ({ children, contextOverrides, actionsOverrides }) => {
  const context = createMockContext(contextOverrides);
  const actions = createMockActions(actionsOverrides);
  const events = createMockEvents();

  return <>{children({ context, actions, events })}</>;
};
