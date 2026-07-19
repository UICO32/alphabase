import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(`${process.cwd()}/${path}`, 'utf8')

describe('motion consistency', () => {
  it('uses pressed translation instead of card and list scaling', () => {
    expect(read('src/components/ui/CardLibraryView.tsx')).not.toContain('active:scale-')
    expect(read('src/theme/animations.css')).not.toMatch(/\.active-press:active\s*{[^}]*transform:\s*scale/)
    expect(read('src/theme/animations.css')).not.toMatch(/\.hepta-list-item:active\s*{[^}]*transform:\s*scale/)
  })

  it('removes bounce scaling from generic entry motion', () => {
    const animations = read('src/theme/animations.css')
    expect(animations).not.toContain('animation: fadeInUp var(--duration-slow) var(--ease-bounce)')
    expect(animations).not.toContain('animation: card-enter 0.32s var(--ease-bounce)')
    expect(read('src/components/ui/CardLibraryView.tsx')).not.toContain('card-return-bounce')
  })

  it('covers decorative and state animations in reduced-motion mode', () => {
    const animations = read('src/theme/animations.css')
    expect(animations).toMatch(/prefers-reduced-motion:[\s\S]*\.animate-fadeInUp[\s\S]*\.animate-pulse[\s\S]*\.edge-selected[\s\S]*\.loading-pulse/)
  })
})
