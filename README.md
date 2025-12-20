# Kanban Panel for Industry Theme Framework

A Kanban board panel extension for visualizing [Backlog.md](https://github.com/MrLesk/Backlog.md) tasks in the Principal ADE industry-themed panel framework.

## Features

- 📋 **Kanban Board View** - Visual task organization across status columns (To Do, In Progress, Done)
- 🎨 **Industry Theme Integration** - Fully styled with industry theme colors and typography
- 🏷️ **Task Metadata** - Display task labels, assignees, and priority indicators
- 🎯 **Priority Color Coding** - Visual priority indication with colored borders
- 📝 **Task Descriptions** - Truncated descriptions with full task details
- 🧪 **Mock Data Support** - Built-in mock data generator for testing

## Installation

```bash
# Install dependencies
bun install

# Build the panel
bun run build

# Run in development mode with watch
bun run dev

# Run Storybook for component development
bun run storybook
```

## Project Structure

```
src/
├── panels/
│   ├── KanbanPanel.tsx              # Main panel component
│   └── kanban/
│       ├── backlog-types/           # Copied from Backlog.md
│       │   ├── index.ts             # Task type definitions
│       │   └── README.md            # Attribution
│       ├── backlog-utils/           # Copied from Backlog.md
│       │   ├── board.ts             # Board utilities
│       │   └── README.md            # Attribution
│       ├── components/              # Copied from Backlog.md
│       │   ├── Board.tsx            # Board component
│       │   ├── TaskCard.tsx         # Task card component
│       │   ├── TaskColumn.tsx       # Column component
│       │   └── README.md            # Attribution
│       ├── hooks/                   # Custom hooks (future)
│       └── mocks/
│           └── mockData.ts          # Mock data generator
├── index.tsx                        # Panel registration
└── types/
    └── index.ts                     # Type re-exports
```

## Usage

### Registering the Panel

The panel is automatically registered when the package is loaded:

```typescript
import { panels } from '@principal-ade/kanban-panel';

// Panel metadata
{
  id: 'principal-ade.kanban-panel',
  name: 'Kanban Board',
  icon: '📋',
  version: '0.1.0',
  slices: ['fileTree']
}
```

### Mock Data

The panel currently uses mock data for testing. The mock data generator creates sample tasks with:

- Different statuses (To Do, In Progress, Done)
- Priority levels (high, medium, low)
- Labels and assignees
- Descriptions and acceptance criteria
- Task dependencies

```typescript
import { generateMockTasks } from './panels/kanban/mocks/mockData';

const tasks = generateMockTasks();
```

## Attribution

This panel incorporates code from [Backlog.md](https://github.com/MrLesk/Backlog.md):

- **Source commit:** 9b2b4aa4ce7c9dc454215419413109f3efb04708
- **Source date:** 2025-11-15
- **License:** MIT
- **Author:** Alex Gavrilescu (@MrLesk)

See individual README files in each directory for specific attribution details.

### Migration Plan

The copied code is temporary. Once Backlog.md publishes `@backlog/core` or similar packages, we will migrate to using the official packages. See [KANBAN_PANEL_DESIGN.md](./KANBAN_PANEL_DESIGN.md) for details.

## Development Roadmap

### ✅ Phase 1: Foundation (Complete)

- [x] Set up panel structure and basic layout
- [x] Create mock data generator for testing
- [x] Implement basic board component with static columns
- [x] Create task card component with basic styling
- [x] Adapt to industry theme colors and typography

### ✅ Phase 2: Core Functionality (Complete)

- [x] Add data fetching hook (`useKanbanData`)
- [x] Implement task sorting and filtering (by priority, ordinal, date)
- [x] Create reusable `KanbanColumn` component
- [x] Integrate with industry theme system
- [x] Add error handling and loading states
- [x] Create Storybook stories for testing
- [ ] Implement Backlog.md markdown parser (Future)
- [ ] Add drag-and-drop functionality (Future)
- [ ] Handle status updates with file writes (Future)

### 📋 Phase 3: Advanced Features

- [ ] Task creation and editing
- [ ] Support for labels, assignees, priority
- [ ] Implement subtask relationships
- [ ] Add task detail modal/panel
- [ ] Handle dependencies visualization

### 🎨 Phase 4: Polish & Integration

- [ ] Responsive design improvements
- [ ] Error handling and loading states
- [ ] Data persistence (write back to markdown)
- [ ] Panel configuration options
- [ ] Testing and documentation

## Scripts

```bash
# Build
bun run build              # Full build (clean + bundle + types)
bun run build:panel        # Build panel bundle only
bun run build:types        # Generate TypeScript declarations

# Development
bun run dev                # Watch mode for development
bun run typecheck          # Type checking without emit
bun run storybook          # Component development environment

# Code Quality
bun run lint               # Run ESLint
bun run lint:fix           # Auto-fix ESLint issues
bun run format             # Format with Prettier
bun run format:check       # Check formatting

# Testing
bun run test               # Run tests
bun run test:watch         # Watch mode for tests
```

## Dependencies

- **@principal-ade/panel-framework-core** - Panel framework integration
- **@principal-ade/industry-theme** - Industry theme system
- **React 19** - UI library
- **TypeScript** - Type safety
- **lucide-react** - Icon library

## License

MIT - See LICENSE file for details

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## Documentation

- [Design Document](./KANBAN_PANEL_DESIGN.md) - Detailed design and implementation plan
- [Quick Start](./QUICKSTART.md) - Get started quickly
- [Project Structure](./PROJECT_STRUCTURE.md) - Codebase organization
