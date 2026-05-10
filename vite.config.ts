import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron'

export default defineConfig(({ mode }) => {
  const isElectron = mode === 'electron'

  return {
    plugins: [
      tailwindcss(),
      react(),
      ...(isElectron ? electron([
        { entry: 'electron/main.ts' },
        { entry: 'electron/preload.ts' },
      ]) : []),
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  }
})
