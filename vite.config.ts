import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode: _mode }) => ({
  plugins: [
    react({
      // Force production JSX runtime to avoid jsxDEV in output
      jsxRuntime: 'automatic',
      jsxImportSource: 'react',
      babel: {
        plugins: [
          [
            '@babel/plugin-transform-react-jsx',
            {
              runtime: 'automatic',
              development: false,
              importSource: 'react',
            },
          ],
        ],
      },
    }),
  ],
  define: {
    // Ensure NODE_ENV is production for React
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: './src/index.tsx',
      name: 'PanelExtension',
      fileName: 'panels.bundle',
      formats: ['es'],
    },
    rollupOptions: {
      // Externalize peer dependencies - these come from the host application
      external: (id) => {
        const externals = [
          'react',
          'react-dom',
          'react/jsx-runtime',
          '@opentelemetry/api',
          '@backlog-md/core',
          // Panel framework dependencies (must be external to avoid SSR issues with react-resizable-panels)
          '@principal-ade/panel-framework-core',
          '@principal-ade/panel-layouts',
          '@principal-ade/panels',
          '@principal-ade/industry-theme',
          '@principal-ade/utcp-panel-event',
          '@principal-ai/repository-abstraction',
          '@industry-theme/markdown-panels',
          'react-resizable-panels',
        ];
        return externals.some(ext => id === ext || id.startsWith(ext + '/'));
      },
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
          '@opentelemetry/api': 'opentelemetry',
        },
      },
    },
    // Generate sourcemaps for debugging
    sourcemap: true,
    // Ensure production mode build
    minify: false,
  },
  // Force production mode for consistent JSX runtime
  mode: 'production',
}));
