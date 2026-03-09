import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/e2e/**', '**/.next/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['app/**/*.{ts,tsx}'],
      exclude: [
        'app/**/*.d.ts',
        'app/globals.css',
        'app/layout.tsx',
        'app/**/page.tsx',
        'app/types/**',
        // Pure layout shells — no logic to unit-test, covered by E2E
        'app/components/AppShell.tsx',
        'app/components/TopBar.tsx',
      ],
      thresholds: {
        branches: 74,
        functions: 75,
        lines: 85,
        statements: 85,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
