import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  beginWorkspaceRun,
  enqueueWorkspaceSwitch,
  isCurrentWorkspaceRun,
  resetWorkspaceSwitchState,
} from './workspaceSwitchController'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}

/** 让已排队的切换任务真正开始执行。 */
function flushMicrotasks() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  resetWorkspaceSwitchState()
})

describe('workspace switch controller', () => {
  it('runs switch tasks one at a time in enqueue order', async () => {
    const order: string[] = []
    const firstGate = deferred()

    const first = enqueueWorkspaceSwitch(async (run) => {
      order.push(`first:start:${run}`)
      await firstGate.promise
      order.push(`first:end:${run}`)
    })
    await flushMicrotasks()
    expect(order).toEqual(['first:start:1'])

    const second = enqueueWorkspaceSwitch(async (run) => {
      order.push(`second:${run}`)
    })

    firstGate.resolve()
    await Promise.all([first, second])

    expect(order).toEqual(['first:start:1', 'first:end:1', 'second:2'])
  })

  it('skips a queued switch that a newer switch superseded', async () => {
    const order: string[] = []
    const gate = deferred()

    const first = enqueueWorkspaceSwitch(async () => {
      await gate.promise
      order.push('first')
    })
    await flushMicrotasks()

    const second = enqueueWorkspaceSwitch(async () => {
      order.push('second')
    })
    const third = enqueueWorkspaceSwitch(async () => {
      order.push('third')
    })

    gate.resolve()
    await Promise.all([first, second, third])

    // second 在排队期间被 third 取代，不应执行。
    expect(order).toEqual(['first', 'third'])
  })

  it('marks an in-flight run as stale once a newer run begins', async () => {
    const gate = deferred()
    const observed: boolean[] = []

    const first = enqueueWorkspaceSwitch(async (run) => {
      observed.push(isCurrentWorkspaceRun(run))
      await gate.promise
      observed.push(isCurrentWorkspaceRun(run))
    })

    await flushMicrotasks()
    const newer = beginWorkspaceRun()
    gate.resolve()
    await first

    expect(observed).toEqual([true, false])
    expect(isCurrentWorkspaceRun(newer)).toBe(true)
  })

  it('keeps the queue alive after a task throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const order: string[] = []

    const failing = enqueueWorkspaceSwitch(async () => {
      throw new Error('boom')
    })
    await flushMicrotasks()

    const next = enqueueWorkspaceSwitch(async () => {
      order.push('next')
    })

    await Promise.all([failing, next])

    expect(order).toEqual(['next'])
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
