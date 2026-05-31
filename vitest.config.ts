import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    include: [
      '**/__tests__/**/*.test.{ts,tsx}',
      '**/__tests__/**/*.a11y.test.{ts,tsx}',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      include: [
        'lib/**/*.{ts,tsx}',
        'app/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/__tests__/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/node_modules/**',
        '**/.next/**',
        '**/dist/**',
        '**/*.config.{ts,js}',
        '**/types/**',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 55,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@/': `${path.resolve(__dirname, '.')}/`,
    },
  },
});
