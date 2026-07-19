import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(`${process.cwd()}/${path}`, 'utf8')

describe('overlay foundation', () => {
  it.each([
    'src/components/ui/shadcn/context-menu.tsx',
    'src/components/ui/shadcn/select.tsx',
  ])('%s uses the shared floating surface without zoom motion', (path) => {
    const source = read(path)
    expect(source).toContain('ui-floating-surface')
    expect(source).toContain('ui-floating-content')
    expect(source).not.toMatch(/zoom-(?:in|out)/)
    expect(source).not.toMatch(/\bz-(?:50|\[60\])\b/)
  })

  it('uses the lightweight shared tooltip motion without zoom', () => {
    const source = read('src/components/ui/shadcn/tooltip.tsx')
    expect(source).toContain('ui-tooltip-content')
    expect(source).not.toMatch(/zoom-(?:in|out)/)
    expect(source).not.toContain('z-50')
  })

  it('defines directional motion and reduced-motion coverage', () => {
    const source = read('src/index.css')
    expect(source).toContain('.ui-floating-surface')
    expect(source).toContain(".ui-floating-content[data-side='bottom']")
    expect(source).toContain('.ui-tooltip-content')
    expect(source).toContain('.ui-command-bar')
    expect(source).toMatch(/prefers-reduced-motion:[\s\S]*\.ui-floating-content[\s\S]*\.ui-tooltip-content[\s\S]*\.ui-command-bar/)
  })
})
