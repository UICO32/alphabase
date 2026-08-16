import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { copyWindowsCrt } from './ensure-onnx-windows-runtime.mjs'

const ARCH_NAMES = ['ia32', 'x64', 'armv7l', 'arm64', 'universal']

function resolveArchName(arch) {
  if (typeof arch === 'number') return ARCH_NAMES[arch] ?? String(arch)
  return String(arch).toLowerCase()
}

function getKeptArchitectures(archName) {
  return archName === 'universal' ? new Set(['x64', 'arm64']) : new Set([archName])
}

/**
 * Keep only the ONNX Runtime native payload required by the current
 * platform/architecture. The npm package ships binaries for several targets,
 * while each packaged artifact only needs one of them.
 */
export default async function afterPack({ appOutDir, electronPlatformName, arch }) {
  const nativeRoot = join(
    appOutDir,
    'resources',
    'app.asar.unpacked',
    'node_modules',
    'onnxruntime-node',
    'bin',
  )

  let entries
  try {
    entries = await readdir(nativeRoot, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') return
    throw error
  }

  const targetPlatform = electronPlatformName === 'mas' ? 'darwin' : electronPlatformName
  const keptArchitectures = getKeptArchitectures(resolveArchName(arch))
  let removedDirectories = 0

  for (const napiEntry of entries) {
    if (!napiEntry.isDirectory() || !napiEntry.name.startsWith('napi-')) continue

    const napiRoot = join(nativeRoot, napiEntry.name)
    const platformEntries = await readdir(napiRoot, { withFileTypes: true })

    for (const platformEntry of platformEntries) {
      if (!platformEntry.isDirectory()) continue

      const platformRoot = join(napiRoot, platformEntry.name)
      if (platformEntry.name !== targetPlatform) {
        await rm(platformRoot, { recursive: true, force: true })
        removedDirectories += 1
        continue
      }

      const architectureEntries = await readdir(platformRoot, { withFileTypes: true })
      for (const architectureEntry of architectureEntries) {
        if (!architectureEntry.isDirectory() || keptArchitectures.has(architectureEntry.name)) continue
        await rm(join(platformRoot, architectureEntry.name), { recursive: true, force: true })
        removedDirectories += 1
      }
    }
  }

  if (removedDirectories > 0) {
    console.log(
      `[electron-after-pack] kept ONNX Runtime payload for ${targetPlatform}/${resolveArchName(arch)}; removed ${removedDirectories} directories`,
    )
  }

  if (targetPlatform === 'win32' && keptArchitectures.has('x64')) {
    const targetDirectory = join(nativeRoot, 'napi-v6', 'win32', 'x64')
    const runtime = await copyWindowsCrt(targetDirectory)
    console.log(
      `[electron-after-pack] bundled ${runtime.available} VC runtime DLLs for ONNX Runtime (${runtime.copied} copied during afterPack)`,
    )
  }
}
