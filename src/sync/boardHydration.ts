/**
 * 画板水合标记。
 *
 * 切换画板时 useWorkspaceLifecycle 会把 store 里的快照灌进 React Flow 的 nodes/edges；
 * useBoardSync 会把 nodes/edges 的变化当成用户改动排盘。两者需要区分：
 * 水合刚完成的第一次变化不是脏数据，不能触发写盘（否则每次切板都白写一次，
 * 启动阶段也可能在引擎就绪前排盘）。
 *
 * 这里用一个单调递增的序号标记“刚水合过”，useBoardSync 消费一次后恢复常规排盘。
 */
let hydrationSeq = 0

export function markBoardHydrated(): void {
  hydrationSeq += 1
}

export function getBoardHydrationSeq(): number {
  return hydrationSeq
}
