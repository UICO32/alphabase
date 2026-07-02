/**
 * Workspace path security module.
 *
 * Maintains a set of registered workspace root directories and provides
 * path-safety checks used by filesystem IPC handlers in main.ts to prevent
 * path traversal outside allowed workspaces.
 */

const registeredWorkspaces = new Set<string>()

function normalize(p: string): string {
  const resolved = p.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

export function registerWorkspacePath(path: string): void {
  registeredWorkspaces.add(normalize(path))
}

export function unregisterWorkspacePath(path: string): void {
  registeredWorkspaces.delete(normalize(path))
}

export function getRegisteredWorkspacePaths(): string[] {
  return Array.from(registeredWorkspaces)
}

export function isPathWithinWorkspace(filePath: string): boolean {
  if (registeredWorkspaces.size === 0) return false
  const normalized = normalize(filePath)
  for (const ws of registeredWorkspaces) {
    if (normalized === ws || normalized.startsWith(ws + '/')) {
      return true
    }
  }
  return false
}

export function isMediaFilenameSafe(filename: string): boolean {
  if (!filename || filename.length === 0) return false
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return false
  }
  return /^[\w.-]+\.\w+$/.test(filename)
}
