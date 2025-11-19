import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode: _mode }) => ({
  plugins: [
    react({
      // Force production JSX runtime to avoid jsxDEV in output
      jsxRuntime: 'automatic',
      jsxImportSource: 'react',
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
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
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
