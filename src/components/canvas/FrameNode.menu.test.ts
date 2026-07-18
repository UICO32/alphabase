import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(`${process.cwd()}/src/components/canvas/FrameNode.tsx`, 'utf8')

describe('FrameNode menu exclusivity', () => {
  it('closes the other menu before toggling either frame menu', () => {
    expect(source).toMatch(
      /setColorMenuPos[\s\S]*?setShowLayoutMenu\(false\)[\s\S]*?setShowColorMenu\(\(v\) => !v\)/,
    )
    expect(source).toMatch(
      /setLayoutMenuPos[\s\S]*?setShowColorMenu\(false\)[\s\S]*?setShowLayoutMenu\(\(v\) => !v\)/,
    )
  })
})
