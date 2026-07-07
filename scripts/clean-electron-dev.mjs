import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const electronPath = resolve(root, 'node_modules', 'electron', 'dist', 'electron.exe')

if (process.platform !== 'win32') {
  process.exit(0)
}

const escapedPath = electronPath.replace(/'/g, "''")
const escapedRoot = root.replace(/'/g, "''")
const ps = `
$electronPath = '${escapedPath}'
$repoRoot = '${escapedRoot}'
Get-CimInstance Win32_Process |
  Where-Object {
    $_.ExecutablePath -eq $electronPath -and
    $_.CommandLine -like "*$repoRoot*"
  } |
  ForEach-Object {
    try {
      Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
      Write-Host "[electron:dev] stopped stale electron process $($_.ProcessId)"
    } catch {
      Write-Host "[electron:dev] could not stop process $($_.ProcessId): $($_.Exception.Message)"
    }
  }
`

try {
  execFileSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    ps,
  ], { stdio: 'inherit' })
} catch (error) {
  console.warn(`[electron:dev] stale process cleanup skipped: ${error.message}`)
}
