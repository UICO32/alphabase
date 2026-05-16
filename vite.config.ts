import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron'

/**
 * Forces CJS output for Electron main process builds.
 * vite-plugin-electron's resolveViteConfig uses mergeConfig which concatenates
 * arrays (e.g., formats: ['es'] + ['cjs'] → ['es', 'cjs']). This plugin's
 * `config` hook mutates the config object in-place to override the array,
 * and the `outputOptions` hook force-sets Rollup's CJS format at the final stage.
 */
function forceCJS(): Plugin {
  return {
    name: 'force-electron-cjs',
    enforce: 'post',
    config(config) {
      if (config.build?.lib) {
        config.build.lib.formats = ['cjs']
        config.build.lib.fileName = () => '[name].cjs'
      }
    },
    outputOptions(options) {
      if (typeof options.format === 'string' && options.format !== 'cjs') {
        ;(options as Record<string, unknown>).format = 'cjs'
      }
      if (typeof options.entryFileNames === 'string' && !options.entryFileNames.endsWith('.cjs')) {
        ;(options as Record<string, unknown>).entryFileNames = '[name].cjs'
      }
      return options
    },
  }
}

export default defineConfig(({ mode }) => {
  const isElectron = mode === 'electron'

  return {
    plugins: [
      tailwindcss(),
      react(),
      ...(isElectron ? electron([
        {
          entry: 'electron/main.ts',
          vite: {
            plugins: [forceCJS()],
            build: {
              lib: {
                formats: ['cjs'],
                fileName: () => '[name].cjs',
              },
            },
          },
        },
        {
          entry: 'electron/preload.ts',
          vite: {
            plugins: [forceCJS()],
            build: {
              lib: {
                formats: ['cjs'],
                fileName: () => '[name].cjs',
              },
            },
          },
        },
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
