/**
 * PanelFileSystemAdapter
 *
 * Implements FileSystemAdapter interface by wrapping the panel framework's
 * file access APIs (fileTree slice and openFile action).
 *
 * For read operations: Uses the fileTree slice and fetchFile function
 * For write operations: Delegates to the host's fileSystem adapter (if available)
 */

import type { FileSystemAdapter } from '@backlog-md/core';

/**
 * Host file system adapter interface (subset of what web-ade provides)
 * Uses void | Promise<void> to match the panel-framework-core FileSystemAdapter
 */
export interface HostFileSystemAdapter {
  writeFile?: (path: string, content: string) => void | Promise<void>;
  createDir?: (path: string) => void | Promise<void>;
  deleteFile?: (path: string) => void | Promise<void>;
}

export interface PanelFileAccess {
  /** Function to fetch file content by path */
  fetchFile: (path: string) => Promise<string>;
  /** List of all file paths in the repository */
  filePaths: string[];
  /** Optional host file system adapter for write operations */
  hostFileSystem?: HostFileSystemAdapter;
}

/**
 * FileSystemAdapter implementation for the panel framework
 *
 * This adapter wraps the panel's file access mechanisms to provide
 * a standard FileSystemAdapter interface for @backlog-md/core.
 */
export class PanelFileSystemAdapter implements FileSystemAdapter {
  private readonly filePaths: Set<string>;
  private readonly directories: Set<string>;
  private readonly fetchFile: (path: string) => Promise<string>;
  private readonly hostFileSystem?: HostFileSystemAdapter;

  constructor(access: PanelFileAccess) {
    this.fetchFile = access.fetchFile;
    this.filePaths = new Set(access.filePaths);
    this.hostFileSystem = access.hostFileSystem;

    // Build directory set from file paths
    this.directories = new Set<string>();
    for (const filePath of access.filePaths) {
      const parts = filePath.split('/');
      // Add all parent directories
      for (let i = 1; i < parts.length; i++) {
        this.directories.add(parts.slice(0, i).join('/'));
      }
    }
    // Root directory
    this.directories.add('');
  }

  /**
   * Check if write operations are available
   */
  get canWrite(): boolean {
    return !!(this.hostFileSystem?.writeFile && this.hostFileSystem?.createDir);
  }

  async exists(path: string): Promise<boolean> {
    const normalized = this.normalizePath(path);
    return this.filePaths.has(normalized) || this.directories.has(normalized);
  }

  async readFile(path: string): Promise<string> {
    const normalized = this.normalizePath(path);
    if (!this.filePaths.has(normalized)) {
      throw new Error(`File not found: ${path}`);
    }
    return this.fetchFile(normalized);
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (!this.hostFileSystem?.writeFile) {
      throw new Error('Write operations not available - host adapter not configured');
    }
    const normalized = this.normalizePath(path);
    await this.hostFileSystem.writeFile(normalized, content);
    // Add to local cache so subsequent reads work
    this.filePaths.add(normalized);
    // Add parent directories
    const parts = normalized.split('/');
    for (let i = 1; i < parts.length; i++) {
      this.directories.add(parts.slice(0, i).join('/'));
    }
  }

  async deleteFile(path: string): Promise<void> {
    if (!this.hostFileSystem?.deleteFile) {
      throw new Error('Delete operations not available - host adapter not configured');
    }
    const normalized = this.normalizePath(path);
    await this.hostFileSystem.deleteFile(normalized);
    // Remove from local cache
    this.filePaths.delete(normalized);
  }

  async createDir(path: string, _options?: { recursive?: boolean }): Promise<void> {
    if (!this.hostFileSystem?.createDir) {
      throw new Error('Directory creation not available - host adapter not configured');
    }
    const normalized = this.normalizePath(path);
    await this.hostFileSystem.createDir(normalized);
    // Add to local cache
    this.directories.add(normalized);
  }

  async readDir(path: string): Promise<string[]> {
    const normalized = this.normalizePath(path);
    const prefix = normalized ? `${normalized}/` : '';
    const entries = new Set<string>();

    for (const filePath of this.filePaths) {
      if (filePath.startsWith(prefix)) {
        // Get the next path segment after the prefix
        const remaining = filePath.slice(prefix.length);
        const nextSlash = remaining.indexOf('/');
        const entry = nextSlash === -1 ? remaining : remaining.slice(0, nextSlash);
        if (entry) {
          entries.add(entry);
        }
      }
    }

    return Array.from(entries);
  }

  async isDirectory(path: string): Promise<boolean> {
    const normalized = this.normalizePath(path);
    return this.directories.has(normalized) && !this.filePaths.has(normalized);
  }

  async rename(_from: string, _to: string): Promise<void> {
    throw new Error('Rename operations not supported in panel context');
  }

  async stat(path: string): Promise<{ mtime: Date; isDirectory: boolean; size: number }> {
    const normalized = this.normalizePath(path);
    const isDir = await this.isDirectory(normalized);
    const exists = await this.exists(normalized);

    if (!exists) {
      throw new Error(`Path not found: ${path}`);
    }

    return {
      mtime: new Date(),
      isDirectory: isDir,
      size: 0, // Size not available from fileTree
    };
  }

  // Path utilities (synchronous, pure string manipulation)

  join(...paths: string[]): string {
    return paths
      .filter(Boolean)
      .join('/')
      .replace(/\/+/g, '/')
      .replace(/^\//, '');
  }

  dirname(path: string): string {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/');
  }

  basename(path: string, ext?: string): string {
    const base = path.split('/').pop() || '';
    if (ext && base.endsWith(ext)) {
      return base.slice(0, -ext.length);
    }
    return base;
  }

  extname(path: string): string {
    const base = this.basename(path);
    const dotIndex = base.lastIndexOf('.');
    return dotIndex === -1 ? '' : base.slice(dotIndex);
  }

  relative(from: string, to: string): string {
    const fromParts = from.split('/').filter(Boolean);
    const toParts = to.split('/').filter(Boolean);

    // Find common prefix
    let commonLength = 0;
    while (
      commonLength < fromParts.length &&
      commonLength < toParts.length &&
      fromParts[commonLength] === toParts[commonLength]
    ) {
      commonLength++;
    }

    // Build relative path
    const upCount = fromParts.length - commonLength;
    const relativeParts = [
      ...Array(upCount).fill('..'),
      ...toParts.slice(commonLength),
    ];

    return relativeParts.join('/') || '.';
  }

  isAbsolute(path: string): boolean {
    return path.startsWith('/');
  }

  normalize(path: string): string {
    return this.normalizePath(path);
  }

  homedir(): string {
    return '';
  }

  // Private helpers

  private normalizePath(path: string): string {
    return path
      .replace(/^\/+/, '') // Remove leading slashes
      .replace(/\/+$/, '') // Remove trailing slashes
      .replace(/\/+/g, '/'); // Collapse multiple slashes
  }
}
