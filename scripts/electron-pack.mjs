import { execSync } from 'node:child_process'
import { renameSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const markers = [
  { path: join(root, 'pnpm-lock.yaml'), backup: join(root, 'pnpm-lock.yaml.bak') },
  { path: join(root, 'node_modules', '.modules.yaml'), backup: join(root, 'node_modules', '.modules.yaml.bak') },
]

for (const m of markers) {
  if (existsSync(m.path)) {
    renameSync(m.path, m.backup)
  }
}

try {
  const args = process.argv.slice(2).join(' ')
  execSync(`pnpm exec electron-builder ${args}`, { stdio: 'inherit' })
} finally {
  for (const m of markers) {
    if (existsSync(m.backup)) {
      renameSync(m.backup, m.path)
    }
  }
}
