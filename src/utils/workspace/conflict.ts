export interface ConflictCounts {
  expectedCards: number
  actualCards: number
  expectedBoards: number
  actualBoards: number
}

export type ConflictChoice = 'backup' | 'continue' | 'cancel'

/**
 * 磁盘文件比元数据记录多，通常意味着上次运行在写元数据前退出，
 * 磁盘上的内容反而是更新的。此时推荐“恢复备份”会丢数据。
 */
export function isDiskAhead(conflict: ConflictCounts): boolean {
  return conflict.actualCards > conflict.expectedCards || conflict.actualBoards > conflict.expectedBoards
}

export function recommendedConflictChoice(conflict: ConflictCounts, hasBackup: boolean): 'backup' | 'continue' {
  if (!hasBackup) return 'continue'
  return isDiskAhead(conflict) ? 'continue' : 'backup'
}
