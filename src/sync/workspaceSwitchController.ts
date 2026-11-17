/**
 * 工作区切换的运行代号与串行队列。
 *
 * 切换由事件触发，是 fire-and-forget 的异步流程；上一次切换尚未完成时再次选择工作区，
 * 两次流程可能交错。这里做两件事：
 * - 每次切换分配单调递增的运行代号，只有最新代号可以继续操作 store、引擎和订阅；
 * - 切换流程串行执行，被更新切换取代的排队任务直接跳过。
 *
 * 运行代号由切换流程和 useWorkspaceDataLoader 共用：加载流程在每个 await 之后
 * 用 isCurrentWorkspaceRun 判断自己是否已过期，过期就丢弃自己的引擎与订阅并退出。
 */

type SwitchTask = (run: number) => Promise<void>

let currentRun = 0
let queue: Promise<void> = Promise.resolve()

/** 开启新一轮：让所有在途运行过期，返回新代号。 */
export function beginWorkspaceRun(): number {
  currentRun += 1
  return currentRun
}

export function isCurrentWorkspaceRun(run: number): boolean {
  return run === currentRun
}

/** 串行执行切换流程；排队期间被更新切换取代的任务不会执行。 */
export function enqueueWorkspaceSwitch(task: SwitchTask): Promise<void> {
  const run = beginWorkspaceRun()
  const next = queue.then(async () => {
    if (!isCurrentWorkspaceRun(run)) return
    await task(run)
  }).catch((error) => {
    console.error('[workspace] switch task failed:', error)
  })
  queue = next
  return next
}

/** 仅测试用：重置模块级状态，避免用例之间互相影响。 */
export function resetWorkspaceSwitchState(): void {
  currentRun = 0
  queue = Promise.resolve()
}
