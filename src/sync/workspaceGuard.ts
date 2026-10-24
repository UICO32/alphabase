import { useWorkspaceStore } from '../stores/workspaceStore'
import { getActiveSyncEngine } from './syncEngineRef'

/**
 * 延迟任务（自动备份、内联媒体迁移）在发起时捕获了 workspacePath。
 * 工作区切换后这些任务若继续执行，会把当前工作区的数据按旧路径写入，
 * 造成跨工作区污染。执行前必须确认工作区归属没有变化。
 */
export function isWorkspaceActive(workspacePath: string): boolean {
  if (!workspacePath) return false
  const currentPath = useWorkspaceStore.getState().currentWorkspace?.path
  const enginePath = getActiveSyncEngine()?.getWorkspacePath()
  return currentPath === workspacePath && enginePath === workspacePath
}
