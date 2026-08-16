import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  {
    // Skip build output, generated state, and dependency snapshots.
    ignores: [
      'dist/**',
      'dist-electron/**',
      'release/**',
      'node_modules/**',
      '.gitnexus/**',
      '.tmp/**',
      '.playwright-mcp/**',
      'playwright-report/**',
      'test-results/**',
      'debug/**',
      // 其他分支的独立工作区，不属于当前分支代码
      '.worktrees/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Browser globals for the renderer and public startup scripts.
    files: ['src/**/*.{ts,tsx}', 'public/**/*.js', 'tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    // Node globals for scripts, Electron main/preload, manual test
    // scripts, and config files.
    files: ['electron/**/*.ts', 'scripts/**/*.{mjs,js}', 'tests/manual/**/*.{mjs,js}', '*.config.ts', '*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // Mixed environment (renderer tests run in jsdom but import Node APIs).
    files: ['tests/**/*.{ts,tsx}', 'electron/**/*.test.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'electron/**/*.ts', 'tests/**/*.{ts,tsx}', 'scripts/**/*.{mjs,js}', 'tests/manual/**/*.{mjs,js}', 'public/**/*.js', '*.config.ts'],
    rules: {
      // The project already enforces unused locals/params via tsc
      // (noUnusedLocals / noUnusedParameters). Avoid double-reporting.
      '@typescript-eslint/no-unused-vars': 'off',
      // Allow explicit `any` in test scaffolding and debug helpers; tsc
      // strict mode governs production code.
      '@typescript-eslint/no-explicit-any': 'off',
      // The codebase legitimately uses non-null assertions after guards.
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Error cause preservation requires ES2022 Error constructor (the
      // project targets ES2020). Warn so the debt is visible without
      // breaking tsc; upgrade to error when the lib target is raised.
      'preserve-caught-error': 'warn',
    },
  },
)
