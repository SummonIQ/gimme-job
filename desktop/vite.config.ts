import { resolve } from 'node:path';

import { defineConfig } from 'vite';

export default defineConfig({
  // Electron loads the built `index.html` via `file://` — absolute asset
  // paths (`/assets/...`) resolve from the filesystem root, not the HTML's
  // directory, so the renderer's JS + CSS never load and the React tree
  // never mounts (black window with the assist BrowserView showing on top).
  // Relative `./` paths fix that for production; the dev server still uses
  // `/` because Vite ignores `base` when it serves through HTTP.
  base: './',
  build: {
    outDir: 'dist-renderer',
  },
  optimizeDeps: {
    // Force every import of react / react-dom (including transitive ones
    // from @radix-ui/* resolved against the project root's node_modules)
    // to use the SAME pre-bundled copy. Without this, Radix loads a
    // second React from `../node_modules`, the dispatcher is null for
    // any hook called from Radix code, and the whole renderer crashes
    // with "Invalid hook call" the moment a <Select> mounts.
    include: ['react', 'react-dom', 'react-dom/client'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '..'),
      react: resolve(__dirname, 'node_modules/react'),
      'react-dom': resolve(__dirname, 'node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
  },
});
