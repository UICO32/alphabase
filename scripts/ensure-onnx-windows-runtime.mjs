import { copyFile, mkdir, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const CRT_DIRECTORY = 'Microsoft.VC143.CRT'
const VISUAL_STUDIO_EDITIONS = ['Community', 'BuildTools', 'Professional', 'Enterprise']
const VISUAL_STUDIO_VERSIONS = ['18', '2022']

async function findLatestCrtUnder(redistRoot) {
  if (!redistRoot || !existsSync(redistRoot)) return null

  const versions = (await readdir(redistRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))

  for (const version of versions) {
    const candidate = join(redistRoot, version, 'x64', CRT_DIRECTORY)
    if (existsSync(join(candidate, 'vcruntime140.dll'))) return candidate
  }
  return null
}

export async function findWindowsCrtDirectory(env = process.env) {
  const explicitRoot = env.VCToolsRedistDir
  if (explicitRoot) {
    const candidate = join(explicitRoot, 'x64', CRT_DIRECTORY)
    if (existsSync(join(candidate, 'vcruntime140.dll'))) return candidate
  }

  const programFilesRoots = [env.ProgramFiles, env['ProgramFiles(x86)']].filter(Boolean)
  for (const programFiles of programFilesRoots) {
    for (const version of VISUAL_STUDIO_VERSIONS) {
      for (const edition of VISUAL_STUDIO_EDITIONS) {
        const redistRoot = join(
          programFiles,
          'Microsoft Visual Studio',
          version,
          edition,
          'VC',
          'Redist',
          'MSVC',
        )
        const candidate = await findLatestCrtUnder(redistRoot)
        if (candidate) return candidate
      }
    }
  }

  return null
}

export async function copyWindowsCrt(targetDirectory, env = process.env) {
  if (process.platform !== 'win32') return { copied: 0, source: null }

  const sourceDirectory = await findWindowsCrtDirectory(env)
  if (!sourceDirectory) {
    throw new Error(
      'Microsoft VC143 runtime files were not found. Install Visual Studio with the C++ runtime before building the Windows app.',
    )
  }

  await mkdir(targetDirectory, { recursive: true })
  const dllFiles = (await readdir(sourceDirectory, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.dll'))

  let copied = 0
  for (const file of dllFiles) {
    const destination = join(targetDirectory, file.name)
    if (existsSync(destination)) continue
    await copyFile(join(sourceDirectory, file.name), destination)
    copied += 1
  }

  return { copied, available: dllFiles.length, source: sourceDirectory }
}

export function getDevelopmentOnnxDirectory(projectRoot = process.cwd()) {
  return join(
    projectRoot,
    'node_modules',
    'onnxruntime-node',
    'bin',
    'napi-v6',
    'win32',
    'x64',
  )
}

async function main() {
  if (process.platform !== 'win32') return
  const targetDirectory = getDevelopmentOnnxDirectory()
  const result = await copyWindowsCrt(targetDirectory)
  console.log(
    `[ensure-onnx-windows-runtime] VC runtime ready (${result.available} DLLs, ${result.copied} copied) from ${result.source}`,
  )
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : ''
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(`[ensure-onnx-windows-runtime] ${error.message}`)
    process.exitCode = 1
  })
}
