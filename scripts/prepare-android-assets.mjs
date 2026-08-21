import { readdir, rm } from 'node:fs/promises'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const webOutputDir = resolve(repoRoot, 'dist')
const nativeWebDir = resolve(repoRoot, 'android/app/src/main/assets/public')

async function findApks(directory) {
  const matches = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) matches.push(...await findApks(path))
    else if (entry.isFile() && extname(entry.name).toLowerCase() === '.apk') matches.push(path)
  }
  return matches
}

const embeddedApks = await findApks(webOutputDir)
if (embeddedApks.length) {
  const names = embeddedApks.map((path) => relative(repoRoot, path)).join(', ')
  throw new Error(`Android web assets contain APK files: ${names}`)
}

await rm(nativeWebDir, { recursive: true, force: true })
console.log('Android web assets are clean; stale native assets were removed.')
