import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { getRegisteredWorkspacePaths, isPathWithinWorkspace, isRegisteredWorkspaceRoot, registerWorkspacePath, unregisterWorkspacePath } from './workspacePaths'

describe('workspace path authorization', () => {
  const workspace = `C:\\workspace-security-${Date.now()}`

  beforeEach(() => registerWorkspacePath(workspace))
  afterEach(() => unregisterWorkspacePath(workspace))

  it('allows files that are descendants of a registered workspace', () => {
    expect(isPathWithinWorkspace(`${workspace}\\cards\\card-1.json`)).toBe(true)
  })

  it('rejects a sibling whose name only shares the workspace prefix', () => {
    expect(isPathWithinWorkspace(`${workspace}-backup\\card-1.json`)).toBe(false)
  })

  it('rejects path traversal outside the registered workspace', () => {
    expect(isPathWithinWorkspace(`${workspace}\\..\\secret.txt`)).toBe(false)
  })

  it('rejects unregistered paths', () => {
    expect(isPathWithinWorkspace(`C:\\unregistered-security-${Date.now()}\\card-1.json`)).toBe(false)
  })
})

describe('workspace path authorization with real paths', () => {
  const temporaryWorkspaces: Array<{ root: string; workspace: string }> = []

  afterEach(() => {
    for (const { root, workspace } of temporaryWorkspaces.splice(0)) {
      unregisterWorkspacePath(workspace)
      rmSync(root, { recursive: true, force: true })
    }
  })

  function createWorkspace() {
    const root = mkdtempSync(join(tmpdir(), 'hepta-workspace-security-'))
    const workspace = join(root, 'workspace')
    mkdirSync(workspace)
    temporaryWorkspaces.push({ root, workspace })
    registerWorkspacePath(workspace)
    return { root, workspace }
  }

  it('allows a real file inside a registered workspace', () => {
    const { workspace } = createWorkspace()
    const cardPath = join(workspace, 'cards', 'card-1.json')
    mkdirSync(join(workspace, 'cards'))
    writeFileSync(cardPath, '{}')

    expect(isPathWithinWorkspace(cardPath)).toBe(true)
  })

  it('accepts a case variant only when it resolves to the registered workspace', () => {
    const { root, workspace } = createWorkspace()
    const caseVariantWorkspace = join(root, 'WORKSPACE')
    const cardPath = join(workspace, 'cards', 'card-1.json')
    mkdirSync(join(workspace, 'cards'))
    writeFileSync(cardPath, '{}')

    let resolvesToWorkspace = false
    try {
      resolvesToWorkspace = realpathSync.native(caseVariantWorkspace) === realpathSync.native(workspace)
    } catch {
      // Case-sensitive filesystems do not resolve this distinct path.
    }

    expect(isPathWithinWorkspace(join(caseVariantWorkspace, 'cards', 'card-1.json'))).toBe(resolvesToWorkspace)
  })

  it('rejects a symbolic-link or directory-junction escape', () => {
    const { root, workspace } = createWorkspace()
    const outsideDirectory = join(root, 'outside')
    const linkedDirectory = join(workspace, 'linked-outside')
    const secretPath = join(outsideDirectory, 'secret.txt')
    mkdirSync(outsideDirectory)
    writeFileSync(secretPath, 'secret')
    symlinkSync(outsideDirectory, linkedDirectory, process.platform === 'win32' ? 'junction' : 'dir')

    expect(isPathWithinWorkspace(join(linkedDirectory, 'secret.txt'))).toBe(false)
  })

  it('rejects a workspace root replaced by a symbolic link or directory junction', () => {
    const { root, workspace } = createWorkspace()
    const outsideDirectory = join(root, 'replacement-target')
    mkdirSync(outsideDirectory)
    writeFileSync(join(outsideDirectory, 'secret.txt'), 'secret')
    rmSync(workspace, { recursive: true, force: true })
    symlinkSync(outsideDirectory, workspace, process.platform === 'win32' ? 'junction' : 'dir')

    expect(isPathWithinWorkspace(join(workspace, 'secret.txt'))).toBe(false)
  })

  it('unregisters by the original path identity after the root is retargeted', () => {
    const { root, workspace } = createWorkspace()
    const registeredCanonicalPath = getRegisteredWorkspacePaths().find((path) => isPathWithinWorkspace(path))
    expect(registeredCanonicalPath).toBeDefined()
    const outsideDirectory = join(root, 'replacement-target')
    mkdirSync(outsideDirectory)
    rmSync(workspace, { recursive: true, force: true })
    symlinkSync(outsideDirectory, workspace, process.platform === 'win32' ? 'junction' : 'dir')

    unregisterWorkspacePath(workspace)

    expect(getRegisteredWorkspacePaths()).not.toContain(registeredCanonicalPath)
  })

  it.skipIf(process.platform !== 'win32')('allows case variants for a canonical Windows root and missing descendants', () => {
    const { workspace } = createWorkspace()

    expect(isPathWithinWorkspace(join(workspace.toUpperCase(), 'MISSING', 'card.json'))).toBe(true)
  })

  it('recognizes only the exact registered workspace root', () => {
    const { workspace } = createWorkspace()

    expect(isRegisteredWorkspaceRoot(workspace)).toBe(true)
    expect(isRegisteredWorkspaceRoot(join(workspace, 'cards'))).toBe(false)
  })

  it.skipIf(process.platform !== 'win32')('recognizes a case variant of a registered Windows root', () => {
    const { workspace } = createWorkspace()

    expect(isRegisteredWorkspaceRoot(workspace.toUpperCase())).toBe(true)
  })
})
