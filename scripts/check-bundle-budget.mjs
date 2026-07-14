import { existsSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const manifestPath = 'dist/.vite/manifest.json'

if (!existsSync(manifestPath)) {
  console.error(`Bundle budget check requires ${manifestPath}. Run pnpm build first.`)
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const budgets = {
  entry: 130 * 1024,
  topography: 147 * 1024,
  blocknote: 306 * 1024,
}

function gzipSize(file) {
  return gzipSync(readFileSync(`dist/${file}`)).length
}

function filesFor(predicate, extraNames = []) {
  return Object.values(manifest)
    .filter(entry => predicate(entry) || extraNames.includes(entry.name))
    .map(entry => entry.file)
    .filter((file, index, files) => files.indexOf(file) === index)
}

const entryFiles = filesFor(entry => entry.isEntry && entry.src === 'index.html')
const topographyFiles = filesFor(entry => entry.src?.endsWith('TopographyView.tsx'), ['topography'])
const blocknoteFiles = filesFor(entry => entry.src?.endsWith('BlockNoteEditor.tsx'), ['editor-core', 'mantine'])

const checks = [
  ['entry', entryFiles],
  ['topography', topographyFiles],
  ['blocknote', blocknoteFiles],
]

let failed = false
for (const [name, files] of checks) {
  if (files.length === 0) {
    console.error(`Bundle budget check could not find the ${name} chunk in the manifest.`)
    failed = true
    continue
  }
  const size = files.reduce((total, file) => total + gzipSize(file), 0)
  const budget = budgets[name]
  console.log(`${name}: ${(size / 1024).toFixed(1)} KiB gzip / ${(budget / 1024).toFixed(1)} KiB budget`)
  if (size > budget) {
    console.error(`${name} exceeds its gzip budget by ${((size - budget) / 1024).toFixed(1)} KiB.`)
    failed = true
  }
}

process.exit(failed ? 1 : 0)
