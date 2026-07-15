import { describe, expect, it } from 'vitest'
import { evaluateWorkspaceLoss, type WorkspaceHealthSnapshot } from './audit'

const baseSnapshot: WorkspaceHealthSnapshot = {
  cardsDirExists: true,
  boardsDirExists: true,
  trashDirExists: true,
  cardFiles: 12,
  boardFiles: 2,
  trashFiles: 0,
  manifestBoards: 2,
  metadataCards: 12,
  metadataBoards: 2,
}

describe('evaluateWorkspaceLoss', () => {
  it('flags card files dropping to zero between snapshots', () => {
    const findings = evaluateWorkspaceLoss(baseSnapshot, { ...baseSnapshot, cardFiles: 0 })

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'card-files-dropped-to-zero', previous: 12, current: 0 }),
        expect.objectContaining({ reason: 'metadata-cards-present-but-disk-empty', previous: 12, current: 0 }),
      ])
    )
  })

  it('flags manifest boards dropping to zero', () => {
    const findings = evaluateWorkspaceLoss(baseSnapshot, { ...baseSnapshot, manifestBoards: 0 })

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'manifest-boards-dropped-to-zero', previous: 2, current: 0 }),
        expect.objectContaining({ reason: 'metadata-boards-present-but-manifest-empty', previous: 2, current: 0 }),
      ])
    )
  })

  it('does not flag a legitimately empty workspace', () => {
    const emptySnapshot: WorkspaceHealthSnapshot = {
      ...baseSnapshot,
      cardFiles: 0,
      boardFiles: 1,
      manifestBoards: 0,
      metadataCards: 0,
      metadataBoards: 0,
    }

    expect(evaluateWorkspaceLoss(null, emptySnapshot)).toEqual([])
  })
})
