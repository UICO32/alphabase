import { describe, expect, it } from 'vitest'
import { isPathWithinWorkspace, registerWorkspacePath } from '../../electron/workspacePaths'

describe('workspace path authorization', () => {
  const workspace = `C:\\workspace-security-${Date.now()}`

  registerWorkspacePath(workspace)

  it('allows files that are descendants of a registered workspace', () => {
    expect(isPathWithinWorkspace(`${workspace}\\cards\\card-1.json`)).toBe(true)
  })

  it('rejects a sibling whose name only shares the workspace prefix', () => {
    expect(isPathWithinWorkspace(`${workspace}-backup\\card-1.json`)).toBe(false)
  })

  it('rejects path traversal outside the registered workspace', () => {
    expect(isPathWithinWorkspace(`${workspace}\\..\\secret.txt`)).toBe(false)
  })
})
