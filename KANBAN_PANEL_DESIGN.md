# Kanban Panel Design Document

## Overview

This document outlines the design for creating a Kanban Board panel based on the [Backlog.md](https://github.com/MrLesk/Backlog.md) project. The panel will integrate Backlog.md's kanban board functionality into the industry-themed panel framework.

## Project Analysis

### Backlog.md Structure

**Technology Stack:**
- TypeScript
- Bun runtime
- React 19 (web UI)
- Tailwind CSS
- Markdown-based task storage

**Key Features:**
- Markdown-native task storage (individual `.md` files)
- Kanban board with configurable status columns (default: To Do, In Progress, Done)
- Rich task properties: title, description, status, priority, labels, assignees, dependencies
- Drag-and-drop task management
- Parent-child task relationships (subtasks)
- Terminal-based TUI and web-based UI

**Core Components:**

1. **`src/board.ts`** - Core board logic
   - `buildKanbanStatusGroups()` - Groups tasks by status
   - `generateKanbanBoardWithMetadata()` - Generates markdown board export

2. **`src/web/components/Board.tsx`** - Main board React component
   - Manages columns and task organization
   - Handles drag-and-drop state
   - Sorts tasks by ordinal, priority, and date

3. **`src/web/components/TaskCard.tsx`** - Task card component
   - Displays task information (title, description, labels, assignees)
   - Implements drag-and-drop
   - Shows priority with colored left border
   - Truncates long descriptions

4. **`src/web/components/TaskColumn.tsx`** - Column component
   - Drop zone for tasks
   - Displays tasks for a specific status

5. **Task Data Model** (`src/types/index.ts`)
   ```typescript
   interface Task {
     id: string;
     title: string;
     status: string;
     assignee: string[];
     createdDate: string;
     updatedDate?: string;
     labels: string[];
     dependencies: string[];
     description?: string;
     implementationPlan?: string;
     implementationNotes?: string;
     acceptanceCriteriaItems?: AcceptanceCriterion[];
     parentTaskId?: string;
     subtasks?: string[];
     priority?: "high" | "medium" | "low";
     ordinal?: number;
     // ... additional fields
   }
   ```

## Code Reuse Strategy

### Current Approach: Copy with Intent to Migrate

**Backlog.md is NOT currently published as a library.** The npm package only contains CLI binaries - no source code, types, or utilities are exported for reuse.

However, the project contains excellent, reusable code that would benefit the broader ecosystem if published as a standalone package.

### Our Strategy

1. **Short-term:** Copy necessary code from Backlog.md repository (not adapted/modified)
2. **Long-term:** Migrate to official `@backlog/core` or `@backlog/types` package once available
3. **Collaboration:** Notify Backlog.md team about the value of publishing reusable packages

### Proposed Package Structure for Backlog.md Team

We recommend the Backlog.md team publish a separate package with the following structure:

```typescript
// Package: @backlog/core or @backlog/types
// Version: 1.0.0

// src/index.ts - Main export
export * from './types'
export * from './utils'

// src/types/index.ts - Core type definitions
export interface Task {
  id: string
  title: string
  status: string
  assignee: string[]
  createdDate: string
  updatedDate?: string
  labels: string[]
  dependencies: string[]
  description?: string
  implementationPlan?: string
  implementationNotes?: string
  acceptanceCriteriaItems?: AcceptanceCriterion[]
  parentTaskId?: string
  subtasks?: string[]
  priority?: "high" | "medium" | "low"
  ordinal?: number
  branch?: string
  filePath?: string
  lastModified?: Date
  source?: "local" | "remote" | "completed"
}

export interface AcceptanceCriterion {
  index: number
  text: string
  checked: boolean
}

export interface Decision {
  id: string
  title: string
  date: string
  status: "proposed" | "accepted" | "rejected" | "superseded"
  context: string
  decision: string
  consequences: string
  alternatives?: string
}

// Additional types...

// src/utils/index.ts - Pure utility functions
export function buildKanbanStatusGroups(
  tasks: Task[],
  statuses: string[]
): {
  orderedStatuses: string[]
  groupedTasks: Map<string, Task[]>
}

export function sortTasksByOrdinalAndDate(
  tasks: Task[],
  isDoneStatus: boolean
): Task[]

// Additional utilities...
```

### Files to Copy from Backlog.md

For our panel implementation, we will copy the following files **without modification**:

```
From Backlog.md → To Our Panel
─────────────────────────────────────────────────
src/types/index.ts           → src/panels/kanban/backlog-types/index.ts
src/board.ts                 → src/panels/kanban/backlog-utils/board.ts
src/web/components/Board.tsx → src/panels/kanban/components/Board.tsx
src/web/components/TaskCard.tsx → src/panels/kanban/components/TaskCard.tsx
src/web/components/TaskColumn.tsx → src/panels/kanban/components/TaskColumn.tsx
```

**Important:** We will maintain these as unmodified copies with clear attribution and licensing. When `@backlog/core` is published, we will replace our copies with the official package.

### Benefits of Publishing @backlog/core

**For the Backlog.md team:**
- Broader adoption of Backlog.md format
- Community contributions to core types
- Separation of concerns (CLI vs. library)
- Enables integrations like this panel

**For the ecosystem:**
- Standard types for task/kanban data
- Reusable utilities for task management
- Interoperability between tools
- Less code duplication

### Communication Plan

1. **Create GitHub Issue** on Backlog.md repository:
   - Title: "Feature Request: Publish @backlog/core package with types and utilities"
   - Explain use case (panel integration)
   - Propose package structure
   - Offer to help with packaging/testing

2. **Draft Package Specification:**
   - Document exact exports needed
   - Suggest semver strategy
   - Outline migration path from current structure

3. **Maintain Attribution:**
   - Keep LICENSE notices in copied files
   - Add comments linking to original source
   - Document version/commit we copied from

### Folder Structure (Our Panel)

```
src/panels/kanban/
├── backlog-types/          # Copied from Backlog.md (unmodified)
│   ├── index.ts            # From: Backlog.md/src/types/index.ts
│   └── README.md           # Attribution & source info
├── backlog-utils/          # Copied utilities (unmodified)
│   ├── board.ts            # From: Backlog.md/src/board.ts
│   └── README.md           # Attribution & source info
├── components/             # Copied React components (unmodified)
│   ├── Board.tsx           # From: Backlog.md/src/web/components/Board.tsx
│   ├── TaskCard.tsx        # From: Backlog.md/src/web/components/TaskCard.tsx
│   └── TaskColumn.tsx      # From: Backlog.md/src/web/components/TaskColumn.tsx
├── hooks/                  # Our custom hooks
│   └── useKanbanData.ts
└── index.tsx               # Panel entry point
```

### Dependencies to Install

Since we're copying code that has dependencies, we'll need to install:

```json
{
  "dependencies": {
    "gray-matter": "^4.0.3"     // For parsing markdown frontmatter (optional)
  }
}
```

**Note:** The React components we're copying don't have external dependencies beyond React itself. If we add markdown parsing functionality, we'll need `gray-matter`.

Each copied directory will contain a README.md:
```markdown
# Attribution

This code is copied from [Backlog.md](https://github.com/MrLesk/Backlog.md)

- Source commit: 9b2b4aa4ce7c9dc454215419413109f3efb04708
- Source date: 2025-11-18
- Source path: src/types/index.ts (example)
- License: MIT
- Original author: Alex Gavrilescu (@MrLesk)

## Migration Plan

Once Backlog.md publishes `@backlog/core`, this directory will be removed
and replaced with:

```typescript
import { Task, AcceptanceCriterion } from '@backlog/core'
```

**Status:** Tracking via GitHub issue: [link to be added]
```

## Panel Design

### Architecture

```
┌─────────────────────────────────────────────────┐
│           Kanban Panel Container                │
├─────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ To Do    │  │In Progress│  │  Done    │      │
│  ├──────────┤  ├──────────┤  ├──────────┤      │
│  │ Task 1   │  │ Task 3   │  │ Task 5   │      │
│  │ ────────│  │ ────────│  │ ────────│      │
│  │ Task 2   │  │ Task 4   │  │          │      │
│  │          │  │          │  │          │      │
│  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────┘
```

### Components Hierarchy

```
KanbanPanel/
├── KanbanBoard.tsx          # Main board container
├── KanbanColumn.tsx         # Column component
├── KanbanTaskCard.tsx       # Task card component
├── hooks/
│   ├── useBacklogData.ts    # Hook to fetch/manage Backlog.md data
│   └── useDragAndDrop.ts    # Drag-and-drop logic
├── types/
│   └── kanban.types.ts      # Type definitions
└── utils/
    ├── backlogParser.ts     # Parse Backlog.md markdown files
    └── taskHelpers.ts       # Task sorting, filtering utilities
```

### Key Features to Implement

1. **Data Integration**
   - Read tasks from Backlog.md format (markdown files)
   - Support multiple data sources:
     - Local file system (via File System Access API)
     - Remote API endpoint
     - Demo/mock data for testing

2. **Kanban Board View**
   - Configurable status columns
   - Responsive layout (flex-based like original)
   - Smooth scrolling for overflow

3. **Task Cards**
   - Display task metadata (title, ID, labels, assignees)
   - Priority indicator (colored left border)
   - Truncated description with hover to expand
   - Click to view full details (modal/side panel)

4. **Drag and Drop**
   - Drag tasks between columns (status change)
   - Reorder tasks within columns
   - Visual feedback during drag
   - Optimistic UI updates

5. **Task Management**
   - Create new tasks
   - Edit task details
   - Archive/delete tasks
   - Support for subtasks (nested display)

6. **Industry Theme Integration**
   - Adapt color scheme to match industry theme
   - Use industry-themed icons and styling
   - Maintain consistent typography and spacing

### Data Flow

```
┌─────────────────┐
│ Backlog.md      │
│ (Markdown files)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Data Loader     │
│ (Parser)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│ Panel State     │◄────►│ User Actions    │
│ (React State)   │      │ (Drag, Edit)    │
└────────┬────────┘      └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Kanban UI       │
│ (React Render)  │
└─────────────────┘
```

### Implementation Phases

#### Phase 1: Foundation (Week 1)
- [ ] Set up panel structure and basic layout
- [ ] Create mock data generator for testing
- [ ] Implement basic board component with static columns
- [ ] Create task card component with basic styling
- [ ] Adapt to industry theme colors and typography

#### Phase 2: Core Functionality (Week 2)
- [ ] Implement Backlog.md markdown parser
- [ ] Add data fetching hook
- [ ] Implement task sorting and filtering
- [ ] Add drag-and-drop functionality
- [ ] Handle status updates

#### Phase 3: Advanced Features (Week 3)
- [ ] Task creation and editing
- [ ] Support for labels, assignees, priority
- [ ] Implement subtask relationships
- [ ] Add task detail modal/panel
- [ ] Handle dependencies visualization

#### Phase 4: Polish & Integration (Week 4)
- [ ] Responsive design improvements
- [ ] Error handling and loading states
- [ ] Data persistence (write back to markdown)
- [ ] Panel configuration options
- [ ] Testing and documentation

### Technical Considerations

1. **React 19 Compatibility**
   - Current project uses React 19
   - Backlog.md also uses React 19
   - Should be compatible, but test new features (e.g., use hook)

2. **Markdown Parsing**
   - Use `gray-matter` for frontmatter parsing (same as Backlog.md)
   - Parse markdown body for description and sections
   - Handle structured acceptance criteria

3. **File System Access**
   - For local Backlog.md repos, use File System Access API
   - Requires user permission and browser support
   - Fallback to API endpoint or manual file upload

4. **State Management**
   - React state for UI interactions
   - Consider Zustand or Jotai for complex state
   - Optimistic updates for better UX

5. **Performance**
   - Virtual scrolling for large task lists
   - Debounce search and filter operations
   - Memoize expensive computations

### Data Source Options

#### Option 1: Local File System
**Pros:**
- Direct access to Backlog.md repo
- Real-time updates
- No backend required

**Cons:**
- Browser API limitations
- Requires user permission
- Not supported in all browsers

#### Option 2: API Endpoint
**Pros:**
- Works across all browsers
- Can integrate with existing Backlog.md server
- Better for shared/team usage

**Cons:**
- Requires backend setup
- Additional latency
- More complex architecture

#### Option 3: Demo/Mock Data
**Pros:**
- Easy for testing and demos
- No dependencies
- Always works

**Cons:**
- Not connected to real data
- Limited functionality
- Not production-ready

**Recommendation:** Start with Option 3 (mock data) for initial development, then add Option 2 (API) for production use, with Option 1 (file system) as a future enhancement.

### Styling Strategy

1. **Use Industry Theme Variables**
   - Leverage existing theme colors
   - Maintain consistent spacing scale
   - Use theme typography system

2. **Adapt Backlog.md Styles**
   - Keep priority colors (red/yellow/green)
   - Maintain hover states and transitions
   - Preserve drag-and-drop visual feedback

3. **Dark Mode Support**
   - Respect panel theme settings
   - Use theme-aware color utilities
   - Test in both light and dark modes

### Configuration Options

```typescript
interface KanbanPanelConfig {
  // Data source
  dataSource: 'mock' | 'api' | 'filesystem';
  apiEndpoint?: string;

  // Board settings
  columns: string[]; // Status columns
  defaultColumn: string;

  // Display options
  showDescription: boolean;
  truncateLength: number;
  showLabels: boolean;
  showAssignees: boolean;
  showPriority: boolean;

  // Features
  enableDragDrop: boolean;
  enableEdit: boolean;
  enableCreate: boolean;

  // Theme
  accentColor?: string;
}
```

## Next Steps

### Immediate (Week 1)
1. Review this design document
2. Copy necessary files from Backlog.md repository
3. Set up panel folder structure with attribution
4. Create mock data generator
5. Begin Phase 1 implementation

### Package Collaboration (Parallel Track)
1. **Draft GitHub Issue for Backlog.md team:**
   - Clearly explain the use case
   - Propose `@backlog/core` package structure
   - Link to this design doc for context
   - Offer collaboration/testing support

2. **Package Requirements Document:**
   - List exact types/utilities needed
   - Define API surface area
   - Suggest versioning strategy
   - Document breaking changes policy

3. **Community Outreach:**
   - Post in Backlog.md discussions
   - Share on relevant forums (if appropriate)
   - Gauge interest from other potential users

### GitHub Issue Template (Draft)

```markdown
## Feature Request: Publish @backlog/core Package

### Summary
Backlog.md contains excellent, reusable types and utilities that would benefit
the broader ecosystem if published as a standalone package. Currently, only the
CLI binary is published to npm, making it difficult for other projects to
integrate with Backlog.md's data format.

### Use Case
We're building a kanban panel that visualizes Backlog.md tasks. Rather than
duplicating code, we'd like to use official types and utilities from a
published package.

### Proposed Package: `@backlog/core`

**Exports:**
- Core types: `Task`, `AcceptanceCriterion`, `Decision`, etc.
- Utilities: `buildKanbanStatusGroups`, task sorting/filtering functions
- Markdown parser/serializer (optional)

**Benefits:**
- Enables integrations and extensions
- Standard types for task management ecosystem
- Community contributions to core functionality
- Separation of CLI and library concerns

### Proposed Structure
See: [link to this design doc, Code Reuse Strategy section]

### Offer to Help
We're happy to:
- Help with initial packaging
- Test pre-release versions
- Provide feedback on API design
- Contribute documentation

### Current Workaround
For now, we'll copy the necessary files with full attribution and plan to
migrate to the official package once available.
```

## References

- [Backlog.md Repository](https://github.com/MrLesk/Backlog.md)
- [Backlog.md Documentation](https://backlog.md)
- [Industry Theme Panel Starter](https://github.com/your-repo/industry-themed-panel-starter)
- [React 19 Documentation](https://react.dev)
- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
