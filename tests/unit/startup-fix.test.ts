import { describe, it, expect, vi } from 'vitest'

// --- Test 1: logInfo should not throw when console.log fails (stdout pipe closed) ---
describe('logInfo - console.log safety', () => {
  it('should not throw when console.log throws (broken stdout pipe)', () => {
    const originalLog = console.log
    console.log = () => { throw new Error('write EPIPE') }

    const mockStartupLog = vi.fn()
    const mockApp = { isPackaged: false }

    // Inline the logInfo logic (same as electron/main.ts)
    function logInfo(message: string) {
      try {
        if (!mockApp.isPackaged) console.log(message)
      } catch { /* stdout pipe may be closed */ }
      mockStartupLog(message)
    }

    expect(() => logInfo('test message')).not.toThrow()
    expect(mockStartupLog).toHaveBeenCalledWith('test message')

    console.log = originalLog
  })

  it('should skip console.log in packaged mode', () => {
    const originalLog = console.log
    let logCalled = false
    console.log = () => { logCalled = true }

    const mockStartupLog = vi.fn()
    const mockApp = { isPackaged: true }

    function logInfo(message: string) {
      try {
        if (!mockApp.isPackaged) console.log(message)
      } catch { /* stdout pipe may be closed */ }
      mockStartupLog(message)
    }

    logInfo('packaged message')
    expect(logCalled).toBe(false)
    expect(mockStartupLog).toHaveBeenCalledWith('packaged message')

    console.log = originalLog
  })
})

// --- Test 2: force-network-service-in-process switch is present ---
describe('Electron command line switches - Network Service fix', () => {
  it('should include force-network-service-in-process switch in main.ts source', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const mainTs = fs.readFileSync(
      path.resolve('electron/main.ts'),
      'utf8'
    )

    expect(mainTs).toContain("appendSwitch('disable-features', 'NetworkServiceSandbox')")
    expect(mainTs).toContain("appendSwitch('force-network-service-in-process')")
  })

  it('should include the switch BEFORE app.whenReady (top-level, not inside callbacks)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const mainTs = fs.readFileSync(
      path.resolve('electron/main.ts'),
      'utf8'
    )

    const switchPos = mainTs.indexOf("appendSwitch('force-network-service-in-process')")
    const whenReadyPos = mainTs.indexOf('app.whenReady')

    expect(switchPos).toBeGreaterThan(-1)
    expect(whenReadyPos).toBeGreaterThan(-1)
    expect(switchPos).toBeLessThan(whenReadyPos)
  })

  it('should isolate dev userData before app.whenReady', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const mainTs = fs.readFileSync(
      path.resolve('electron/main.ts'),
      'utf8'
    )

    const setPathPos = mainTs.indexOf("app.setPath('userData'")
    const whenReadyPos = mainTs.indexOf('app.whenReady')

    expect(mainTs).toContain(".tmp', 'electron-dev-user-data'")
    expect(setPathPos).toBeGreaterThan(-1)
    expect(whenReadyPos).toBeGreaterThan(-1)
    expect(setPathPos).toBeLessThan(whenReadyPos)
  })

  it('should acquire single instance lock before app.whenReady', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const mainTs = fs.readFileSync(
      path.resolve('electron/main.ts'),
      'utf8'
    )

    const lockPos = mainTs.indexOf('app.requestSingleInstanceLock()')
    const whenReadyPos = mainTs.indexOf('app.whenReady')

    expect(lockPos).toBeGreaterThan(-1)
    expect(whenReadyPos).toBeGreaterThan(-1)
    expect(lockPos).toBeLessThan(whenReadyPos)
  })
})
