import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}', 'electron/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Anti-regression thresholds only: set just below current coverage
      // (baseline: lines 10.13%, branches 63.83%, functions 40.88%,
      // statements 10.13%) so the suite fails if coverage drops further.
      // Raise over time as tests are added.
      thresholds: {
        lines: 10,
        functions: 38,
        statements: 10,
        branches: 60,
      },
      exclude: [
        'dist/**',
        'dist-electron/**',
        'node_modules/**',
        '**/*.config.*',
        '**/*.test.*',
        'src/vite-env.d.ts',
        'src/types/**',
        'scripts/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
