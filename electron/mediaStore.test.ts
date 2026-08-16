import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import sharp from 'sharp'
import { getContentAssetId, getFileContentAssetId, normalizeMediaMimeType, storeWorkspaceMedia, storeWorkspaceMediaFromPath } from './mediaStore'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('workspace media store', () => {
  it('normalizes supported MIME types from MIME or extension', () => {
    expect(normalizeMediaMimeType('image/jpeg', 'photo.bin')).toBe('image/jpeg')
    expect(normalizeMediaMimeType('', 'clip.WEBM')).toBe('video/webm')
    expect(normalizeMediaMimeType('', 'notes.txt')).toBe('')
  })

  it('uses a stable content hash for asset identity', () => {
    const bytes = new Uint8Array([1, 2, 3])
    expect(getContentAssetId(bytes)).toBe(getContentAssetId(new Uint8Array(bytes)))
    expect(getContentAssetId(bytes)).toHaveLength(64)
  })

  it('preserves the original and creates bounded image variants', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abase-media-'))
    roots.push(root)
    const original = await sharp({
      create: { width: 2200, height: 1100, channels: 3, background: '#4677cc' },
    }).jpeg({ quality: 92 }).toBuffer()

    const result = await storeWorkspaceMedia(root, {
      bytes: original,
      mimeType: 'image/jpeg',
      name: 'large-photo.jpg',
    })

    expect(result.width).toBe(2200)
    expect(result.height).toBe(1100)
    expect(result.variants.map((variant) => variant.width)).toEqual([512, 1024, 2048])
    expect(await readFile(join(root, 'media', `${result.assetId}.jpg`))).toEqual(original)
    expect((await readdir(join(root, 'media'))).filter((name) => name.includes('.w'))).toHaveLength(3)
  })

  it('deduplicates repeated originals and variants by content hash', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abase-media-'))
    roots.push(root)
    const original = await sharp({
      create: { width: 1200, height: 800, channels: 3, background: '#111111' },
    }).png().toBuffer()

    const first = await storeWorkspaceMedia(root, { bytes: original, mimeType: 'image/png', name: 'a.png' })
    const second = await storeWorkspaceMedia(root, { bytes: original, mimeType: 'image/png', name: 'b.png' })

    expect(second.assetId).toBe(first.assetId)
    expect(await readdir(join(root, 'media'))).toHaveLength(3)
  })

  it('streams a disk-backed video into the workspace without renderer bytes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abase-media-'))
    roots.push(root)
    const sourcePath = join(root, 'source.mp4')
    const original = Buffer.from('deterministic-video-fixture')
    await writeFile(sourcePath, original)

    const result = await storeWorkspaceMediaFromPath(root, {
      sourcePath,
      mimeType: 'video/mp4',
      name: 'clip.mp4',
    })

    expect(result.kind).toBe('video')
    expect(result.assetId).toBe(await getFileContentAssetId(sourcePath))
    expect(await readFile(join(root, 'media', `${result.assetId}.mp4`))).toEqual(original)
  })
})
