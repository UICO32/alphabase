/**
 * Workspace path security module.
 *
 * Maintains registered workspace root directories and provides
 * path-safety checks used by filesystem IPC handlers in main.ts to prevent
 * path traversal outside allowed workspaces.
 */

import { realpathSync } from 'node:fs'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'

const registeredWorkspaces = new Map<string, string>()

function normalize(p: string): string {
  const resolved = resolve(p).replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function resolveWithRealPath(path: string): string {
  let candidate = resolve(path)
  const unresolvedSegments: string[] = []

  while (true) {
    try {
      return normalize(resolve(realpathSync.native(candidate), ...unresolvedSegments))
    } catch {
      const parent = dirname(candidate)
      if (parent === candidate) return normalize(path)
      unresolvedSegments.unshift(basename(candidate))
      candidate = parent
    }
  }
}

export function registerWorkspacePath(path: string): void {
  registeredWorkspaces.set(normalize(path), resolveWithRealPath(path))
}

export function unregisterWorkspacePath(path: string): void {
  registeredWorkspaces.delete(normalize(path))
}

export function getRegisteredWorkspacePaths(): string[] {
  return [...new Set(registeredWorkspaces.values())]
}

export function isPathWithinWorkspace(filePath: string): boolean {
  if (registeredWorkspaces.size === 0) return false
  const normalized = resolveWithRealPath(filePath)
  for (const ws of registeredWorkspaces.values()) {
    const pathFromWorkspace = relative(ws, normalized)
    if (pathFromWorkspace === '' || (!pathFromWorkspace.startsWith('..') && !isAbsolute(pathFromWorkspace))) {
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
