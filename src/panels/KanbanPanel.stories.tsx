import type { Meta, StoryObj } from '@storybook/react';
import { KanbanPanel } from './KanbanPanel';
import { createMockContext, createMockActions, createMockEvents } from '../mocks/panelContext';

const meta = {
  title: 'Panels/KanbanPanel',
  component: KanbanPanel,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof KanbanPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    context: createMockContext(),
    actions: createMockActions(),
    events: createMockEvents(),
  },
};

export const WithRepository: Story = {
  args: {
    context: createMockContext({
      currentScope: {
        type: 'repository',
        workspace: {
          name: 'my-workspace',
          path: '/Users/developer/my-workspace',
        },
        repository: {
          path: '/Users/developer/projects/my-kanban-project',
          name: 'my-kanban-project',
        },
      },
    }),
    actions: createMockActions(),
    events: createMockEvents(),
  },
};

export const Loading: Story = {
  args: {
    context: createMockContext(),
    actions: createMockActions(),
    events: createMockEvents(),
  },
  parameters: {
    docs: {
      description: {
        story: 'The loading state is shown briefly when refreshing data.',
      },
    },
  },
};
