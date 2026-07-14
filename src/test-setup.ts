import '@testing-library/react/dont-cleanup-after-each'

/**
 * Q1: Fail tests on un-asserted console.warn / console.error output.
 *
 * By default, any call to console.warn or console.error throws, surfacing
 * unexpected stderr (error-path logs, React act warnings, etc.) as a test
 * failure instead of letting it slip through silently.
 *
 * Tests that intentionally exercise an error path MUST opt in locally:
 *
 *   const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
 *   // ... trigger the path ...
 *   expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('expected message'))
 *   warnSpy.mockRestore()
 *
 * The local spy replaces this guard for the duration of the test, so
 * asserted logs pass through while every other unexpected log still fails.
 */
function failOnUnassertedConsole(method: 'warn' | 'error') {
  const original = console[method]
  console[method] = (...args: unknown[]) => {
    throw new Error(
      `Unexpected console.${method} during test. If this is an intentional error-path log, ` +
        `suppress and assert it with vi.spyOn(console, '${method}').mockImplementation(...).\n` +
        `Arguments: ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`,
    )
  }
  return original
}

const _originalWarn = failOnUnassertedConsole('warn')
const _originalError = failOnUnassertedConsole('error')

// Expose originals so vi.spyOn().mockRestore() restores to the throw-guard,
// not the raw console. Vitest's spyOn captures the current value (the guard),
// so mockRestore correctly returns to the guard after a test.
void _originalWarn
void _originalError
