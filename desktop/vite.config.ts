import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist-renderer',
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
  },
});
