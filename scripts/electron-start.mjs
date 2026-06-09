import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = resolve(fileURLToPath(import.meta.url), '..')

// ELECTRON_RUN_AS_NODE=1 in Windows system env causes Electron to run as Node.js
// instead of as a GUI app. Must be cleared before launching Electron.
delete process.env.ELECTRON_RUN_AS_NODE

const electronPath = createRequire(import.meta.url)('electron')
const child = spawn(electronPath, ['.'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env },
})

child.on('exit', (code) => process.exit(code ?? 0))