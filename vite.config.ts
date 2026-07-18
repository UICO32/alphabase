import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron'

function dominoShim(): Plugin {
  return {
    name: 'domino-shim',
    transform(code, id) {
      if (!id.includes('turndown')) return
      return code.replace(
        /var domino = require\(['"]@mixmark-io\/domino['"]\);?\n?\s*Parser\.prototype\.parseFromString = function \(string\) \{\n?\s*return domino\.createDocument\(string\);/,
        `var { parseHTML } = require('linkedom');\nParser.prototype.parseFromString = function(string) {\n      return parseHTML(string).document;`,
      )
    },
  }
}

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

function cleanElectronEnv(): Plugin {
  return {
    name: 'clean-electron-env',
    configResolved() {
      delete process.env.ELECTRON_RUN_AS_NODE
    },
    // Inject `delete process.env.ELECTRON_RUN_AS_NODE` at the VERY TOP of the
    // bundled output, before any require("electron"). Rollup hoists require()
    // calls above user code, so a bare `delete` in the source gets placed after
    // them. This renderChunk hook ensures it runs first at runtime.
    // Note: this only helps in dev mode. In packaged mode, ELECTRON_RUN_AS_NODE
    // decides the process mode before any JS runs, so self-reexec is impossible.
    // Users must clear the env var before launching the packaged exe.
    renderChunk(code, _chunk) {
      if (code.includes('require("electron")') || code.includes("require('electron')")) {
        const injected = 'delete process.env.ELECTRON_RUN_AS_NODE;\n'
        if (code.startsWith('"use strict"')) {
          const nl = code.indexOf('\n')
          return { code: code.slice(0, nl + 1) + injected + code.slice(nl + 1), map: null }
        }
        return { code: injected + code, map: null }
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const isElectron = mode === 'electron'

  return {
    base: isElectron ? './' : '/',
    plugins: [
      tailwindcss(),
      react(),
      ...(isElectron ? electron([
        {
          entry: 'electron/main.ts',
          vite: {
            plugins: [forceCJS(), cleanElectronEnv(), dominoShim()],
            build: {
              lib: {
                formats: ['cjs'],
                fileName: () => '[name].cjs',
              },
              rollupOptions: {
                external: [
                  'canvas', 'linkedom', 'sharp',
                  '@mozilla/readability',
                  'onnxruntime-node',
                ],
              },
            },
          },
        },
        {
          entry: 'electron/preload.ts',
          vite: {
            plugins: [forceCJS(), cleanElectronEnv()],
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
      manifest: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'react-core'
            if (id.includes('@blocknote/mantine') || id.includes('@mantine/')) return 'mantine'
            if (id.includes('@blocknote/') || id.includes('@mantine/tiptap/') || id.includes('@tiptap/') || id.includes('prosemirror-')) {
              return 'editor-core'
            }
            if (id.includes('@react-three/') || id.includes('/three/')) return 'topography'
            if (id.includes('@xyflow/')) return 'canvas'
            if (id.includes('/motion/')) return 'motion'
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': '/src',
      },
      deduplicate: ['prosemirror-tables'],
    },
    server: {
      watch: {
        ignored: ['**/prototype/**'],
      },
    },
    optimizeDeps: {
      include: [
        'use-sync-external-store/shim/with-selector.js',
        'zustand/traditional',
        'zustand/vanilla',
        'react', 'react-dom',
        '@xyflow/react',
        '@blocknote/core', '@blocknote/react', '@blocknote/mantine',
        'lucide-react',
        'dompurify',
        'ts-md5',
      ],
      exclude: [
        'three',
        '@react-three/fiber',
        '@react-three/drei',
        'onnxruntime-node',
        'sharp',
      ],
    },
  }
})
