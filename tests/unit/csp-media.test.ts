import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('media content security policy', () => {
  it('allows temporary video posters and workspace media playback', async () => {
    const html = await readFile(resolve(process.cwd(), 'index.html'), 'utf8')
    expect(html).toMatch(/media-src[^;]*'self'[^;]*blob:[^;]*hepta-media:/)
  })
})
