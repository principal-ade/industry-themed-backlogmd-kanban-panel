import type { Preview } from '@storybook/react-vite';
import type { OtelExportConfig } from '@principal-ai/storybook-addon-otel';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      storySort: {
        order: ['Introduction', 'Panels', '*'],
      },
    },
    otelExport: {
      enabled: true,
      endpoint: 'http://localhost:4318/v1/traces',
      serviceName: 'industry-themed-backlogmd-kanban-panel-storybook',
      resourceAttributes: {
        'environment': 'development',
        'project': 'backlogmd-kanban-panel',
      },
    } as OtelExportConfig,
  },
};

export default preview;
