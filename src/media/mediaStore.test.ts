import { afterEach, describe, expect, it } from 'vitest'
import { setFSAdapter } from '../utils/workspace/fs'
import { dataUrlToBytes, getMediaFileName, getMediaPath, mimeToExtension, storeMediaDataUrl } from './mediaStore'

afterEach(() => {
  setFSAdapter({
    readFile: async () => new Uint8Array(),
    writeFile: async () => {},
    deleteFile: async () => {},
    readdir: async () => [],
    readDirFiles: async () => null,
    mkdir: async () => {},
    stat: async () => ({ isDirectory: false, size: 0, mtimeMs: 0 }),
    exists: async () => false,
    rename: async () => {},
    rmdir: async () => {},
  })
})

describe('mediaStore', () => {
  it('maps common image MIME types to extensions', () => {
    expect(mimeToExtension('image/png')).toBe('png')
    expect(mimeToExtension('image/jpeg')).toBe('jpg')
    expect(mimeToExtension('image/webp')).toBe('webp')
    expect(mimeToExtension('image/gif')).toBe('gif')
    expect(mimeToExtension('image/unknown')).toBe('bin')
  })

  it('builds stable media file names', () => {
    expect(getMediaFileName('media-1', 'image/png')).toBe('media-1.png')
  })

  it('builds workspace media paths with forward slashes', () => {
    expect(getMediaPath('D:\\workspace', 'media-1.png')).toBe('D:/workspace/media/media-1.png')
  })

  it('decodes base64 data urls to binary bytes', () => {
    const bytes = dataUrlToBytes('data:image/png;base64,iVBORw0KGgo=')

    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('stores media files as binary data instead of data url text', async () => {
    let written: Uint8Array | string | undefined
    setFSAdapter({
      readFile: async () => new Uint8Array(),
      writeFile: async (_path, data) => { written = data },
      deleteFile: async () => {},
      readdir: async () => [],
      readDirFiles: async () => null,
      mkdir: async () => {},
      stat: async () => ({ isDirectory: false, size: 0, mtimeMs: 0 }),
      exists: async () => false,
      rename: async () => {},
      rmdir: async () => {},
    })

    const result = await storeMediaDataUrl('D:/workspace', 'data:image/png;base64,iVBORw0KGgo=', 'image/png')

    expect(result.file.size).toBe(8)
    expect(written).toBeInstanceOf(Uint8Array)
    expect(Array.from((written as Uint8Array).slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })
})
