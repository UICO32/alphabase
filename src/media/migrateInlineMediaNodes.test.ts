import { describe, expect, it, vi } from 'vitest'
import { hasInlineMediaNodes, migrateInlineMediaNodes } from './migrateInlineMediaNodes'

const dataUrl = 'data:image/png;base64,iVBORw0KGgo='

describe('migrateInlineMediaNodes', () => {
  it('detects only inline canvas media nodes', () => {
    expect(hasInlineMediaNodes([{ id: 'm', type: 'media', position: { x: 0, y: 0 }, data: { url: dataUrl } }])).toBe(true)
    expect(hasInlineMediaNodes([{ id: 'c', type: 'card', position: { x: 0, y: 0 }, data: { url: dataUrl } }])).toBe(false)
  })

  it('replaces inline bytes with asset metadata without moving the node', async () => {
    const store = vi.fn().mockResolvedValue({
      assetId: 'hash', kind: 'image', mimeType: 'image/png', name: 'pasted.png', size: 8,
      url: 'hepta-media://hash/hash.png', width: 1600, height: 900,
      variants: [{ width: 512, url: 'hepta-media://hash/hash.w512.webp' }],
    })
    const node = { id: 'm', type: 'media', position: { x: 12, y: 34 }, data: { url: dataUrl }, width: 320, height: 220 }

    const result = await migrateInlineMediaNodes([node], store)

    expect(result.changed).toBe(true)
    expect(result.nodes[0].position).toEqual(node.position)
    expect(result.nodes[0].data.url).toBe('hepta-media://hash/hash.png')
    expect(result.nodes[0].data.assetId).toBe('hash')
    expect(result.nodes[0].width).toBe(800)
    expect(result.nodes[0].height).toBe(450)
  })

  it('returns the original array when no migration is needed', async () => {
    const nodes = [{ id: 'm', type: 'media', position: { x: 0, y: 0 }, data: { url: 'https://example.com/a.png' } }]
    const result = await migrateInlineMediaNodes(nodes, vi.fn())
    expect(result.changed).toBe(false)
    expect(result.nodes).toBe(nodes)
  })
})
