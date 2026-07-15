import { exists, readdir, readJSON } from './fs'
import type { BoardManifest, WorkspaceMetadata } from './types'

export interface WorkspaceHealthSnapshot {
  cardsDirExists: boolean
  boardsDirExists: boolean
  trashDirExists: boolean
  cardFiles: number
  boardFiles: number
  trashFiles: number
  manifestBoards: number | null
  metadataCards: number | null
  metadataBoards: number | null
}

export interface WorkspaceLossFinding {
  reason: string
  previous?: number | null
  current?: number | null
}

const lastSnapshots = new Map<string, WorkspaceHealthSnapshot>()

async function countJsonFiles(dirPath: string, suffix = '.json'): Promise<{ exists: boolean; count: number }> {
  if (!(await exists(dirPath))) return { exists: false, count: 0 }
  const files = await readdir(dirPath)
  return { exists: true, count: files.filter(file => file.endsWith(suffix)).length }
}

export function evaluateWorkspaceLoss(
  previous: WorkspaceHealthSnapshot | null | undefined,
  current: WorkspaceHealthSnapshot,
): WorkspaceLossFinding[] {
  const findings: WorkspaceLossFinding[] = []

  if (previous && previous.cardFiles > 0 && current.cardFiles === 0) {
    findings.push({ reason: 'card-files-dropped-to-zero', previous: previous.cardFiles, current: current.cardFiles })
  }

  if (current.metadataCards != null && current.metadataCards > 0 && current.cardFiles === 0) {
    findings.push({ reason: 'metadata-cards-present-but-disk-empty', previous: current.metadataCards, current: current.cardFiles })
  }

  if (previous && (previous.manifestBoards ?? 0) > 0 && current.manifestBoards === 0) {
    findings.push({ reason: 'manifest-boards-dropped-to-zero', previous: previous.manifestBoards, current: current.manifestBoards })
  }

  if (current.metadataBoards != null && current.metadataBoards > 0 && current.manifestBoards === 0) {
    findings.push({ reason: 'metadata-boards-present-but-manifest-empty', previous: current.metadataBoards, current: current.manifestBoards })
  }

  return findings
}

export async function getWorkspaceHealthSnapshot(workspacePath: string): Promise<WorkspaceHealthSnapshot> {
  const [cards, boards, trash] = await Promise.all([
    countJsonFiles(`${workspacePath}/cards`),
    countJsonFiles(`${workspacePath}/boards`),
    countJsonFiles(`${workspacePath}/trash`, '.trash.json'),
  ])

  let manifestBoards: number | null = null
  if (await exists(`${workspacePath}/boards/_manifest.json`)) {
    try {
      const manifest = await readJSON<BoardManifest>(`${workspacePath}/boards/_manifest.json`)
      manifestBoards = Array.isArray(manifest.boards) ? manifest.boards.length : null
    } catch {
      manifestBoards = null
    }
  }

  let metadataCards: number | null = null
  let metadataBoards: number | null = null
  if (await exists(`${workspacePath}/_metadata.json`)) {
    try {
      const metadata = await readJSON<WorkspaceMetadata>(`${workspacePath}/_metadata.json`)
      metadataCards = typeof metadata.cardCount === 'number' ? metadata.cardCount : null
      metadataBoards = typeof metadata.boardCount === 'number' ? metadata.boardCount : null
    } catch {
      metadataCards = null
      metadataBoards = null
    }
  }

  return {
    cardsDirExists: cards.exists,
    boardsDirExists: boards.exists,
    trashDirExists: trash.exists,
    cardFiles: cards.count,
    boardFiles: boards.count,
    trashFiles: trash.count,
    manifestBoards,
    metadataCards,
    metadataBoards,
  }
}

export function auditWorkspaceEvent(payload: {
  level?: 'info' | 'warn' | 'error'
  action: string
  workspacePath?: string
  path?: string
  ok?: boolean
  details?: Record<string, unknown>
  error?: string
}) {
  window.electronAPI?.workspace?.auditEvent?.(payload).catch(() => {})
}

export async function auditWorkspaceHealth(
  workspacePath: string,
  reason: string,
  details?: Record<string, unknown>,
): Promise<WorkspaceHealthSnapshot | null> {
  try {
    const previous = lastSnapshots.get(workspacePath)
    const snapshot = await getWorkspaceHealthSnapshot(workspacePath)
    const findings = evaluateWorkspaceLoss(previous, snapshot)
    lastSnapshots.set(workspacePath, snapshot)

    auditWorkspaceEvent({
      action: 'workspace-health',
      workspacePath,
      details: { reason, snapshot, ...details },
    })

    if (findings.length > 0) {
      auditWorkspaceEvent({
        level: 'error',
        action: 'DATA_LOSS_SUSPECTED',
        workspacePath,
        details: { reason, findings, previous, snapshot, ...details },
      })
    }

    return snapshot
  } catch (err) {
    auditWorkspaceEvent({
      level: 'error',
      action: 'workspace-health-failed',
      workspacePath,
      error: err instanceof Error ? err.message : String(err),
      details: { reason },
    })
    return null
  }
}
