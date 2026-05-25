import { cpSync, mkdirSync, existsSync, readdirSync, rmSync } from 'fs'
import { join } from 'path'

/**
 * electron-builder afterPack hook.
 *
 * pnpm stores the real sharp + @img/sharp-win32-x64 inside
 * node_modules/.pnpm/sharp@x.x.x/node_modules/, while the top-level
 * node_modules/sharp is just a symlink. electron-builder's asar archiver
 * dereferences the symlink but loses @img/sharp-win32-x64 (it's a nested
 * optional dep that doesn't get hoisted).
 *
 * This hook replaces the broken unpacked sharp with the full copy from
 * the .pnpm store, which contains both sharp AND @img/sharp-win32-x64.
 */
export default async function afterPack(context) {
  const unpackedDir = join(context.appOutDir, 'resources', 'app.asar.unpacked')
  const nmDir = join(process.cwd(), 'node_modules')
  const pnpmDir = join(nmDir, '.pnpm')

  // Find sharp in .pnpm store
  let sharpStoreDir = null
  try {
    for (const entry of readdirSync(pnpmDir)) {
      if (entry.startsWith('sharp@')) {
        const candidate = join(pnpmDir, entry, 'node_modules', 'sharp')
        if (existsSync(candidate)) {
          sharpStoreDir = candidate
          break
        }
      }
    }
  } catch { /* no .pnpm dir */ }

  if (!sharpStoreDir) {
    console.warn('[afterPack] sharp not found in .pnpm store')
    return
  }

  // Remove the broken unpacked sharp (from asarUnpack)
  const unpackedSharp = join(unpackedDir, 'node_modules', 'sharp')
  if (existsSync(unpackedSharp)) {
    rmSync(unpackedSharp, { recursive: true, force: true })
  }

  // Copy full sharp from pnpm store (includes @img/sharp-win32-x64)
  mkdirSync(join(unpackedDir, 'node_modules'), { recursive: true })
  cpSync(sharpStoreDir, unpackedSharp, { recursive: true })
  console.log(`[afterPack] replaced sharp with full pnpm store copy from ${sharpStoreDir}`)

  // Also copy @img/colour if present
  const colourStoreDir = join(pnpmDir, '@img+colour@1.1.0', 'node_modules', '@img', 'colour')
  if (existsSync(colourStoreDir)) {
    const destDir = join(unpackedDir, 'node_modules', '@img', 'colour')
    mkdirSync(join(unpackedDir, 'node_modules', '@img'), { recursive: true })
    cpSync(colourStoreDir, destDir, { recursive: true })
    console.log(`[afterPack] copied @img/colour`)
  }
}