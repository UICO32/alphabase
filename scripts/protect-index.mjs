import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// Vite build modifies index.html in-place, replacing the entry script
// with hashed asset references. On subsequent builds, those hashes
// no longer exist and the build fails. This script restores the
// clean source version before each build.

const root = process.cwd()
const indexPath = join(root, 'index.html')
const backupPath = join(root, 'index.html.src.bak')

// The canonical source entry point
const CLEAN_ENTRY = '<script type="module" src="/src/main.tsx"></script>'
const CLEAN_BODY_END = '</body>\n</html>'

let html = readFileSync(indexPath, 'utf8')

// Remove any Vite-injected asset references (script, link, stylesheet)
html = html.replace(/<script type="module" crossorigin src="\.\/assets\/[^"]+"><\/script>\n?/g, '')
html = html.replace(/<link rel="modulepreload" crossorigin href="\.\/assets\/[^"]+">\n?/g, '')
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/assets\/[^"]+">\n?/g, '')

// Remove absolute-path Vite references too
html = html.replace(/<script type="module" crossorigin src="\/assets\/[^"]+"><\/script>\n?/g, '')
html = html.replace(/<link rel="modulepreload" crossorigin href="\/assets\/[^"]+">\n?/g, '')
html = html.replace(/<link rel="stylesheet" crossorigin href="\/assets\/[^"]+">\n?/g, '')

// Ensure the entry script exists
if (!html.includes('/src/main.tsx')) {
  // Insert entry script before </body>
  html = html.replace('</body>', `${CLEAN_ENTRY}\n  </body>`)
}

writeFileSync(indexPath, html)